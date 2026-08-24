import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const guard = join(root, "scripts/verify-no-runtime-dependencies.mjs");
const ciWorkflow = join(root, ".github/workflows/ci.yml");

function readRootPackageScripts() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts;
}

test("the runtime-dependency guard passes from a working directory outside the repository", () => {
  const outside = mkdtempSync(join(tmpdir(), "mc-guard-cwd-"));
  try {
    const result = spawnSync(process.execPath, [guard], {
      cwd: outside,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      `guard failed from cwd ${outside}:\n${result.stdout}\n${result.stderr}`,
    );
    assert.equal(result.stderr, "");
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test("the removed vacuous production audit cannot silently return to the root scripts", () => {
  const scripts = readRootPackageScripts();
  assert.equal(
    "audit:prod" in scripts,
    false,
    "audit:prod was removed as a vacuous network gate; runtime dependencies stay forbidden via verify:no-runtime-deps",
  );
  assert.match(scripts["verify:no-runtime-deps"] ?? "", /verify-no-runtime-dependencies\.mjs$/);
  assert.doesNotMatch(scripts.verify ?? "", /\baudit:prod\b/);
  assert.match(scripts.test ?? "", /test:tooling/);
});

test("the CI workflow has no production-audit step and names the verification job", () => {
  const workflow = readFileSync(ciWorkflow, "utf8");
  assert.doesNotMatch(workflow, /\baudit:prod\b/);
  assert.doesNotMatch(workflow, /[Aa]udit production dependencies/);
  assert.match(workflow, /name: Verification \(Node \$\{\{ matrix\.node \}\}\)/);
  assert.doesNotMatch(workflow, /name: Contracts \(Node/);
});
