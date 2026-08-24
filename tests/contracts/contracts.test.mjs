/**
 * Contract fixture tests for Mission Control v1.
 *
 * Valid fixtures must validate. Invalid fixtures must fail with the stable
 * semantic code declared in the sibling expected.json (outside the payload).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  CONTRACT_TYPES,
  validateDocument,
  validatePair,
} from "../../contracts/validator.mjs";
import {
  canonicalJsonStringify,
  sha256Hex,
  transitionKey,
} from "../../contracts/v1/canonical.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const VALID_DIR = join(ROOT, "fixtures", "valid");
const INVALID_DIR = join(ROOT, "fixtures", "invalid");

const FILE_TO_TYPE = {
  "mission-charter.json": "mission-charter",
  "phase-plan.json": "phase-plan",
  "validation-contract.json": "validation-contract",
  "phase-validation-report.json": "phase-validation-report",
  "transition-identity.json": "transition-identity",
};

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}


test("every contract type has a valid fixture and validates", () => {
  for (const type of CONTRACT_TYPES) {
    const file = Object.entries(FILE_TO_TYPE).find(([, t]) => t === type)[0];
    const doc = loadJson(join(VALID_DIR, file));
    assert.deepEqual(validateDocument(type, doc), { valid: true }, type);
  }
});

test("valid validation-contract plus report pass as a pair", () => {
  const contract = loadJson(join(VALID_DIR, "validation-contract.json"));
  const report = loadJson(join(VALID_DIR, "phase-validation-report.json"));
  assert.deepEqual(validatePair(contract, report), { valid: true });
});

test("stable IDs match the bounded kebab-case grammar", () => {
  const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const charter = loadJson(join(VALID_DIR, "mission-charter.json"));
  assert.match(charter.missionId, kebab);
  for (const phase of charter.phases) assert.match(phase.phaseId, kebab);
  for (const item of charter.terminalEvidence) {
    assert.match(item.assertionId, kebab);
  }
});

test("canonical serialization is key-order independent", () => {
  const a = canonicalJsonStringify({ b: 1, a: { y: 2, x: [3, 4] } });
  const b = canonicalJsonStringify({ a: { x: [3, 4], y: 2 }, b: 1 });
  assert.equal(a, b);
});

test("request hash is byte-stable across processes", () => {
  const doc = loadJson(join(VALID_DIR, "transition-identity.json"));
  const recomputed = sha256Hex(
    canonicalJsonStringify(doc.projectCreateRequest),
  );
  assert.equal(recomputed, doc.requestHash);
});

test("transition keys stay within 255 characters", () => {
  const identity = {
    companyId: "c".repeat(200),
    missionId: "m".repeat(60),
    missionGoalId: "g".repeat(200),
    currentPhaseId: "p".repeat(60),
    nextPhaseId: "n".repeat(60),
    nextPhaseLeadAgentId: "a".repeat(200),
    boundPlanRevisionId: "r".repeat(200),
    boundEvidenceRevisionId: "e".repeat(200),
  };
  const key = transitionKey(identity);
  assert.ok(key.length <= 255, `key length ${key.length}`);
  assert.match(key, /^mc1:[a-f0-9]{64}$/);
  assert.notEqual(
    transitionKey({ ...identity, missionGoalId: "h".repeat(200) }),
    key,
    "missionGoalId must contribute to the transition key",
  );
  assert.notEqual(
    transitionKey({ ...identity, nextPhaseLeadAgentId: "b".repeat(200) }),
    key,
    "nextPhaseLeadAgentId must contribute to the transition key",
  );
});
/**
 * The phase plan is intent only. It must never carry derived phase state.
 *
 * A confirmation binds to the exact phase plan revision, and the host expires a
 * pending confirmation when its target document gains a revision. The
 * transition key also binds that revision, and the key is the host idempotency
 * key. A derived-state write would therefore expire a live human confirmation
 * and change the idempotency key, which yields a second project for one phase.
 *
 * See issue #8 and docs/reviews/2026-08-23-canonical-request-divergence.md.
 */
test("the phase plan declares only intent fields", () => {
  const schema = loadJson(
    join(ROOT, "contracts", "v1", "phase-plan.schema.json"),
  );
  const phase = schema.properties.phases.items;
  assert.equal(phase.additionalProperties, false);
  assert.deepEqual(Object.keys(phase.properties).sort(), [
    "objective",
    "phaseId",
    "validationContractRef",
  ]);
  assert.deepEqual([...phase.required].sort(), ["objective", "phaseId"]);
});

test("a phase plan that carries derived state fails closed", () => {
  const plan = loadJson(join(VALID_DIR, "phase-plan.json"));
  for (const field of ["state", "completedAt", "reconciledRevisionId"]) {
    const drifted = JSON.parse(JSON.stringify(plan));
    drifted.phases[0][field] = "completed";
    assert.throws(
      () => validateDocument("phase-plan", drifted),
      (err) => err.code === "MC_SCHEMA_INVALID",
      `phase plan must reject the derived field ${field}`,
    );
  }
});

