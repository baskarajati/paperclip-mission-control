/**
 * The normalized mission snapshot: the boundary between Paperclip and pure
 * derivation.
 *
 * Pipeline order is schema validation, then snapshot construction, then pure
 * derivation. That order is not an import chain. The pure core under
 * `contracts/v1/` never imports this module or the schema validator, because
 * validation runs before derivation and never inside it.
 *
 * Two properties drive the shape.
 *
 * Every document travels in its host revision envelope. A human confirmation
 * binds a document key, a revision ID, and a revision number, and the host
 * expires that confirmation when the target document gains a revision. A bare
 * document body cannot express any of that, and a body-declared revision
 * identifier is a claim rather than the host's own envelope.
 *
 * Paperclip facts and plugin observations stay in separate domains.
 * `paperclip` is business truth. `operations` holds plugin observations that
 * may explain an in-flight transition. An observation never turns incomplete
 * Paperclip evidence into success.
 *
 * Structural validation returns every defect at once. An operator surface must
 * not reveal one problem per attempt.
 *
 * @typedef {object} StableDiagnostic
 * @property {string} code A stable code, either one this module declares or one
 *   `contracts/validator.mjs` already owns.
 * @property {string} message Human-readable detail.
 * @property {string} path Where the defect sits, such as `paperclip.charter`.
 *
 * @typedef {{ ok: true, value: object } | { ok: false, errors: StableDiagnostic[] }} Outcome
 *
 * @typedef {object} DocumentRevision
 * @property {string} documentKey The host document key.
 * @property {string} issueId The issue the document hangs from.
 * @property {string} revisionId The host revision identifier.
 * @property {number} revisionNumber A positive integer from the host.
 * @property {object} body The document payload, validated against its contract.
 *
 * @typedef {object} PhaseEvidence
 * @property {DocumentRevision} validationContract
 * @property {DocumentRevision|null} [validationReport] Absent until the phase
 *   produces a report. That is a normal early state, not a defect.
 *
 * @typedef {object} MissionSnapshot
 * @property {1} schemaVersion
 * @property {object} paperclip Business truth read from the host.
 * @property {object} operations Plugin observations. Never business authority.
 */
import { validateDocument, validatePair } from "./validator.mjs";
import { MC } from "./v1/codes.mjs";

/**
 * Codes this boundary reports. They live in the shared registry so one
 * vocabulary serves the boundary and the pure core.
 */
export const SNAPSHOT_CODES = Object.freeze({
  SNAPSHOT_INVALID: MC.SNAPSHOT_INVALID,
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Check one host revision envelope and, when it is sound, its body.
 *
 * A broken envelope suppresses body validation for that document. Reporting
 * both would describe one defect twice.
 */
function checkDocument(envelope, contractType, path, report) {
  if (!isObject(envelope)) {
    report(path, "document revision envelope is missing");
    return;
  }
  for (const field of ["documentKey", "issueId", "revisionId"]) {
    if (typeof envelope[field] !== "string" || envelope[field].length === 0) {
      report(path, `document revision envelope needs a ${field}`);
      return;
    }
  }
  if (!Number.isInteger(envelope.revisionNumber) || envelope.revisionNumber < 1) {
    report(path, "revisionNumber must be a positive integer issued by the host");
    return;
  }
  if (!isObject(envelope.body)) {
    report(path, "document revision envelope needs a body");
    return;
  }
  try {
    validateDocument(contractType, envelope.body);
  } catch (err) {
    report(path, err.message, err.code);
  }
}

/**
 * Validate the structure of a normalized mission snapshot.
 *
 * Returns every defect at once. Returns `{ ok: true, value }` when the snapshot
 * is structurally sound. This proves shape only. Cross-document reconciliation,
 * such as a plan phase the charter never declares, belongs to the derivation
 * core.
 *
 * @param {MissionSnapshot} snapshot
 * @returns {Outcome}
 */
export function validateSnapshotStructure(snapshot) {
  /** @type {StableDiagnostic[]} */
  const errors = [];
  const report = (path, message, code = SNAPSHOT_CODES.SNAPSHOT_INVALID) =>
    errors.push({ code, message, path });

  if (!isObject(snapshot)) {
    report("", "snapshot must be an object");
    return { ok: false, errors };
  }
  if (snapshot.schemaVersion !== 1) {
    report("schemaVersion", "snapshot schemaVersion must be exactly 1");
  }
  if (!isObject(snapshot.paperclip)) {
    report("paperclip", "snapshot needs a paperclip domain");
    return { ok: false, errors };
  }

  const host = snapshot.paperclip;
  for (const field of ["companyId", "missionGoalId"]) {
    if (typeof host[field] !== "string" || host[field].length === 0) {
      report(`paperclip.${field}`, `snapshot needs a ${field}`);
    }
  }

  checkDocument(host.charter, "mission-charter", "paperclip.charter", report);
  checkDocument(host.phasePlan, "phase-plan", "paperclip.phasePlan", report);

  const evidence = host.evidence ?? [];
  if (!Array.isArray(evidence)) {
    report("paperclip.evidence", "evidence must be a list");
    return { ok: false, errors };
  }

  evidence.forEach((entry, index) => {
    const base = `paperclip.evidence[${index}]`;
    if (!isObject(entry)) {
      report(base, "evidence entry must be an object");
      return;
    }
    const before = errors.length;
    checkDocument(
      entry.validationContract,
      "validation-contract",
      `${base}.validationContract`,
      report,
    );
    if (entry.validationReport != null) {
      checkDocument(
        entry.validationReport,
        "phase-validation-report",
        `${base}.validationReport`,
        report,
      );
    }
    // Pair semantics need both documents intact, and the failure belongs to the
    // pair rather than to either document alone.
    if (errors.length === before && entry.validationReport != null) {
      try {
        validatePair(entry.validationContract.body, entry.validationReport.body);
      } catch (err) {
        report(base, err.message, err.code);
      }
    }
  });

  if (!isObject(snapshot.operations)) {
    report("operations", "snapshot needs an operations domain, even when empty");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: snapshot };
}
