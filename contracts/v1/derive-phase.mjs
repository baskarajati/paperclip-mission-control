/**
 * Pure phase-state derivation.
 *
 * Part of the pure core: it imports only the code registry.
 *
 * The input is a `PhaseObservation`, a flat record of named facts rather than a
 * host snapshot. That is deliberate. The decision order is the valuable part,
 * and expressing it over named facts makes every branch testable today and
 * states exactly which facts a snapshot must supply. The adapter that builds an
 * observation from a normalized snapshot arrives with the snapshot fields it
 * needs, and this order does not change when it does.
 *
 * Derived state is returned as a value. It is never written into a Paperclip
 * document whose revision binds a confirmation or a transition key.
 *
 * @typedef {object} PhaseObservation
 * @property {string} phaseId
 * @property {boolean} cancelled Explicit, unambiguous cancellation from host state.
 * @property {Array<{code: string, message: string}>} hardBlockers Open hard
 *   governance conditions: conflicting contracts, budget incidents, invocation
 *   blocks, ambiguous ownership.
 * @property {{verified: boolean}|null} project The execution project, and
 *   whether its documents, root issue, and binding are all verified.
 * @property {{accepted: boolean, targetVerified: boolean}|null} incomingTransition
 * @property {{hasReport: boolean, complete: boolean, waivedAny: boolean,
 *   hardGates: Array<object>}|null} evidence Result of `deriveEvidenceState`.
 * @property {{status: string, current?: boolean, hardStop?: boolean}} confirmation
 * @property {boolean} successorVerified Whether the next phase is fully provisioned.
 * @property {boolean} terminal Whether this is the mission's last phase.
 * @property {{evidenceCurrent: boolean, finalReportVerified: boolean,
 *   missionCompletionConfirmed: boolean}|null} terminalGates
 */
import { MC } from "./codes.mjs";

const ok = (value) => ({ ok: true, value });
const fail = (code, message, path) => ({ ok: false, errors: [{ code, message, path }] });

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** The confirmation states this contract accepts. Anything else fails closed. */
const CONFIRMATION_STATUSES = new Set(["none", "pending", "accepted", "rejected", "stale"]);

/** A phase that finished is `waived` when any assertion needed a valid waiver. */
function terminalResult(evidence) {
  return evidence.waivedAny ? "waived" : "completed";
}

/**
 * Derive one phase's state.
 *
 * The order below is the contract. Each rule is evaluated in turn and the first
 * that fires wins, so a later rule can never carry a phase past an earlier stop.
 *
 * One deliberate departure from the reviewed counter-design: rejection is
 * evaluated before the awaiting-confirmation rule. A rejected confirmation is
 * also "no current accepted confirmation", so the listed order would report a
 * phase as awaiting a confirmation a human has already refused.
 *
 * @param {PhaseObservation} observation
 * @returns {{ok: true, value: {phaseId: string, state: string, reason: string}}
 *   | {ok: false, errors: Array<{code: string, message: string, path: string}>}}
 */
export function derivePhaseState(observation) {
  if (!isObject(observation) || typeof observation.phaseId !== "string") {
    return fail(MC.SNAPSHOT_INVALID, "a phase observation needs a phaseId", "observation");
  }
  const confirmation = observation.confirmation;
  if (!isObject(confirmation) || !CONFIRMATION_STATUSES.has(confirmation.status)) {
    return fail(
      MC.CONFIRMATION_INVALID,
      `confirmation status must be one of ${[...CONFIRMATION_STATUSES].join(", ")}`,
      "observation.confirmation",
    );
  }
  if (!Array.isArray(observation.hardBlockers)) {
    return fail(MC.SNAPSHOT_INVALID, "hardBlockers must be a list", "observation.hardBlockers");
  }

  const decide = (state, reason) => ok({ phaseId: observation.phaseId, state, reason });
  const evidence = observation.evidence;

  // 1. Explicit cancellation outranks every other condition.
  if (observation.cancelled === true) {
    return decide("cancelled", "the phase is explicitly cancelled");
  }

  // 2. An open hard governance condition stops the phase. A blocked assertion
  //    is the same class of stop, so it is folded in here rather than treated
  //    as ordinary incomplete work.
  const gates = evidence?.hardGates ?? [];
  if (observation.hardBlockers.length > 0 || gates.length > 0) {
    return decide("blocked", "an open hard condition stops the phase");
  }

  // 3. An accepted incoming transition whose target is not yet verified.
  const incoming = observation.incomingTransition;
  if (isObject(incoming) && incoming.accepted === true && incoming.targetVerified !== true) {
    return decide("provisioning", "an accepted transition into this phase is not yet verified");
  }

  // 4. Nothing has been provisioned and nothing is arriving.
  if (observation.project == null && incoming == null) {
    return decide("planned", "no execution project and no incoming transition");
  }

  // 5. A project exists but is not fully verified.
  if (isObject(observation.project) && observation.project.verified !== true) {
    return decide("provisioning", "the execution project is not fully verified");
  }

  // 6. A verified project that has produced no validation attempt.
  if (evidence == null || evidence.hasReport !== true) {
    return decide("active", "the phase is running and has produced no validation report");
  }

  // 7. A report exists but the evidence does not prove the phase finished.
  if (evidence.complete !== true) {
    return decide("validating", "a validation report exists but the evidence is incomplete");
  }

  // 8. A human already refused. Evaluated before the awaiting rule, see above.
  if (confirmation.status === "rejected") {
    return confirmation.hardStop === true
      ? decide("blocked", "the rejection records a hard governance stop")
      : decide("active", "the confirmation was rejected and the phase resumes");
  }

  // 9. Only a current accepted confirmation grants permission to finish.
  if (confirmation.status !== "accepted" || confirmation.current !== true) {
    return decide("awaiting_confirmation", "evidence is complete and no current accepted confirmation exists");
  }

  // 10. The terminal phase finishes only on its own three gates.
  if (observation.terminal === true) {
    const t = observation.terminalGates;
    const proven = isObject(t)
      && t.evidenceCurrent === true
      && t.finalReportVerified === true
      && t.missionCompletionConfirmed === true;
    return proven
      ? decide(terminalResult(evidence), "terminal evidence, final report, and mission confirmation are all current")
      : decide("awaiting_confirmation", "the terminal gates are not all proven");
  }

  // 11. A predecessor stays non-terminal until its successor is verified, so
  //     failed or partial provisioning can never complete it.
  return observation.successorVerified === true
    ? decide(terminalResult(evidence), "the successor phase is fully verified")
    : decide("awaiting_confirmation", "the successor phase is not yet verified");
}
