import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDirectory = join(root, "packages/plugin");
const expectedPackageFiles = new Set([
  "package/package.json",
  "package/dist/company-config.d.ts",
  "package/dist/company-config.js",
  "package/dist/index.d.ts",
  "package/dist/index.js",
  "package/dist/sweep-policy.d.ts",
  "package/dist/sweep-policy.js",
]);
const forbiddenContentPatterns = [
  ["absolute user path", /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/u],
  [
    "private key",
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  ],
  [
    "credential assignment",
    /(?:API_KEY|PASSWORD|CLIENT_SECRET|ACCESS_TOKEN|AUTH_TOKEN)\s*[:=]\s*["'][^"']{8,}/iu,
  ],
  ["credential token", /(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/u],
  ["local package reference", /(?:file|link|workspace):(?:\/\/)?[^\s"']+/iu],
];

function fail(message) {
  throw new Error(`verify:package: ${message}`);
}

function readTarEntries(tarball) {
  const bytes = gunzipSync(tarball);
  const entries = [];
  let offset = 0;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = header.toString("utf8", 0, 100).replace(/\0.*$/u, "");
    const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/u, "");
    const path = prefix ? `${prefix}/${name}` : name;
    const sizeText = header
      .toString("ascii", 124, 136)
      .replace(/\0.*$/u, "")
      .trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    const type = header.toString("ascii", 156, 157) || "0";
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;

    if (!Number.isSafeInteger(size) || contentEnd > bytes.length) {
      fail(`invalid tar entry size for ${path}`);
    }

    entries.push({
      path,
      type,
      content: bytes.subarray(contentStart, contentEnd),
    });
    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function spawnCommand(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolvePromise({ code, signal, stdout, stderr });
    });
  });
}

