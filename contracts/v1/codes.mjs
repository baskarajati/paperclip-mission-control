/**
 * The Milestone 3 error-code registry.
 *
 * `contracts/validator.mjs` owns the codes that describe a single document.
 * This registry owns the codes that describe a normalized snapshot and the
 * state derived from it.
 *
 * A code is admitted only when the operator action differs from every code that
 * already exists. Codes are added when a rule first needs one, never in advance,
 * because a declared-but-unused code is a promise the deriver has not kept.
 *
 * This module is part of the pure core. It imports nothing.
 */
export const MC = Object.freeze({
  /** Normalized host identity, revision, or status data is structurally impossible. */
  SNAPSHOT_INVALID: "MC_SNAPSHOT_INVALID",
  /** The charter and the plan disagree on phase identifiers or their order. */
  PHASE_SET_MISMATCH: "MC_PHASE_SET_MISMATCH",
  /** A phase has no resolvable validation contract, so it can never complete. */
  CONTRACT_REFERENCE_MISSING: "MC_CONTRACT_REFERENCE_MISSING",
  /** A document body contradicts the host revision that carries it. */
  STALE_EVIDENCE: "MC_STALE_EVIDENCE",
  /** A confirmation policy, target, principal, or status is not one this contract accepts. */
  CONFIRMATION_INVALID: "MC_CONFIRMATION_INVALID",
});