test("invalid fixtures fail with their declared stable code", async (t) => {
  const entries = readdirSync(INVALID_DIR).sort();
  assert.ok(entries.length >= 7, `expected >=7 invalid fixtures, got ${entries.length}`);
  for (const entry of entries) {
    await t.test(entry, () => {
      const dir = join(INVALID_DIR, entry);
      const expected = loadJson(join(dir, "expected.json"));
      let threw = null;
      try {
        if (expected.type === "pair") {
          validatePair(
            loadJson(join(dir, "validation-contract.json")),
            loadJson(join(dir, "phase-validation-report.json")),
          );
        } else {
          const file = Object.entries(FILE_TO_TYPE).find(
            ([, type]) => type === expected.type,
          )[0];
          validateDocument(expected.type, loadJson(join(dir, file)));
        }
      } catch (err) {
        threw = err;
      }
      assert.ok(threw, `${entry} unexpectedly validated`);
      assert.equal(threw.code, expected.expectedCode);
    });
  }
});


test("canonical request is byte-stable across processes, timezone, and locale", async () => {
  const { execFile } = await import("node:child_process");
  const doc = loadJson(join(VALID_DIR, "transition-identity.json"));
  const script = `
    import("./contracts/v1/canonical.mjs").then(({ canonicalJsonStringify, sha256Hex }) => {
      const doc = JSON.parse(process.argv[1]);
      process.stdout.write(sha256Hex(canonicalJsonStringify(doc.projectCreateRequest)));
    });
  `;
  const run = (env) =>
    new Promise((resolve, reject) => {
      execFile(
        process.execPath,
        ["-e", script, JSON.stringify(doc)],
        { env: { ...process.env, ...env } },
        (err, stdout) => (err ? reject(err) : resolve(stdout)),
      );
    });
  const baseline = await run({});
  assert.equal(baseline, doc.requestHash);
  const shifted = await run({
    TZ: "Pacific/Kiritimati",
    LC_ALL: "de_DE.UTF-8",
    LANG: "de_DE.UTF-8",
    NODE_ICU_DATA: undefined,
  });
  assert.equal(shifted, baseline);
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("pair validation rejects mission or phase identity mismatch", () => {
  const contract = loadJson(join(VALID_DIR, "validation-contract.json"));
  const report = loadJson(join(VALID_DIR, "phase-validation-report.json"));
  const driftedReport = {
    ...report,
    missionId: "other-mission",
    phaseId: "payment",
  };
  assert.throws(
    () => validatePair(contract, driftedReport),
    (err) => err.code === "MC_PAIR_IDENTITY_MISMATCH",
  );
});

test("pair validation rejects assertion results not declared by the contract", () => {
  const contract = loadJson(join(VALID_DIR, "validation-contract.json"));
  const report = loadJson(join(VALID_DIR, "phase-validation-report.json"));
  const extraResult = JSON.parse(JSON.stringify(report));
  extraResult.assertionResults.unshift({
    assertionId: "undeclared-extra-check",
    status: "pass",
    evidenceRefs: ["4f6f3ddc-4635-5b5e-8a80-bb8f1d06682e"],
  });
  assert.throws(
    () => validatePair(contract, extraResult),
    (err) => err.code === "MC_UNKNOWN_ASSERTION_RESULT",
  );
});

test("pair validation rejects a non-UUID waiver approvedBy", () => {
  const contract = loadJson(join(VALID_DIR, "validation-contract.json"));
  const report = loadJson(join(VALID_DIR, "phase-validation-report.json"));
  contract.assertions[1].waiver.approvedBy = "not-a-paperclip-id";
  assert.throws(
    () => validatePair(contract, report),
    (err) => err.code === "MC_SCHEMA_INVALID",
  );
});

test("pair validation rejects a non-UUID waiver approvalEvidenceRef", () => {
  const contract = loadJson(join(VALID_DIR, "validation-contract.json"));
  const report = loadJson(join(VALID_DIR, "phase-validation-report.json"));
  contract.assertions[1].waiver.approvalEvidenceRef = "not-a-paperclip-id";
  assert.throws(
    () => validatePair(contract, report),
    (err) => err.code === "MC_SCHEMA_INVALID",
  );
});

test("paperclip IDs must be lowercase RFC 4122 UUIDs", () => {
  for (const file of Object.keys(FILE_TO_TYPE)) {
    const doc = loadJson(join(VALID_DIR, file));
    const values = [];
    const walk = (node) => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node !== null && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          if (
            typeof value === "string" &&
            [
              "companyId",
              "missionGoalId",
              "nextPhaseLeadAgentId",
              "planRevisionId",
              "reportRevisionId",
              "boundPlanRevisionId",
              "boundEvidenceRevisionId",
              "paperclipUserId",
            ].includes(key)
          ) {
            values.push(value);
          } else if (
            key === "evidenceRefs" ||
            key === "approvalEvidenceRef"
          ) {
            for (const v of [].concat(value)) values.push(v);
          } else {
            walk(value);
          }
        }
      }
    };
    walk(doc);
    assert.ok(values.length > 0, `${file} carries at least one Paperclip ID`);
    for (const value of values) {
      assert.match(value, UUID_RE, `${file} field ${value}`);
    }
  }
});

test("canonical project-create request uses real proposed Paperclip project fields", () => {
  const doc = loadJson(join(VALID_DIR, "transition-identity.json"));
  const expectedKeys = [
    "companyId",
    "name",
    "description",
    "status",
    "goalIds",
    "leadAgentId",
    "idempotencyKey",
  ].sort();
  const actualKeys = Object.keys(doc.projectCreateRequest).sort();
  assert.deepEqual(actualKeys, expectedKeys);
  assert.equal(doc.projectCreateRequest.status, "backlog");
  assert.deepEqual(doc.projectCreateRequest.goalIds, [doc.missionGoalId]);
  assert.equal(doc.projectCreateRequest.leadAgentId, doc.nextPhaseLeadAgentId);
});
