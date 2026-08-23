import crypto from "node:crypto";

/**
 * Canonical JSON serialization for Mission Control v1 contracts.
 *
 * Rules:
 * - Object keys are sorted by code-unit order at every depth.
 * - Arrays keep their order.
 * - No whitespace between tokens.
 * - Numbers are serialized through JSON.stringify semantics; contract payloads
 *   restrict themselves to strings, arrays, and objects so number formatting
 *   cannot vary between engines.
 */
export function canonicalJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(value[key])}`)
      .join(",")}}`;
  }
  if (typeof value === "string" || typeof value === "boolean" || value === null) {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  throw new TypeError(`Value is not canonical JSON: ${String(value)}`);
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}


/**
 * Deterministic transition key.
 *
 * Bounded to 255 characters. Longer revision sets collapse into a digest of the
 * canonical identity tuple, per the architecture's revision-set rule.
 */
export function transitionKey(identity) {
  const base = [
    "mc1",
    identity.companyId,
    identity.missionId,
    identity.missionGoalId,
    identity.currentPhaseId,
    identity.nextPhaseId,
    identity.nextPhaseLeadAgentId,
    identity.boundPlanRevisionId,
    identity.boundEvidenceRevisionId,
  ].join(":");

  if (base.length <= 255) {
    return base;
  }
  return `mc1:${sha256Hex(base)}`;
}

function kebabToWords(value) {
  return value.split("-").map((word) => {
    return word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word;
  });
}

const REQUEST_KEYS = [
  "companyId",
  "name",
  "description",
  "status",
  "goalIds",
  "leadAgentId",
  "idempotencyKey",
];
/**
 * Pure canonical project-create request.
 *
 * A function of the transition identity only: company, mission, mission goal,
 * current phase, next phase, lead agent, and the bound plan/evidence
 * revisions. ASCII output, no clock, randomness, locale, or ambient defaults.
 */
export function canonicalProjectRequest(identity) {
  const missionWords = kebabToWords(identity.missionId);
  const phaseWords = kebabToWords(identity.nextPhaseId);
  const phaseLabel = phaseWords.join(" ");
  const missionLabel = missionWords.join(" ");
  return {
    companyId: identity.companyId,
    name: `${missionLabel} - ${phaseLabel} Phase`,
    description: `Execution project for the ${phaseLabel} phase of the ${missionLabel} mission.`,
    status: "backlog",
    goalIds: [identity.missionGoalId],
    leadAgentId: identity.nextPhaseLeadAgentId,
    idempotencyKey: transitionKey(identity),
  };
}

export const CANONICAL_REQUEST_KEYS = REQUEST_KEYS;
