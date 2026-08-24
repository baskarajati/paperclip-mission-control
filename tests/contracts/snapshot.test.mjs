/**
 * Normalized mission snapshot tests. Milestone 3, slice 1.
 *
 * The snapshot is the boundary between Paperclip and pure derivation. It is
 * validated structurally before any state is derived from it, because deriving
 * from unvalidated input fails open.
 *
 * Two properties matter more than the individual cases. Every defect is
 * reported at once, because an operator surface must not reveal one problem per
 * attempt. And every document travels in its host revision envelope, because a
 * confirmation binds a document key, a revision ID, and a revision number.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { validateSnapshotStructure, SNAPSHOT_CODES } from "../../contracts/snapshot.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const VALID_DIR = join(ROOT, "fixtures", "valid");

const loadJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** A document revision envelope around a canonical fixture body. */
function envelope(documentKey, revisionId, revisionNumber, body) {
  return {
    documentKey,
    issueId: "0d1e3f9a-6b52-53f1-9c4a-1f2b3c4d5e6f",
    revisionId,
    revisionNumber,
    body,
  };
}

function validSnapshot() {
  const charter = loadJson(join(VALID_DIR, "mission-charter.json"));
  const phasePlan = loadJson(join(VALID_DIR, "phase-plan.json"));
  const contract = loadJson(join(VALID_DIR, "validation-contract.json"));
  const report = loadJson(join(VALID_DIR, "phase-validation-report.json"));
  return {
    schemaVersion: 1,
    paperclip: {
      companyId: "892939c1-04f2-5de3-8a00-0830f676c226",
      missionGoalId: "3a0c77ec-db9a-5f00-a5a0-381ccc3711a6",
      charter: envelope("mission-charter", "694ff4bb-73ee-54e9-b6ec-50e57bf88bb4", 3, charter),
      phasePlan: envelope("phase-plan", "694ff4bb-73ee-54e9-b6ec-50e57bf88bb4", 3, phasePlan),
      evidence: [
        {
          validationContract: envelope(
            "phase-validation-contract",
            "06a9491d-ec54-504d-a14b-c8de9996ab82",
            1,
            contract,
          ),
          validationReport: envelope(
            "phase-validation-report",
            "509a5bf9-2ac6-5bee-8335-1cfa4304de65",
            2,
            report,
          ),
        },
      ],
    },
    operations: { transition: null, phaseBindings: [] },
  };
}

test("a well formed snapshot validates", () => {
  const outcome = validateSnapshotStructure(validSnapshot());
  assert.equal(outcome.ok, true, JSON.stringify(outcome.errors));
});

test("a phase with no report yet is legal", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.evidence[0].validationReport = null;
  assert.equal(validateSnapshotStructure(snapshot).ok, true);
});

test("a mission with no evidence yet is legal", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.evidence = [];
  assert.equal(validateSnapshotStructure(snapshot).ok, true);
});

test("a document without its host revision envelope fails closed", () => {
  for (const field of ["documentKey", "revisionId", "revisionNumber"]) {
    const snapshot = validSnapshot();
    delete snapshot.paperclip.charter[field];
    const outcome = validateSnapshotStructure(snapshot);
    assert.equal(outcome.ok, false, `missing ${field} must fail`);
    assert.ok(
      outcome.errors.some(
        (e) => e.code === "MC_SNAPSHOT_INVALID" && e.path === "paperclip.charter",
      ),
      `missing ${field} must be reported at paperclip.charter, got ${JSON.stringify(outcome.errors)}`,
    );
  }
});

test("a revision number that is not a positive integer fails closed", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.phasePlan.revisionNumber = 0;
  const outcome = validateSnapshotStructure(snapshot);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.errors[0].code, "MC_SNAPSHOT_INVALID");
});

test("a malformed document body surfaces the code its own contract owns", () => {
  const cases = [
    {
      name: "charter with an unknown schema version",
      mutate: (s) => {
        s.paperclip.charter.body.schemaVersion = 2;
      },
      code: "MC_SCHEMA_VERSION_UNSUPPORTED",
      path: "paperclip.charter",
    },
    {
      name: "phase plan carrying derived state",
      mutate: (s) => {
        s.paperclip.phasePlan.body.phases[0].state = "active";
      },
      code: "MC_SCHEMA_INVALID",
      path: "paperclip.phasePlan",
    },
    {
      name: "report claiming an undeclared assertion",
      mutate: (s) => {
        s.paperclip.evidence[0].validationReport.body.assertionResults.push({
          assertionId: "never-declared",
          status: "pass",
          evidenceRefs: ["4f6f3ddc-4635-5b5e-8a80-bb8f1d06682e"],
        });
      },
      code: "MC_UNKNOWN_ASSERTION_RESULT",
      path: "paperclip.evidence[0]",
    },
    {
      name: "report belonging to another phase",
      mutate: (s) => {
        s.paperclip.evidence[0].validationReport.body.phaseId = "payment";
      },
      code: "MC_PAIR_IDENTITY_MISMATCH",
      path: "paperclip.evidence[0]",
    },
  ];
  for (const testCase of cases) {
    const snapshot = validSnapshot();
    testCase.mutate(snapshot);
    const outcome = validateSnapshotStructure(snapshot);
    assert.equal(outcome.ok, false, testCase.name);
    assert.ok(
      outcome.errors.some(
        (e) => e.code === testCase.code && e.path === testCase.path,
      ),
      `${testCase.name} must report ${testCase.code} at ${testCase.path}, got ${JSON.stringify(outcome.errors)}`,
    );
  }
});

