/**
 * The mission document set: the front door of Milestone 3 derivation.
 *
 * A mission snapshot carries the Paperclip documents that govern one mission.
 * This module proves every one of them is well formed before any state is
 * derived from it. Derivation on an unvalidated document would fail open.
 *
 * Scope. This module validates documents and pairs. It performs no
 * cross-document reconciliation, so it declares no error code of its own:
 * every failure carries a code that `contracts/validator.mjs` already owns.
 * Cross-document rules, such as a plan phase the charter never declares or a
 * `validationContractRef` that resolves to nothing, need new codes and arrive
 * with the derivation core.
 *
 * Phase identity is read from the validation contract. The document set never
 * repeats a phase identifier beside the document that already carries it,
 * because two copies of one fact can disagree.
 *
 * @typedef {object} PhaseEvidence
 * @property {object} validationContract A `validation-contract` document.
 * @property {object|null} [validationReport] A `phase-validation-report`
 *   document, or null while the phase has produced no report yet.
 *
 * @typedef {object} MissionDocumentSet
 * @property {object} charter A `mission-charter` document.
 * @property {object} phasePlan A `phase-plan` document.
 * @property {PhaseEvidence[]} [phaseEvidence] Evidence per phase, in any
 *   order. A mission that has produced no evidence yet supplies an empty list.
 */
import { validateDocument, validatePair } from "./validator.mjs";

/**
 * Validate every document in a mission document set.
 *
 * Throws the first failure, carrying the stable code its own contract defines.
 * Returns `{ valid: true }` when every document and every pair is sound.
 *
 * @param {MissionDocumentSet} documentSet
 * @returns {{ valid: true }}
 */
export function validateMissionDocuments(documentSet) {
  validateDocument("mission-charter", documentSet.charter);
  validateDocument("phase-plan", documentSet.phasePlan);

  for (const phase of documentSet.phaseEvidence ?? []) {
    validateDocument("validation-contract", phase.validationContract);

    // A phase with no report yet is a normal early state, not a defect.
    if (phase.validationReport == null) {
      continue;
    }
    validateDocument("phase-validation-report", phase.validationReport);
    validatePair(phase.validationContract, phase.validationReport);
  }

  return { valid: true };
}
