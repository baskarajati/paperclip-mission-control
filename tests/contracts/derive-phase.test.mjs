/**
 * Phase state derivation tests. Milestone 3, slice 2b.
 *
 * The decision order is the product here, so it is tested as a table: one row
 * per reachable phase state, then the precedence rules that decide which rule
 * wins when several could fire.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { derivePhaseState } from "../../contracts/v1/derive-phase.mjs";
import { MC } from "../../contracts/v1/codes.mjs";

/** A phase that is provisioned, verified, reported, and fully proven. */
function baseObservation(overrides = {}) {
  return {
    phaseId: "validation",
    cancelled: false,
    hardBlockers: [],
    project: { verified: true },
    incomingTransition: null,
    evidence: { hasReport: true, complete: true, waivedAny: false, hardGates: [] },
    confirmation: { status: "none" },
    successorVerified: false,
    terminal: false,
    terminalGates: null,
    ...overrides,
  };
}

const stateOf = (observation) => {
  const outcome = derivePhaseState(observation);
  assert.equal(outcome.ok, true, JSON.stringify(outcome.errors));
  return outcome.value.state;
};

test("every phase state is reachable, and reached for the stated reason", () => {
  const rows = [
    {
      state: "cancelled",
      why: "explicit unambiguous cancellation wins over everything",
      observation: baseObservation({ cancelled: true, hardBlockers: [{ code: MC.SNAPSHOT_INVALID, message: "x" }] }),
    },
    {
      state: "blocked",
      why: "an open hard governance condition stops the phase",
      observation: baseObservation({ hardBlockers: [{ code: MC.SNAPSHOT_INVALID, message: "budget incident" }] }),
    },
    {
      state: "planned",
      why: "no project and no incoming transition",
      observation: baseObservation({ project: null, incomingTransition: null, evidence: null }),
    },
    {
      state: "provisioning",
      why: "an accepted incoming transition whose target is not yet verified",
      observation: baseObservation({
        project: null,
        incomingTransition: { accepted: true, targetVerified: false },
        evidence: null,
      }),
    },
    {
      state: "provisioning",
      why: "a project exists but is not verified",
      observation: baseObservation({ project: { verified: false }, evidence: null }),
    },
    {
      state: "active",
      why: "a verified project with no validation attempt yet",
      observation: baseObservation({ evidence: { hasReport: false, complete: false, waivedAny: false, hardGates: [] } }),
    },
    {
      state: "validating",
      why: "a report exists but the evidence is incomplete",
      observation: baseObservation({ evidence: { hasReport: true, complete: false, waivedAny: false, hardGates: [] } }),
    },
    {
      state: "awaiting_confirmation",
      why: "evidence is complete and no current accepted confirmation exists",
      observation: baseObservation({ confirmation: { status: "none" } }),
    },
    {
      state: "completed",
      why: "accepted current confirmation and a verified successor",
      observation: baseObservation({
        confirmation: { status: "accepted", current: true },
        successorVerified: true,
      }),
    },
    {
      state: "waived",
      why: "the same, but at least one assertion needed a valid waiver",
      observation: baseObservation({
        confirmation: { status: "accepted", current: true },
        successorVerified: true,
        evidence: { hasReport: true, complete: true, waivedAny: true, hardGates: [] },
      }),
    },
  ];

  for (const row of rows) {
    assert.equal(stateOf(row.observation), row.state, `${row.state}: ${row.why}`);
  }

  const reached = new Set(rows.map((row) => row.state));
  for (const state of [
    "planned", "provisioning", "active", "validating",
    "awaiting_confirmation", "completed", "waived", "blocked", "cancelled",
  ]) {
    assert.ok(reached.has(state), `no row reaches ${state}`);
  }
});

