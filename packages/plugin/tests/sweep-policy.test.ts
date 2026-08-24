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
    { companyId: "company-a", generation: 2 },
    { companyId: "company-b", generation: 1 },
  ]);
  assert.equal(empty.size, 0);
  assert.equal(Object.isFrozen(selectSweepTokens(withDuplicateUpdate.state)), true);
});

test("accepted changes increment generation without mutating prior state", () => {
  const first = applyCompanyConfigChange(
    createPolicyState(),
    "company-a",
    { enabled: true },
  );
  const second = applyCompanyConfigChange(first.state, "company-a", { enabled: true });

  assert.equal(first.generation, 1);
  assert.equal(second.generation, 2);
  assert.deepEqual(selectSweepTokens(first.state), [
    { companyId: "company-a", generation: 1 },
  ]);
  assert.deepEqual(selectSweepTokens(second.state), [
    { companyId: "company-a", generation: 2 },
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
