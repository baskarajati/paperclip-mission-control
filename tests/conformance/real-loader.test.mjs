// Real-loader conformance tests — OPT-IN, host-dependent, not part of CI or
// `pnpm test`. Run them with `pnpm test:real-loader` against a prepared
// Paperclip host checkout:
//
//   PAPERCLIP_AUDIT_SOURCE=/path/to/paperclip pnpm test:real-loader
//
// The source checkout must be clean and at exactly commit
// a14e51d592dd22e2e830e01f94e6783d55df9963. The test never clones, installs,
// or builds the host; it fails closed when required host artifacts are absent.
// The host emits a short commit prefix in server/dist/build-info.json; the
// prefix must match EXPECTED_HEAD exactly and be nontrivial.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import {
  expectedPackageFiles,
  readTarEntries,
} from "../../scripts/verify-package.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const probePath = join(root, "tests/conformance/real-loader.probe.mjs");
const pluginPackageJsonPath = join(root, "packages/plugin/package.json");
const EXPECTED_HEAD = "a14e51d592dd22e2e830e01f94e6783d55df9963";
const MIN_COMMIT_PREFIX_LENGTH = 7;
const EXPECTED_HOST_VERSIONS = {
  tsx: "4.23.12",
  pino: "10.3.1",
  zod: "4.4.3",
  "drizzle-orm": "0.45.2",
};

function fail(message) {
  throw new Error(`test:real-loader: ${message}`);
}

function git(source, args) {
  return execFileSync("git", ["-C", source, ...args], {
    encoding: "utf8",
  }).trim();
}

function requireEnvSource() {
  const configuredSource = process.env["PAPERCLIP_AUDIT_SOURCE"];
  if (!configuredSource) {
    fail(
      "PAPERCLIP_AUDIT_SOURCE must point to a Paperclip git checkout at " +
        `${EXPECTED_HEAD} (clean tree, installed dependencies, built server).`,
    );
  }
  return resolve(configuredSource);
}

function requirePreparedCheckout(source) {
  let head;
  try {
    head = git(source, ["rev-parse", "HEAD"]);
  } catch (error) {
    fail(`PAPERCLIP_AUDIT_SOURCE is not a git checkout: ${error.message}`);
  }
  if (head !== EXPECTED_HEAD) {
    fail(`checkout HEAD is ${head}, expected exactly ${EXPECTED_HEAD}`);
  }
  const status = git(source, ["status", "--porcelain"]);
  if (status.length > 0) {
    fail(`checkout must be clean, found:\n${status}`);
  }
}

function requireFile(path, description) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    fail(`${description} is missing at ${path}`);
  }
  return path;
}

function readPinnedVersion(source, relativePackageDir, name) {
  const packageJsonPath = requireFile(
    join(source, relativePackageDir, "package.json"),
    `the pinned "${name}" dependency`,
  );
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
  } catch (error) {
    fail(`cannot read the version of "${name}": ${error.message}`);
  }
}

function requirePreparedRuntime(source) {
  const serverDist = join(source, "server/dist");
  if (!existsSync(serverDist)) {
    fail(
      `the real built server is missing at ${serverDist} ` +
        "(build the pinned host checkout first)",
    );
  }

  const buildInfoPath = requireFile(
    join(serverDist, "build-info.json"),
    "the built server's build-info.json",
  );
  let buildCommit;
  try {
    buildCommit = JSON.parse(readFileSync(buildInfoPath, "utf8")).commit;
  } catch (error) {
    fail(`build-info.json is unreadable: ${error.message}`);
  }
  if (typeof buildCommit !== "string" || buildCommit.length < MIN_COMMIT_PREFIX_LENGTH) {
    fail(
      `build-info.json commit must be a commit prefix of at least ` +
        `${MIN_COMMIT_PREFIX_LENGTH} characters, found ${JSON.stringify(buildCommit)}`,
    );
  }
  if (EXPECTED_HEAD.startsWith(buildCommit) === false || buildCommit === "") {
    fail(
      `the built server identifies commit "${buildCommit}", ` +
        `which is not the pinned head ${EXPECTED_HEAD}`,
    );
  }

  for (const [name, expectedVersion] of Object.entries(EXPECTED_HOST_VERSIONS)) {
    const relativePackageDir =
      name === "tsx"
        ? join("cli/node_modules", name)
        : join("server/node_modules", name);
    const actualVersion = readPinnedVersion(source, relativePackageDir, name);
    if (actualVersion !== expectedVersion) {
      fail(
        `pinned host dependency "${name}" is ${actualVersion}, expected exactly ${expectedVersion}`,
      );
    }
  }
  console.log(
    `test:real-loader: pinned host runtime verified at commit prefix ` +
      `"${buildCommit}" with ` +
      Object.entries(EXPECTED_HOST_VERSIONS)
        .map(([name, version]) => `${name}@${version}`)
        .join(", "),
  );

  return {
    loaderUrl: pathToFileURL(
      requireFile(
        join(serverDist, "services/plugin-loader.js"),
        "the real built plugin loader",
      ),
    ).href,
    tsxHook: requireFile(
      join(source, "cli/node_modules/tsx/dist/loader.mjs"),
      "Paperclip's audited TSX hook",
    ),
  };
}