test("every defect is reported at once, not one per attempt", () => {
  const snapshot = validSnapshot();
  snapshot.paperclip.charter.body.schemaVersion = 2;
  snapshot.paperclip.phasePlan.body.phases[0].state = "active";
  delete snapshot.paperclip.evidence[0].validationContract.revisionId;
  const outcome = validateSnapshotStructure(snapshot);
  assert.equal(outcome.ok, false);
  assert.equal(
    outcome.errors.length,
    3,
    `expected three diagnostics, got ${JSON.stringify(outcome.errors)}`,
  );
  const paths = outcome.errors.map((e) => e.path).sort();
  assert.deepEqual(paths, [
    "paperclip.charter",
    "paperclip.evidence[0].validationContract",
    "paperclip.phasePlan",
  ]);
});

test("a snapshot missing its identity domain fails closed without throwing", () => {
  for (const snapshot of [null, {}, { schemaVersion: 1 }, { schemaVersion: 2, paperclip: {} }]) {
    const outcome = validateSnapshotStructure(snapshot);
    assert.equal(outcome.ok, false);
    assert.ok(outcome.errors.length > 0);
  }
});

test("slice 1 declares exactly one new code and collides with none", () => {
  const read = (relative) => readFileSync(join(ROOT, relative), "utf8");
  const codesIn = (src) => new Set([...src.matchAll(/MC_[A-Z_]+/g)].map((m) => m[0]));
  const owned = codesIn(read("contracts/validator.mjs"));
  assert.ok(owned.size > 0, "the validator must declare the base vocabulary");

  assert.deepEqual(Object.values(SNAPSHOT_CODES), ["MC_SNAPSHOT_INVALID"]);
  for (const code of Object.values(SNAPSHOT_CODES)) {
    assert.ok(!owned.has(code), `${code} already exists in the validator`);
  }
  const undeclared = [...codesIn(read("contracts/snapshot.mjs"))].filter(
    (code) => !owned.has(code) && !Object.values(SNAPSHOT_CODES).includes(code),
  );
  assert.deepEqual(undeclared, [], `codes used but never declared: ${undeclared}`);
});

/**
 * The pure core is every module under contracts/v1. The list is read from disk
 * so a module added later cannot escape the guard by not being listed here.
 */
test("the pure core reads no clock, randomness, environment, or network", () => {
  const dir = join(ROOT, "contracts", "v1");
  const modules = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
  assert.ok(modules.length > 0, "the pure core must contain at least one module");
  const forbidden = [/\bDate\b/, /Math\.random/, /process\.env/, /\bfetch\s*\(/, /node:net/, /node:http/, /node:dns/];
  for (const file of modules) {
    const source = readFileSync(join(dir, file), "utf8");
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(source), `contracts/v1/${file} must not reference ${pattern}`);
    }
  }
});

test("the pure core imports neither the schema validator nor the filesystem", () => {
  const dir = join(ROOT, "contracts", "v1");
  // Match import specifiers only. A comment that names a module is prose, not a
  // dependency, and a guard that cannot tell the difference gets weakened later.
  const specifiers = (source) => [
    ...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".mjs"))) {
    const found = specifiers(readFileSync(join(dir, file), "utf8"));
    for (const specifier of found) {
      assert.ok(
        !/validator\.mjs$|^ajv|node:fs/.test(specifier),
        `contracts/v1/${file} imports ${specifier}; validation runs before derivation, never inside it`,
      );
    }
  }
});

test("the snapshot boundary reads no clock, randomness, environment, or network", () => {
  const source = readFileSync(join(ROOT, "contracts", "snapshot.mjs"), "utf8");
  for (const pattern of [/\bDate\b/, /Math\.random/, /process\.env/, /\bfetch\s*\(/, /node:net/]) {
    assert.ok(!pattern.test(source), `contracts/snapshot.mjs must not reference ${pattern}`);
  }
});