test("cancellation outranks a hard blocker, and a blocker outranks all progress", () => {
  assert.equal(
    stateOf(baseObservation({ cancelled: true, hardBlockers: [{ code: MC.SNAPSHOT_INVALID, message: "x" }] })),
    "cancelled",
  );
  assert.equal(
    stateOf(baseObservation({
      hardBlockers: [{ code: MC.SNAPSHOT_INVALID, message: "x" }],
      confirmation: { status: "accepted", current: true },
      successorVerified: true,
    })),
    "blocked",
    "an accepted confirmation cannot carry a phase past an open blocker",
  );
});

test("a blocked assertion blocks the phase rather than merely delaying it", () => {
  assert.equal(
    stateOf(baseObservation({
      evidence: {
        hasReport: true, complete: false, waivedAny: false,
        hardGates: [{ code: MC.SNAPSHOT_INVALID, message: "assertion blocked" }],
      },
    })),
    "blocked",
  );
});

/**
 * The counter-design lists rejection after the awaiting_confirmation rule. Read
 * in that order, a rejected confirmation is also "no current accepted
 * confirmation", so the phase would be reported as awaiting one that a human
 * already refused. Rejection is therefore evaluated first.
 */
test("a rejected confirmation returns the phase to active, or blocks on a hard stop", () => {
  assert.equal(stateOf(baseObservation({ confirmation: { status: "rejected" } })), "active");
  assert.equal(
    stateOf(baseObservation({ confirmation: { status: "rejected", hardStop: true } })),
    "blocked",
  );
});

test("a stale or pending confirmation grants nothing", () => {
  for (const status of ["stale", "pending"]) {
    assert.equal(
      stateOf(baseObservation({ confirmation: { status }, successorVerified: true })),
      "awaiting_confirmation",
      `${status} must not complete the phase`,
    );
  }
});

test("an accepted confirmation that is not current grants nothing", () => {
  assert.equal(
    stateOf(baseObservation({
      confirmation: { status: "accepted", current: false },
      successorVerified: true,
    })),
    "awaiting_confirmation",
  );
});

test("a phase never completes before its successor is verified", () => {
  assert.equal(
    stateOf(baseObservation({
      confirmation: { status: "accepted", current: true },
      successorVerified: false,
    })),
    "awaiting_confirmation",
    "failed or partial provisioning must never complete the predecessor",
  );
});

test("the terminal phase needs evidence, a final report, and mission confirmation", () => {
  const terminal = (gates) =>
    baseObservation({
      terminal: true,
      confirmation: { status: "accepted", current: true },
      successorVerified: false,
      terminalGates: gates,
    });

  assert.equal(
    stateOf(terminal({ evidenceCurrent: true, finalReportVerified: true, missionCompletionConfirmed: true })),
    "completed",
  );
  for (const missing of ["evidenceCurrent", "finalReportVerified", "missionCompletionConfirmed"]) {
    const gates = { evidenceCurrent: true, finalReportVerified: true, missionCompletionConfirmed: true };
    gates[missing] = false;
    assert.equal(stateOf(terminal(gates)), "awaiting_confirmation", `missing ${missing} must not complete`);
  }
});

test("a malformed observation fails closed instead of guessing a state", () => {
  for (const bad of [null, {}, baseObservation({ confirmation: { status: "invented" } })]) {
    const outcome = derivePhaseState(bad);
    assert.equal(outcome.ok, false, JSON.stringify(bad));
    assert.ok(outcome.errors.length > 0);
  }
  assert.equal(
    derivePhaseState(baseObservation({ confirmation: { status: "invented" } })).errors[0].code,
    MC.CONFIRMATION_INVALID,
  );
});

test("derivation is deterministic under key permutation", () => {
  const permute = (value) => {
    if (Array.isArray(value)) return value.map(permute);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).reverse().map((k) => [k, permute(value[k])]));
  };
  const observation = baseObservation({ confirmation: { status: "accepted", current: true }, successorVerified: true });
  assert.deepEqual(derivePhaseState(observation), derivePhaseState(permute(observation)));
});