async function packAndInstallPlugin(consumerDir) {
  execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", consumerDir], {
    cwd: join(root, "packages/plugin"),
    encoding: "utf8",
  });
  const tarballName = readdirSync(consumerDir).find((name) =>
    name.endsWith(".tgz"),
  );
  if (!tarballName) fail("pnpm pack produced no tarball");

  const tarballPath = join(consumerDir, tarballName);
  // Inspect the exact tarball that is about to be installed: its sorted
  // entry paths must equal the verify-package allowlist before the real host
  // loader ever sees it.
  const packedPaths = readTarEntries(await readFile(tarballPath))
    .map((entry) => entry.path)
    .sort();
  assert.deepEqual(
    packedPaths,
    [...expectedPackageFiles].sort(),
    "the packed plugin tarball must carry exactly the allowlisted paths",
  );

  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      consumerDir,
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      tarballPath,
    ],
    { encoding: "utf8" },
  );

  const packageJson = JSON.parse(
    await readFile(pluginPackageJsonPath, "utf8"),
  );
  const installedPackageDir = join(
    consumerDir,
    "node_modules",
    ...packageJson.name.split("/"),
  );
  if (!existsSync(installedPackageDir)) {
    fail(`installed package directory not found at ${installedPackageDir}`);
  }
  return installedPackageDir;
}

function runProbe(input) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      input.tsxHook,
      probePath,
      JSON.stringify(input.payload),
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PAPERCLIP_DISABLE_PLUGIN_AUTOBUILD: "1",
      },
    },
  );
}

function writePositiveControlPackage(packageDir) {
  // A minimal but fully valid Paperclip plugin package. The manifest passes
  // schema and capability validation on the pinned host, so installPlugin can
  // only stop at persistence — which the strict DB proxy intercepts.
  mkdirSync(join(packageDir, "dist"), { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@positive-control/minimal-plugin",
        version: "1.0.0",
        private: true,
        type: "module",
        paperclipPlugin: {
          manifest: "./dist/manifest.js",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(packageDir, "dist/manifest.js"),
    `export default {
  id: "positive-control-minimal",
  apiVersion: 1,
  version: "1.0.0",
  displayName: "Positive Control Minimal Plugin",
  description: "Minimal valid manifest used as an install-persistence positive control.",
  author: "Paperclip Mission Control conformance suite",
  categories: ["ui"],
  capabilities: ["ui.dashboardWidget.register"],
  entrypoints: { worker: "./dist/worker.js" },
};
`,
    "utf8",
  );
  writeFileSync(
    join(packageDir, "dist/worker.js"),
    "// never executed: installPlugin rejects before worker startup\nexport default {};\n",
    "utf8",
  );
}

test("real pluginLoader rejects the packed plugin before persistence and reaches persistence for a valid manifest", async () => {
  const source = requireEnvSource();
  requirePreparedCheckout(source);
  const runtime = requirePreparedRuntime(source);

  const consumerDir = await mkdtemp(join(tmpdir(), "mc-real-loader-"));
  try {
    const installedPackageDir = await packAndInstallPlugin(consumerDir);
    const noManifestResult = runProbe({
      tsxHook: runtime.tsxHook,
      payload: { loaderUrl: runtime.loaderUrl, installedPackageDir },
    });
    assert.equal(
      noManifestResult.status,
      0,
      `real-loader no-manifest probe failed:\n${noManifestResult.stdout}\n${noManifestResult.stderr}`,
    );

    // Keep this fixture in the same disposable consumer as the exact packed
    // Mission Control artifact. It is intentionally local and separately
    // manifests as a valid plugin so the loader must reach its DB boundary.
    const packageDir = join(consumerDir, "minimal-plugin");
    writePositiveControlPackage(packageDir);
    const positiveControlResult = runProbe({
      tsxHook: runtime.tsxHook,
      payload: {
        loaderUrl: runtime.loaderUrl,
        installedPackageDir: packageDir,
        mode: "positive-control",
      },
    });
    assert.equal(
      positiveControlResult.status,
      0,
      `real-loader positive-control probe failed:\n${positiveControlResult.stdout}\n${positiveControlResult.stderr}`,
    );
  } finally {
    await rm(consumerDir, { recursive: true, force: true });
  }
});
