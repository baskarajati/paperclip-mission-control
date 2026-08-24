import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expectedPackageFiles, readTarEntries } from "../../scripts/verify-package.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const guard = join(root, "scripts/verify-package.mjs");
const dist = join(root, "packages/plugin/dist");

test("importing verify-package has no side effects", () => {
  // The module must run verification only on direct execution. Importing it
  // from a fresh process must not spawn npm pack or leave its temporary
  // verification directory behind.
  const probe = [
    'import { readdirSync } from "node:fs";',
    `const tmp = ${JSON.stringify(tmpdir())};`,
    'const count = () => readdirSync(tmp).filter((entry) => entry.startsWith("paperclip-mission-control-package-")).length;',
    "const before = count();",
    `await import(${JSON.stringify(pathToFileURL(guard).href)});`,
    "console.log(JSON.stringify({ before, after: count() }));",
  ].join("\n");
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", probe],
    { encoding: "utf8" },
  );
  assert.equal(
    result.status,
    0,
    `bare import failed:\n${result.stdout}\n${result.stderr}`,
  );
  const lastLine = result.stdout.trim().split("\n").at(-1);
  const { before, after } = JSON.parse(lastLine);
  assert.equal(after, before, "importing verify-package must not create its temporary verification directory");
});

test("readTarEntries and expectedPackageFiles agree with the packed allowlist", async () => {
  assert.equal(existsSync(dist), true, "run pnpm build before package guard tests");

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "verify-package-import-"));
  try {
    execFileSync(
      "npm",
      ["pack", "--ignore-scripts", "--pack-destination", temporaryDirectory],
      { cwd: join(root, "packages/plugin"), encoding: "utf8" },
    );
    const tarballName = readdirSync(temporaryDirectory).find((name) =>
      name.endsWith(".tgz"),
    );
    assert.ok(tarballName, "npm pack produced no tarball");

    const packedPaths = readTarEntries(
      await readFile(join(temporaryDirectory, tarballName)),
    )
      .map((entry) => entry.path)
      .sort();
    assert.deepEqual(packedPaths, [...expectedPackageFiles].sort());
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

function runGuard() {
  return spawnSync(process.execPath, [guard], {
    cwd: root,
    encoding: "utf8",
  });
}

test("clean M2A package verification inspects the actual packed tarball", () => {
  const result = runGuard();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /package\/package\.json/);
  assert.match(result.stdout, /package\/dist\/company-config\.js/);
  assert.match(result.stdout, /package\/dist\/sweep-policy\.d\.ts/);
  assert.doesNotMatch(result.stdout, /package\/(?:src|tests)\//);
  assert.match(result.stdout, /private=true/);
  assert.match(result.stdout, /isolated consumer install passed/);
});

test("forbidden development and stale entrypoint artifacts are rejected", async (t) => {
  assert.equal(existsSync(dist), true, "run pnpm build before package guard tests");

  const forbidden = [
    "manifest.js",
    "worker.js",
    "source.ts",
    "source.js.map",
    ".env",
    "credentials.json",
    "local-worktree-path.txt",
  ];

  for (const name of forbidden) {
    await t.test(name, async () => {
      const path = join(dist, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "stale fixture\n", "utf8");
      try {
        const result = runGuard();
        assert.notEqual(result.status, 0, result.stdout);
        assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(name.replace(".", "\\.")));
      } finally {
        await rm(path, { force: true });
      }
    });
  }
});

test("local-path and credential-like content in an allowed artifact is rejected", async (t) => {
  const indexPath = join(dist, "index.js");
  const original = readFileSync(indexPath);
  const forbiddenContent = [
    ["absolute user path", 'export const leaked = "/Users/example/worktree/token";\n'],
    [
      "private key",
      "export const leaked = `-----BEGIN PRIVATE KEY-----\\nsecret`;\n",
    ],
  ];

  try {
    for (const [name, content] of forbiddenContent) {
      await t.test(name, () => {
        writeFileSync(indexPath, content, "utf8");
        const result = runGuard();
        assert.notEqual(result.status, 0, result.stdout);
        assert.match(`${result.stdout}\n${result.stderr}`, /package\/dist\/index\.js/);
      });
    }
  } finally {
    writeFileSync(indexPath, original);
  }
});
