/**
 * Executable semantic validation for Mission Control v1 contracts.
 *
 * Schema validation uses Ajv (JSON Schema Draft 2020-12). Semantic rules that
 * JSON Schema cannot express are checked here and return stable error codes:
 *
 * - MC_SCHEMA_VERSION_UNSUPPORTED
 * - MC_DUPLICATE_STABLE_ID
 * - MC_MISSING_ASSERTION_EVIDENCE
 * - MC_UNKNOWN_ASSERTION_RESULT
 * - MC_WAIVER_APPROVAL_MISSING
 * - MC_PAIR_IDENTITY_MISMATCH
 * - MC_REQUEST_HASH_MISMATCH
 * - MC_TRANSITION_KEY_TOO_LONG
 * - MC_NON_CANONICAL_REQUEST
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import {
  CANONICAL_REQUEST_KEYS,
  canonicalJsonStringify,
  canonicalProjectRequest,
  sha256Hex,
} from "./v1/canonical.mjs";

const ajv = new Ajv({ allErrors: true, strict: false });
const contractsDir = join(dirname(fileURLToPath(import.meta.url)), "v1");
for (const file of ["common", "mission-charter", "phase-plan", "validation-contract", "phase-validation-report", "transition-identity"]) {
  const schema = JSON.parse(readFileSync(join(contractsDir, `${file}.schema.json`), "utf8"));
  ajv.addSchema(schema, file);
}

function compile(name) {
  return ajv.getSchema(name);
}

const validators = {
  "mission-charter": compile("mission-charter"),
  "phase-plan": compile("phase-plan"),
  "validation-contract": compile("validation-contract"),
  "phase-validation-report": compile("phase-validation-report"),
  "transition-identity": compile("transition-identity"),
};

export const CONTRACT_TYPES = Object.keys(validators);

class SemanticError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SemanticError";
    this.code = code;
  }
}

function requireSchemaVersion1(doc) {
  if (!doc || typeof doc !== "object" || doc.schemaVersion !== 1) {
    throw new SemanticError(
      "MC_SCHEMA_VERSION_UNSUPPORTED",
      "schemaVersion must be exactly 1",
    );
  }
}

function collectStableIds(doc) {
  const ids = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node !== null && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (
          (key === "missionId" ||
            key === "phaseId" ||
            key === "assertionId" ||
            key === "waiverId" ||
            key === "contractId") &&
          typeof value === "string"
        ) {
          ids.push(value);
        }
        walk(value);
      }
    }
  };
  walk(doc);
  return ids;
}

function checkDuplicateStableIds(doc) {
  const seen = new Map();
  for (const id of collectStableIds(doc)) {
    if (seen.has(id)) {
      throw new SemanticError(
        "MC_DUPLICATE_STABLE_ID",
        `stable domain ID reused within document: ${id}`,
      );
    }
    seen.set(id, true);
  }
}

/**
 * A report belongs to exactly one contract: mission ID and phase ID must be
 * equal on both documents. Every assertion result must map to an assertion the
 * contract declares. Missing evidence fails closed, waivers require explicit
 * human approval evidence.
 */
export function validatePair(contract, report) {
  requireSchemaVersion1(contract);
  requireSchemaVersion1(report);

  if (
    contract.missionId !== report.missionId ||
    contract.phaseId !== report.phaseId
  ) {
    throw new SemanticError(
      "MC_PAIR_IDENTITY_MISMATCH",
      `contract is (${contract.missionId}, ${contract.phaseId}) but report is (${report.missionId}, ${report.phaseId})`,
    );
  }

  const contractSchemaValid = validators["validation-contract"](contract);
  const reportSchemaValid = validators["phase-validation-report"](report);

  // Semantic checks run first so fixtures with a semantic defect get the
  // stable semantic code even when the payload also fails schema shape.
  if (contractSchemaValid && reportSchemaValid) {
    checkDuplicateStableIds(contract);
    checkDuplicateStableIds(report);
  }

  if (!contractSchemaValid || !reportSchemaValid) {
    throw new SemanticError(
      "MC_SCHEMA_INVALID",
      `pair failed schema: ${!contractSchemaValid ? "validation-contract" : ""}${!contractSchemaValid && !reportSchemaValid ? " + " : ""}${!reportSchemaValid ? "phase-validation-report" : ""}`,
    );
  }

  const declared = new Set(
    contract.assertions.map((assertion) => assertion.assertionId),
  );
  const results = new Map();
  for (const r of report.assertionResults) {
    if (!declared.has(r.assertionId)) {
      throw new SemanticError(
        "MC_UNKNOWN_ASSERTION_RESULT",
        `assertion ${r.assertionId} is not declared by validation-contract ${contract.contractId}`,
      );
    }
    if (results.has(r.assertionId)) {
      throw new SemanticError(
        "MC_DUPLICATE_STABLE_ID",
        `duplicate assertion result: ${r.assertionId}`,
      );
    }
    results.set(r.assertionId, r);
  }

  for (const assertion of contract.assertions) {
    const result = results.get(assertion.assertionId);
    if (!result) {
      throw new SemanticError(
        "MC_MISSING_ASSERTION_EVIDENCE",
        `no report evidence for assertion ${assertion.assertionId}`,
      );
    }
    if (result.status === "waived") {
      if (!assertion.waiver) {
        throw new SemanticError(
          "MC_WAIVER_APPROVAL_MISSING",
          `assertion ${assertion.assertionId} is waived without a waiver record`,
        );
      }
      if (
        !assertion.waiver.approvalEvidenceRef ||
        !assertion.waiver.approvedBy
      ) {
        throw new SemanticError(
          "MC_WAIVER_APPROVAL_MISSING",
          `waiver for ${assertion.assertionId} lacks explicit human approval evidence`,
        );
      }
    } else {
      const refs = Array.isArray(result.evidenceRefs)
        ? result.evidenceRefs
        : [];
      if (refs.length === 0 && result.status === "pass") {
        throw new SemanticError(
          "MC_MISSING_ASSERTION_EVIDENCE",
          `passing assertion ${assertion.assertionId} has no evidence references`,
        );
      }
    }
  }
  return { valid: true };
}

