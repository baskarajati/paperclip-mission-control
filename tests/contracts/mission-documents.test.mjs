/**
 * Mission document-set tests for Milestone 3, slice 1.
 *
 * The document set is the deriver's front door. It validates every document a
 * mission snapshot carries, and it pairs each phase validation contract with
 * its report. It introduces no error code of its own: every failure surfaces a
 * code that contracts/validator.mjs already owns.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateMissionDocuments } from "../../contracts/mission-documents.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const VALID_DIR = join(ROOT, "fixtures", "valid");

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validDocumentSet() {
  return {
    charter: loadJson(join(VALID_DIR, "mission-charter.json")),
    phasePlan: loadJson(join(VALID_DIR, "phase-plan.json")),
    phaseEvidence: [
      {
        validationContract: loadJson(join(VALID_DIR, "validation-contract.json")),
        validationReport: loadJson(join(VALID_DIR, "phase-validation-report.json")),
      },
    ],
  };
}

test("a complete valid document set validates", () => {
  assert.deepEqual(validateMissionDocuments(validDocumentSet()), { valid: true });
});

test("a phase without a report is legal; the contract alone still validates", () => {
  const set = validDocumentSet();
  set.phaseEvidence[0].validationReport = null;
  assert.deepEqual(validateMissionDocuments(set), { valid: true });
});

test("a mission with no phase evidence yet validates", () => {
  const set = validDocumentSet();
  set.phaseEvidence = [];
  assert.deepEqual(validateMissionDocuments(set), { valid: true });
});

test("each malformed document surfaces the code its own contract already owns", () => {
  const cases = [
    {
      name: "charter with an unknown schema version",
      mutate: (set) => {
        set.charter.schemaVersion = 2;
      },
      code: "MC_SCHEMA_VERSION_UNSUPPORTED",
    },
    {
      name: "phase plan carrying derived state",
      mutate: (set) => {
        set.phasePlan.phases[0].state = "active";
      },
      code: "MC_SCHEMA_INVALID",
    },
    {
      name: "report claiming an assertion the contract never declared",
      mutate: (set) => {
        set.phaseEvidence[0].validationReport.assertionResults.push({
          assertionId: "never-declared",
          status: "pass",
          evidenceRefs: ["4f6f3ddc-4635-5b5e-8a80-bb8f1d06682e"],
        });
      },
      code: "MC_UNKNOWN_ASSERTION_RESULT",
    },
    {
      name: "report belonging to a different phase than its contract",
      mutate: (set) => {
        set.phaseEvidence[0].validationReport.phaseId = "payment";
      },
      code: "MC_PAIR_IDENTITY_MISMATCH",
    },
  ];

  for (const testCase of cases) {
    const set = validDocumentSet();
    testCase.mutate(set);
    assert.throws(
      () => validateMissionDocuments(set),
      (err) => err.code === testCase.code,
      `${testCase.name} must fail with ${testCase.code}`,
    );
  }
});

test("the document set introduces no error code of its own", () => {
  const read = (relative) => readFileSync(join(ROOT, relative), "utf8");
  const codesIn = (source) => new Set([...source.matchAll(/MC_[A-Z_]+/g)].map((m) => m[0]));
  const owned = codesIn(read("contracts/validator.mjs"));
  const used = codesIn(read("contracts/mission-documents.mjs"));
  assert.ok(owned.size > 0, "the validator must declare the code vocabulary");
  const invented = [...used].filter((code) => !owned.has(code));
  assert.deepEqual(
    invented,
    [],
    `every code must already be owned by contracts/validator.mjs, invented: ${invented.join(", ")}`,
  );
});

/**
 * Determinism guard. A derivation module must not read a clock, randomness,
 * ambient environment, or the network. Reading a static schema file at module
 * load stays allowed, and only contracts/validator.mjs does that.
 */
test("derivation modules read no clock, randomness, environment, or network", () => {
  const modules = ["contracts/v1/canonical.mjs", "contracts/mission-documents.mjs"];
  const forbidden = [
    /\bDate\b/,
    /Math\.random/,
    /process\.env/,
    /\bfetch\s*\(/,
    /node:net/,
    /node:http/,
    /node:dns/,
  ];
  for (const relative of modules) {
    const source = readFileSync(join(ROOT, relative), "utf8");
    for (const pattern of forbidden) {
      assert.ok(
        !pattern.test(source),
        `${relative} must not reference ${pattern}`,
      );
    }
  }
});
