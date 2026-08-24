/**
 * Evidence derivation tests. Milestone 3, slice 2.
 *
 * The deriver reduces a phase's validation contract and report into an
 * evidence result. It never declares completeness it cannot prove.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { derivePhaseOrder, deriveEvidenceState } from "../../contracts/v1/derive-evidence.mjs";
import { MC } from "../../contracts/v1/codes.mjs";
import { validSnapshot } from "./helpers/snapshot-fixture.mjs";

const errorCodes = (outcome) => outcome.errors.map((e) => e.code);

test("phase order comes from the charter", () => {
  const outcome = derivePhaseOrder(validSnapshot());
  assert.equal(outcome.ok, true, JSON.stringify(outcome.errors));
  assert.deepEqual(outcome.value, ["intake", "validation", "payment"]);
});

test("a plan that disagrees with the charter fails closed", () => {
  const cases = [
    {
      name: "a phase the charter never declares",
      mutate: (s) => {
        s.paperclip.phasePlan.body.phases[2].phaseId = "unplanned-phase";
      },
    },
    {
      name: "the same phases in a different order",
      mutate: (s) => {
        const phases = s.paperclip.phasePlan.body.phases;
        [phases[0], phases[1]] = [phases[1], phases[0]];
      },
    },
    {
      name: "a phase the plan omits",
      mutate: (s) => {
        s.paperclip.phasePlan.body.phases.pop();
      },
    },
  ];
  for (const testCase of cases) {
    const snapshot = validSnapshot();
    testCase.mutate(snapshot);
    const outcome = derivePhaseOrder(snapshot);
    assert.equal(outcome.ok, false, testCase.name);
    assert.deepEqual(errorCodes(outcome), [MC.PHASE_SET_MISMATCH], testCase.name);
  }
});

test("a phase with evidence reduces to a complete result", () => {
  const outcome = deriveEvidenceState(validSnapshot(), "validation");
  assert.equal(outcome.ok, true, JSON.stringify(outcome.errors));
  assert.equal(outcome.value.phaseId, "validation");
  assert.equal(outcome.value.contractId, "validation-phase-contract");
  assert.equal(outcome.value.hasReport, true);
  assert.equal(outcome.value.complete, true);
  assert.equal(outcome.value.waivedAny, true, "one assertion is waived in the fixture");
  assert.deepEqual(outcome.value.hardGates, []);
});

test("assertion statuses reduce as the architecture requires", () => {
  const cases = [
    { status: "pass", complete: true, gates: 0, note: "proven by current evidence" },
    { status: "fail", complete: false, gates: 0, note: "incomplete work, not a gate" },
    { status: "blocked", complete: false, gates: 1, note: "a hard gate" },
  ];
  for (const testCase of cases) {
    const snapshot = validSnapshot();
    const results = snapshot.paperclip.evidence[0].validationReport.body.assertionResults;
    results[0].status = testCase.status;
    if (testCase.status !== "pass") delete results[0].evidenceRefs;
    const outcome = deriveEvidenceState(snapshot, "validation");
    assert.equal(outcome.ok, true, `${testCase.status}: ${JSON.stringify(outcome.errors)}`);
    assert.equal(outcome.value.complete, testCase.complete, `${testCase.status} -> ${testCase.note}`);
    assert.equal(outcome.value.hardGates.length, testCase.gates, testCase.status);
  }
});

test("a phase whose plan entry names no contract can never complete", () => {
  const snapshot = validSnapshot();
  delete snapshot.paperclip.phasePlan.body.phases[1].validationContractRef;
  const outcome = deriveEvidenceState(snapshot, "validation");
  assert.equal(outcome.ok, false);
  assert.deepEqual(errorCodes(outcome), [MC.CONTRACT_REFERENCE_MISSING]);
});

test("a contract reference that resolves to nothing fails closed", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.phasePlan.body.phases[1].validationContractRef = "no-such-contract";
  const outcome = deriveEvidenceState(snapshot, "validation");
  assert.equal(outcome.ok, false);
  assert.deepEqual(errorCodes(outcome), [MC.CONTRACT_REFERENCE_MISSING]);
});

test("a phase with no report yet is incomplete rather than broken", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.evidence[0].validationReport = null;
  const outcome = deriveEvidenceState(snapshot, "validation");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.value.hasReport, false);
  assert.equal(outcome.value.complete, false);
});

test("a body whose self-declared revision contradicts the host envelope is stale", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.evidence[0].validationReport.revisionId =
    "11111111-1111-5111-8111-111111111111";
  const outcome = deriveEvidenceState(snapshot, "validation");
  assert.equal(outcome.ok, false);
  assert.deepEqual(errorCodes(outcome), [MC.STALE_EVIDENCE]);
});

test("a waived assertion needs the contract to declare its waiver", () => {
  const snapshot = validSnapshot();
  delete snapshot.paperclip.evidence[0].validationContract.body.assertions[1].waiver;
  const outcome = deriveEvidenceState(snapshot, "validation");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.value.complete, false, "an unbacked waiver cannot prove an assertion");
});

test("an assertion the report never answers cannot be proven", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.evidence[0].validationReport.body.assertionResults.pop();
  const outcome = deriveEvidenceState(snapshot, "validation");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.value.complete, false);
});

test("derivation is deterministic under key permutation", () => {
  const permute = (value) => {
    if (Array.isArray(value)) return value.map(permute);
    if (value === null || typeof value !== "object") return value;
    const keys = Object.keys(value).reverse();
    return Object.fromEntries(keys.map((k) => [k, permute(value[k])]));
  };
  const a = deriveEvidenceState(validSnapshot(), "validation");
  const b = deriveEvidenceState(permute(validSnapshot()), "validation");
  assert.deepEqual(a, b);
});

test("an unknown phase fails closed rather than returning an empty result", () => {
  const outcome = deriveEvidenceState(validSnapshot(), "no-such-phase");
  assert.equal(outcome.ok, false);
  assert.deepEqual(errorCodes(outcome), [MC.SNAPSHOT_INVALID]);
});

test("a phase plan whose self-declared revision contradicts its envelope is stale", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.phasePlan.revisionId = "22222222-2222-5222-8222-222222222222";
  const outcome = deriveEvidenceState(snapshot, "validation");
  assert.equal(outcome.ok, false);
  assert.deepEqual(errorCodes(outcome), [MC.STALE_EVIDENCE]);
});

test("every code used anywhere in contracts is declared in a registry", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = join(import.meta.dirname, "..", "..");

  const sources = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".mjs")) sources.push(full);
    }
  };
  walk(join(root, "contracts"));
  assert.ok(sources.length >= 3, "expected several contract modules");

  const codesIn = (text) => new Set([...text.matchAll(/MC_[A-Z_]+/g)].map((m) => m[0]));
  const declared = new Set([
    ...codesIn(readFileSync(join(root, "contracts", "validator.mjs"), "utf8")),
    ...Object.values(MC),
  ]);
  for (const file of sources) {
    for (const code of codesIn(readFileSync(file, "utf8"))) {
      assert.ok(declared.has(code), `${file} uses ${code}, which no registry declares`);
    }
  }
});