export function validateDocument(type, doc) {
  requireSchemaVersion1(doc);

  const validate = validators[type];
  if (!validate) {
    throw new SemanticError("MC_UNKNOWN_CONTRACT", `unknown contract type ${type}`);
  }

  // Transition-key length is a bounded-grammar semantic rule; report it even
  // when the oversized key also breaks the schema maxLength.
  if (
    type === "transition-identity" &&
    typeof doc.transitionKey === "string" &&
    doc.transitionKey.length > 255
  ) {
    throw new SemanticError(
      "MC_TRANSITION_KEY_TOO_LONG",
      "transition key exceeds 255 characters",
    );
  }
  // Canonical-request determinism is a semantic rule; report it even when a
  // nondeterministic or drifted field also breaks the schema shape.
  if (type === "transition-identity" && doc.projectCreateRequest) {
    const request = doc.projectCreateRequest;
    const identity = {
      companyId: doc.companyId,
      missionId: doc.missionId,
      missionGoalId: doc.missionGoalId,
      currentPhaseId: doc.currentPhaseId,
      nextPhaseId: doc.nextPhaseId,
      nextPhaseLeadAgentId: doc.nextPhaseLeadAgentId,
      boundPlanRevisionId: doc.boundPlanRevisionId,
      boundEvidenceRevisionId: doc.boundEvidenceRevisionId,
    };
    const expected = canonicalProjectRequest(identity);
    const actualKeys = Object.keys(request).sort();
    if (
      actualKeys.join(",") !== [...CANONICAL_REQUEST_KEYS].sort().join(",")
    ) {
      throw new SemanticError(
        "MC_NON_CANONICAL_REQUEST",
        "project-create request fields are not the exact canonical field set",
      );
    }
    for (const key of CANONICAL_REQUEST_KEYS) {
      if (
        JSON.stringify(request[key]) !== JSON.stringify(expected[key])
      ) {
        throw new SemanticError(
          "MC_NON_CANONICAL_REQUEST",
          `project-create request is not the canonical derivation of company, mission, goal, phase, lead, and evidence revisions (field: ${key})`,
        );
      }
    }
  }

  if (!validate(doc)) {
    throw new SemanticError(
      "MC_SCHEMA_INVALID",
      `${type} failed schema: ${ajv.errorsText(validate.errors)}`,
    );
  }

  checkDuplicateStableIds(doc);
  if (type === "transition-identity") {
    validateTransitionIdentitySemantics(doc);
  }
  return { valid: true };
}

export function validateTransitionIdentitySemantics(doc) {
  const request = doc.projectCreateRequest;
  if (request.companyId !== doc.companyId) {
    throw new SemanticError(
      "MC_NON_CANONICAL_REQUEST",
      "request companyId does not match transition companyId",
    );
  }
  if (request.idempotencyKey !== doc.transitionKey) {
    throw new SemanticError(
      "MC_NON_CANONICAL_REQUEST",
      "idempotencyKey must equal the transition key",
    );
  }
  const recomputed = sha256Hex(canonicalJsonStringify(request));
  if (recomputed !== doc.requestHash) {
    throw new SemanticError(
      "MC_REQUEST_HASH_MISMATCH",
      "requestHash does not match the canonical request payload",
    );
  }
  return { valid: true };
}
