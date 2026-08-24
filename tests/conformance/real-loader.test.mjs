// Real-loader conformance test — OPT-IN, host-dependent, not part of CI or
// `pnpm test`. Run it with `pnpm test:real-loader` against a prepared Paperclip
// host checkout:
//
//   PAPERCLIP_AUDIT_SOURCE=/path/to/paperclip pnpm test:real-loader
//
// The source checkout must be clean and at exactly commit
// a14e51d592dd22e2e830e01f94e6783d55df9963. The test never clones, installs,
// or builds the host; it fails closed when required host artifacts are absent.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const probePath = join(root, "tests/conformance/real-loader.probe.mjs");
const EXPECTED_HEAD = "a14e51d592dd22e2e830e01f94e6783d55df9963";

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

function requirePreparedRuntime(source) {
  const serverDist = join(source, "server/dist");
  if (!existsSync(serverDist)) {
    fail(
      `the real built server is missing at ${serverDist} ` +
        "(build the pinned host checkout first)",
    );
  }
  for (const name of ["pino", "zod", "drizzle-orm"]) {
    if (!existsSync(join(source, "server/node_modules", name))) {
      fail(
        `the loader dependency "${name}" is missing under ` +
          `${join(source, "server/node_modules")} ` +
          "(install the pinned host checkout first)",
      );
    }
  }
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
  execFileSync("pnpm", ["pack", "--pack-destination", consumerDir], {
    cwd: join(root, "packages/plugin"),
    encoding: "utf8",
  });
  const tarballName = readdirSync(consumerDir).find((name) =>
    name.endsWith(".tgz"),
  );
  if (!tarballName) fail("pnpm pack produced no tarball");

  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      consumerDir,
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      join(consumerDir, tarballName),
    ],
    { encoding: "utf8" },
  );

  const packageJson = JSON.parse(
    await readFile(join(root, "packages/plugin/package.json"), "utf8"),
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

test("real pluginLoader rejects the packed plugin before any persistence access", async () => {
  const source = requireEnvSource();
  requirePreparedCheckout(source);
  const { loaderUrl, tsxHook } = requirePreparedRuntime(source);

  const consumerDir = await mkdtemp(join(tmpdir(), "mc-real-loader-"));
  try {
    const installedPackageDir = await packAndInstallPlugin(consumerDir);
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        tsxHook,
        probePath,
        JSON.stringify({ loaderUrl, installedPackageDir }),
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PAPERCLIP_DISABLE_PLUGIN_AUTOBUILD: "1",
        },
      },
    );
    assert.equal(
      result.status,
      0,
      `real-loader probe failed:\n${result.stdout}\n${result.stderr}`,
    );
  } finally {
    await rm(consumerDir, { recursive: true, force: true });
  }
});
