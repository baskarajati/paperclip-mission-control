/**
 * Pure evidence derivation for one mission phase.
 *
 * Part of the pure core. It imports only the code registry: no schema
 * validator, no Ajv, no filesystem, no clock, no randomness, no network. The
 * pipeline is schema validation, then snapshot construction, then derivation.
 * That order is deliberately not an import chain.
 *
 * Precondition: the snapshot has passed `validateSnapshotStructure`. Document
 * shape and contract/report pair semantics are already proven. This module
 * performs the reductions that shape cannot express.
 *
 * The governing rule is that the deriver never declares completeness it cannot
 * prove. An assertion counts only when the report answers it and the answer is
 * backed: a pass carries evidence references, and a waiver is declared by the
 * contract with a human approver and approval evidence.
 *
 * Freshness at this milestone means the document body agrees with the host
 * revision that carries it. A body-declared revision is a claim; the envelope
 * is the host's own record, and a confirmation binds the envelope. Proving that
 * each individual evidence artifact is still current needs the contract repair
 * that gives an evidence reference a revision, which is scheduled with the
 * transition work.
 *
 * @typedef {{ code: string, message: string, path: string }} StableDiagnostic
 * @typedef {{ ok: true, value: any } | { ok: false, errors: StableDiagnostic[] }} Outcome
 */
import { MC } from "./codes.mjs";

const ok = (value) => ({ ok: true, value });
const fail = (code, message, path) => ({ ok: false, errors: [{ code, message, path }] });

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Read `envelope.body`, or undefined when the envelope is not usable. */
function bodyOf(envelope) {
  return isObject(envelope) && isObject(envelope.body) ? envelope.body : undefined;
}

/**
 * A body that declares its own revision must agree with the host envelope.
 *
 * Disagreement means the body travelled separately from the revision that
 * carries it, so nothing derived from it can be trusted.
 */
function revisionDisagrees(envelope, declaredField) {
  const body = bodyOf(envelope);
  if (body === undefined) return false;
  const declared = body[declaredField];
  return typeof declared === "string" && declared !== envelope.revisionId;
}

/**
 * The ordered phase identifiers for a mission.
 *
 * The charter is the order authority, because the architecture ratifies that
 * the charter names ordered phases. The plan must agree exactly, in identity
 * and in order. Disagreement fails closed: nothing can tell which document
 * describes the mission.
 *
 * @param {object} snapshot
 * @returns {Outcome}
 */
export function derivePhaseOrder(snapshot) {
  const charter = bodyOf(snapshot?.paperclip?.charter);
  const plan = bodyOf(snapshot?.paperclip?.phasePlan);
  if (charter === undefined || plan === undefined) {
    return fail(MC.SNAPSHOT_INVALID, "charter and phase plan bodies are required", "paperclip");
  }

  const charterPhases = charter.phases.map((phase) => phase.phaseId);
  const planPhases = plan.phases.map((phase) => phase.phaseId);
  if (charterPhases.join(">") !== planPhases.join(">")) {
    return fail(
      MC.PHASE_SET_MISMATCH,
      `charter declares [${charterPhases.join(", ")}] but the plan declares [${planPhases.join(", ")}]`,
      "paperclip.phasePlan",
    );
  }
  return ok(charterPhases);
}

/** Reduce one contract assertion against the report result that answers it. */
function reduceAssertion(assertion, result) {
  const base = { assertionId: assertion.assertionId, status: result?.status ?? "unanswered" };
  if (result === undefined) {
    return { ...base, proven: false, waived: false, gate: false, note: "the report answers nothing here" };
  }
  switch (result.status) {
    case "pass":
      return {
        ...base,
        proven: Array.isArray(result.evidenceRefs) && result.evidenceRefs.length > 0,
        waived: false,
        gate: false,
        note: "a pass must cite evidence",
      };
    case "waived": {
      const waiver = assertion.waiver;
      const backed = Boolean(waiver?.approvedBy && waiver?.approvalEvidenceRef);
      return {
        ...base,
        proven: backed,
        waived: backed,
        gate: false,
        note: "a waiver needs a human approver and approval evidence declared by the contract",
      };
    }
    case "blocked":
      return { ...base, proven: false, waived: false, gate: true, note: "a blocked assertion is a hard gate" };
    default:
      // "fail" is incomplete work rather than a governance stop.
      return { ...base, proven: false, waived: false, gate: false, note: "incomplete work" };
  }
}

/**
 * Derive the evidence state of one phase.
 *
 * Returns `ok: false` when the evidence cannot be read at all: the phase is
 * unknown, no contract resolves, or a document contradicts its host revision.
 * Returns `ok: true` with `complete: false` for the ordinary case of work that
 * is simply not finished.
 *
 * @param {object} snapshot A snapshot that already passed structural validation.
 * @param {string} phaseId
 * @returns {Outcome}
 */
export function deriveEvidenceState(snapshot, phaseId) {
  const order = derivePhaseOrder(snapshot);
  if (!order.ok) return order;
  if (!order.value.includes(phaseId)) {
    return fail(MC.SNAPSHOT_INVALID, `phase ${phaseId} is not part of this mission`, "paperclip.phasePlan");
  }

  const planEnvelope = snapshot.paperclip.phasePlan;
  if (revisionDisagrees(planEnvelope, "planRevisionId")) {
    return fail(
      MC.STALE_EVIDENCE,
      "the phase plan declares a revision the host envelope does not carry",
      "paperclip.phasePlan",
    );
  }

  const planEntry = bodyOf(planEnvelope).phases.find((phase) => phase.phaseId === phaseId);
  const contractRef = planEntry.validationContractRef;
  if (typeof contractRef !== "string" || contractRef.length === 0) {
    return fail(
      MC.CONTRACT_REFERENCE_MISSING,
      `phase ${phaseId} names no validation contract, so it can never complete`,
      "paperclip.phasePlan",
    );
  }

  const evidence = snapshot.paperclip.evidence ?? [];
  const index = evidence.findIndex((entry) => {
    const contract = bodyOf(entry?.validationContract);
    return contract?.contractId === contractRef && contract?.phaseId === phaseId;
  });
  if (index === -1) {
    return fail(
      MC.CONTRACT_REFERENCE_MISSING,
      `no validation contract in the snapshot answers to ${contractRef} for phase ${phaseId}`,
      "paperclip.evidence",
    );
  }

  const entry = evidence[index];
  const contract = bodyOf(entry.validationContract);
  const hasReport = entry.validationReport != null;

  if (hasReport && revisionDisagrees(entry.validationReport, "reportRevisionId")) {
    return fail(
      MC.STALE_EVIDENCE,
      "the validation report declares a revision the host envelope does not carry",
      `paperclip.evidence[${index}].validationReport`,
    );
  }

  const results = new Map(
    hasReport
      ? bodyOf(entry.validationReport).assertionResults.map((r) => [r.assertionId, r])
      : [],
  );
  const assertions = contract.assertions.map((assertion) =>
    reduceAssertion(assertion, results.get(assertion.assertionId)),
  );

  const hardGates = assertions
    .filter((assertion) => assertion.gate)
    .map((assertion) => ({
      code: MC.SNAPSHOT_INVALID,
      message: `assertion ${assertion.assertionId} is blocked`,
      path: `paperclip.evidence[${index}]`,
    }));

  return ok({
    phaseId,
    contractId: contract.contractId,
    hasReport,
    assertions,
    waivedAny: assertions.some((assertion) => assertion.waived),
    complete: hasReport && hardGates.length === 0 && assertions.every((a) => a.proven),
    hardGates,
  });
}
