import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const guard = join(root, "scripts/verify-package.mjs");
const dist = join(root, "packages/plugin/dist");

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
