import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCompanyConfigChange,
  createPolicyState,
  isSweepTokenCurrent,
  selectSweepTokens,
} from "../dist/sweep-policy.js";

test("selection is enabled-only, sorted, and deduplicated", () => {
  const empty = createPolicyState();
  const withB = applyCompanyConfigChange(empty, "company-b", { enabled: true });
  const withA = applyCompanyConfigChange(withB.state, "company-a", { enabled: true });
  const withDisabled = applyCompanyConfigChange(
    withA.state,
    "company-disabled",
    { enabled: false },
  );
  const withDuplicateUpdate = applyCompanyConfigChange(
    withDisabled.state,
    "company-a",
    { enabled: true },
  );

  assert.deepEqual(selectSweepTokens(withDuplicateUpdate.state), [
    { companyId: "company-a", generation: 1 },
    { companyId: "company-b", generation: 1 },
  ]);
  assert.equal(empty.size, 0);
  assert.equal(Object.isFrozen(selectSweepTokens(withDuplicateUpdate.state)), true);
});

test("accepted changes start at generation 1 without mutating prior state", () => {
  const first = applyCompanyConfigChange(
    createPolicyState(),
    "company-a",
    { enabled: true },
  );
  const second = applyCompanyConfigChange(first.state, "company-a", { enabled: true });

  assert.equal(first.generation, 1);
  assert.equal(second.generation, 1);
  assert.deepEqual(selectSweepTokens(first.state), [
    { companyId: "company-a", generation: 1 },
  ]);
  assert.deepEqual(selectSweepTokens(second.state), [
    { companyId: "company-a", generation: 1 },
  ]);
});

test("missing company scopes are rejected without changing policy state", () => {
  const state = createPolicyState();
  for (const companyId of [null, undefined, "", "   "]) {
    const rejected = applyCompanyConfigChange(state, companyId, { enabled: true });

    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, "invalid_company_id");
      assert.equal(rejected.state, state);
    }
  }
});

test("invalid changes fail closed and invalidate the previous enabled scope", () => {
  const enabled = applyCompanyConfigChange(
    createPolicyState(),
    "company-a",
    { enabled: true },
  );
  const selected = selectSweepTokens(enabled.state);
  const malformed = applyCompanyConfigChange(
    enabled.state,
    "company-a",
    { enabled: "yes" },
  );

  assert.equal(malformed.result.ok, false);
  assert.deepEqual(selectSweepTokens(malformed.state), []);
  assert.equal(isSweepTokenCurrent(malformed.state, selected[0]), false);
  assert.equal(malformed.generation, 2);
});

test("a disable or change after selection makes the old token ineligible", () => {
  const enabled = applyCompanyConfigChange(
    createPolicyState(),
    "company-a",
    { enabled: true },
  );
  const selected = selectSweepTokens(enabled.state);
  const disabled = applyCompanyConfigChange(
    enabled.state,
    "company-a",
    { enabled: false },
  );

  assert.equal(isSweepTokenCurrent(enabled.state, selected[0]), true);
  assert.equal(isSweepTokenCurrent(disabled.state, selected[0]), false);

  const reenabled = applyCompanyConfigChange(
    disabled.state,
    "company-a",
    { enabled: true },
  );
  const current = selectSweepTokens(reenabled.state)[0];

  assert.equal(current.generation, 3);
  assert.equal(isSweepTokenCurrent(reenabled.state, selected[0]), false);
  assert.equal(isSweepTokenCurrent(reenabled.state, current), true);
  assert.equal(Object.isFrozen(current), true);
});

test("an equivalent valid rewrite preserves generation and the in-flight token", () => {
  const enabled = applyCompanyConfigChange(
    createPolicyState(),
    "company-a",
    { enabled: true },
  );
  const selected = selectSweepTokens(enabled.state);
  const rewritten = applyCompanyConfigChange(
    enabled.state,
    "company-a",
    { enabled: true },
  );

  assert.equal(enabled.generation, 1);
  assert.equal(rewritten.generation, 1);
  assert.equal(isSweepTokenCurrent(rewritten.state, selected[0]), true);
  assert.deepEqual(selectSweepTokens(rewritten.state), [
    { companyId: "company-a", generation: 1 },
  ]);
});

test("a different invalid rewrite preserves generation until validity changes", () => {
  const malformed = applyCompanyConfigChange(
    createPolicyState(),
    "company-a",
    { enabled: "yes" },
  );
  const selected = selectSweepTokens(malformed.state);
  const unknownKeys = applyCompanyConfigChange(
    malformed.state,
    "company-a",
    { unexpected: true },
  );

  assert.equal(malformed.generation, 1);
  assert.equal(unknownKeys.generation, 1);
  assert.deepEqual(selected, []);
  assert.deepEqual(selectSweepTokens(unknownKeys.state), []);
  if (!malformed.result.ok) {
    assert.equal(malformed.result.code, "enabled_not_boolean");
  }
  if (!unknownKeys.result.ok) {
    assert.equal(unknownKeys.result.code, "unknown_keys");
  }

  const recovered = applyCompanyConfigChange(
    unknownKeys.state,
    "company-a",
    { enabled: true },
  );

  assert.equal(recovered.generation, 2);
  assert.deepEqual(selectSweepTokens(recovered.state), [
    { companyId: "company-a", generation: 2 },
  ]);
});
