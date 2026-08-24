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
const milestonePlan = join(
  root,
  "docs/plans/milestones/0002-plugin-skeleton-and-compatibility.md",
);

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

test("the runtime-dependency guard covers every runtime package field", () => {
  const source = readFileSync(guard, "utf8");
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.match(
      source,
      new RegExp(`\\"${field}\\"`),
      `runtime dependency field ${field} is not mechanically guarded`,
    );
  }
  assert.doesNotMatch(
    source,
    /runtimeDependencyFields[\s\S]*devDependencies/u,
    "devDependencies must remain available for tooling",
  );
});

test("the removed vacuous production audit cannot silently return to the root scripts", () => {
  const scripts = readRootPackageScripts();
  const plan = readFileSync(milestonePlan, "utf8");
  assert.equal(
    "audit:prod" in scripts,
    false,
    "audit:prod was removed as a vacuous network gate; while the runtime " +
      "dependency set is empty, verify:no-runtime-deps is the deterministic " +
      "replacement required by milestone plan 0002",
  );
  assert.match(scripts["verify:no-runtime-deps"] ?? "", /verify-no-runtime-dependencies\.mjs$/);
  assert.doesNotMatch(scripts.verify ?? "", /\baudit:prod\b/);
  assert.match(scripts.test ?? "", /test:tooling/);
  assert.match(plan, /All runtime dependency classes are mechanically forbidden in M2A/u);
  assert.match(
    plan,
    /deterministic guard replaces the former\s+vacuous network production audit/u,
  );
  assert.match(plan, /restore a blocking production vulnerability audit/u);
  assert.match(plan, /Known high or critical production vulnerabilities block acceptance/u);
});

test("the CI workflow has no production-audit step and names the verification job", () => {
  const workflow = readFileSync(ciWorkflow, "utf8");
  assert.doesNotMatch(workflow, /\baudit:prod\b/);
  assert.doesNotMatch(workflow, /[Aa]udit production dependencies/);
  assert.match(workflow, /name: Verification \(Node \$\{\{ matrix\.node \}\}\)/);
  assert.doesNotMatch(workflow, /name: Contracts \(Node/);
});