async function main() {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "paperclip-mission-control-package-"),
  );

  try {
    const pack = await spawnCommand(
      "npm",
      ["pack", "--ignore-scripts", "--pack-destination", temporaryDirectory],
      { cwd: pluginDirectory },
    );
    if (pack.code !== 0) {
      fail(`npm pack failed${pack.stderr ? `: ${pack.stderr.trim()}` : ""}`);
    }

    const tarballs = (await readdir(temporaryDirectory))
      .filter((entry) => entry.endsWith(".tgz"))
      .sort();
    if (tarballs.length !== 1) {
      fail(`expected exactly one packed tarball, found ${tarballs.length}`);
    }

    const tarballPath = join(temporaryDirectory, tarballs[0]);
    const entries = readTarEntries(await readFile(tarballPath));
    const paths = entries.map((entry) => entry.path).sort();
    const expectedPaths = [...expectedPackageFiles].sort();

    if (JSON.stringify(paths) !== JSON.stringify(expectedPaths)) {
      const unexpected = paths.filter((path) => !expectedPackageFiles.has(path));
      const missing = expectedPaths.filter((path) => !paths.includes(path));
      fail(
        `tarball paths differ; unexpected=${JSON.stringify(unexpected)}, missing=${JSON.stringify(missing)}`,
      );
    }

    for (const entry of entries) {
      if (entry.type !== "0" && entry.type !== "") {
        fail(`non-file tarball entry is not allowed: ${entry.path}`);
      }
    }

    const packageEntry = entries.find((entry) => entry.path === "package/package.json");
    if (!packageEntry) {
      fail("packed package.json is missing");
    }

    let packageJson;
    try {
      packageJson = JSON.parse(packageEntry.content.toString("utf8"));
    } catch (error) {
      fail(`packed package.json is invalid JSON: ${error.message}`);
    }

    if (packageJson.private !== true) {
      fail("packed package.json must retain literal private:true");
    }
    const allowedPackageKeys = new Set([
      "name",
      "version",
      "private",
      "description",
      "license",
      "repository",
      "type",
      "files",
      "engines",
      "scripts",
      "devDependencies",
    ]);
    const unknownPackageKeys = Object.keys(packageJson).filter(
      (key) => !allowedPackageKeys.has(key),
    );
    if (unknownPackageKeys.length > 0) {
      fail(
        `packed package.json contains unreviewed metadata: ${unknownPackageKeys.sort().join(", ")}`,
      );
    }
    if (packageJson.name !== "@paperclip-mission-control/plugin") {
      fail("packed package.json has an unexpected package name");
    }
    if (packageJson.version !== "0.0.0") {
      fail("packed package.json must retain the private foundation version 0.0.0");
    }
    if (packageJson.license !== "MIT") {
      fail("packed package.json must retain the MIT license metadata");
    }
    if (packageJson.type !== "module") {
      fail("packed package.json must retain type:module");
    }
    if (packageJson.engines?.node !== ">=24.11.0") {
      fail("packed package.json must retain the Node >=24.11.0 engine gate");
    }
    if (
      packageJson.repository?.type !== "git" ||
      packageJson.repository?.url !==
        "https://github.com/baskarajati/paperclip-mission-control.git" ||
      packageJson.repository?.directory !== "packages/plugin"
    ) {
      fail("packed package.json repository metadata is incomplete or incorrect");
    }
    if (packageJson.publishConfig !== undefined) {
      fail("packed package.json must omit publishConfig before M2B");
    }
    if (packageJson.paperclipPlugin !== undefined) {
      fail("packed package.json must omit paperclipPlugin before M2B");
    }
    if (
      packageJson.main !== undefined ||
      packageJson.exports !== undefined ||
      packageJson.module !== undefined ||
      packageJson.browser !== undefined ||
      packageJson.bin !== undefined ||
      packageJson.manifest !== undefined ||
      packageJson.worker !== undefined
    ) {
      fail("packed package.json must omit runtime entrypoint metadata before M2B");
    }
    if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
      fail("packed package.json must not declare runtime dependencies");
    }
    if (
      !Array.isArray(packageJson.files) ||
      JSON.stringify(packageJson.files) !== JSON.stringify(["dist"])
    ) {
      fail("packed package.json files must be exactly [\"dist\"]");
    }
    if (
      JSON.stringify(packageJson.devDependencies) !==
      JSON.stringify({ typescript: "5.9.3" })
    ) {
      fail("packed package.json contains unreviewed development dependencies");
    }
    const expectedScripts = {
      build: "tsc -p tsconfig.json",
      typecheck: "tsc -p tsconfig.json --noEmit",
      lint: "eslint src --max-warnings=0",
      test: "pnpm build && node --experimental-strip-types --test",
    };
    if (JSON.stringify(packageJson.scripts) !== JSON.stringify(expectedScripts)) {
      fail("packed package.json contains unreviewed development scripts");
    }

    const forbiddenPathPattern =
      /(?:^|\/)(?:src|tests?|fixtures?|scripts?|\.github|\.git|\.env(?:\.|$)|credentials?|secrets?|worktree|manifest|worker)(?:\/|$)|(?:\.map$|\.tgz$)/iu;
    for (const path of paths) {
      if (forbiddenPathPattern.test(path)) {
        fail(`forbidden package path: ${path}`);
      }
    }

    for (const entry of entries) {
      const content = entry.content.toString("utf8");
      for (const [label, pattern] of forbiddenContentPatterns) {
        if (pattern.test(content)) {
          fail(`forbidden ${label} content in ${entry.path}`);
        }
      }
    }

    const consumerDirectory = join(temporaryDirectory, "consumer");
    await mkdir(consumerDirectory);
    await writeFile(
      join(consumerDirectory, "package.json"),
      `${JSON.stringify({
        name: "paperclip-mission-control-package-verifier",
        version: "0.0.0",
        private: true,
      }, null, 2)}\n`,
      "utf8",
    );
    const install = await spawnCommand(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=true",
        tarballPath,
      ],
      { cwd: consumerDirectory },
    );
    if (install.code !== 0) {
      fail(
        `isolated consumer install failed${install.stderr ? `: ${install.stderr.trim()}` : ""}`,
      );
    }
    await access(
      join(
        consumerDirectory,
        "node_modules/@paperclip-mission-control/plugin/package.json",
      ),
    );
    await access(join(consumerDirectory, "package-lock.json"));

    console.log(`verify:package: packed ${tarballs[0]}`);
    console.log(`verify:package: private=${String(packageJson.private)}`);
    console.log("verify:package: isolated consumer install passed");
    for (const path of paths) {
      console.log(`verify:package: ${path}`);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
