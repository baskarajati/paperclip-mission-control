# M3 Independent Counter-Design

Date: 2026-08-24

Status: returned to the owner for relay to the M3 author

Seat: adversarial counterpart

Method: GPT-5.6 Luna max received only
`docs/plans/milestones/0003-consult-prompt.md` and the authoritative files it
names. It did not receive or read the lead design. Codex then checked the answer
against the written architecture and corrected two contradictions: rejected
confirmations return to `active` or `blocked`, and host activation remains an M2
concern rather than entering the M3 business-state core.

## 1. Boundary and layout

Keep versioned document contracts and pure derivation close together without
making the pure core import the filesystem/Ajv validator:

```text
contracts/
  validator.mjs                 existing schema/semantic validation boundary
  snapshot.mjs                  normalized snapshot structural validation
  v1/
    derive-state.mjs            pure mission and phase derivation
    derive-evidence.mjs         assertion, finding, waiver, blocker reduction
    derive-transition.mjs       pure transition candidate and gates
    canonical.mjs               existing serializer, hash, key, request helpers
    *.schema.json               versioned Paperclip document contracts
tests/contracts/
  derivation.test.mjs
  derivation-property.test.mjs
fixtures/snapshots/{valid,invalid}/
```

The runtime pipeline is schema validation, normalized snapshot construction,
then pure derivation. That is not an import chain: `derive-*.mjs` must not import
`validator.mjs`, Ajv, filesystem, SDK, database, network, clock, random, locale,
or environment APIs. `derive-transition.mjs` imports the existing helpers from
`canonical.mjs`; no second canonicalization implementation is allowed.

Derived state is returned as a value and may be checkpointed in the plugin
database by M4. It is never written into a Paperclip document whose revision
binds a confirmation or transition key.

## 2. Input

Use an immutable normalized input with ownership domains kept visible:

```js
{
  schemaVersion: 1,
  paperclip: {
    companyId,
    missionGoalId,
    missionRoot,
    charter: DocumentRevision,
    phasePlan: DocumentRevision,
    phaseControls: PhaseSnapshot[],
    evidence: EvidenceSnapshot[],
    confirmations: ConfirmationSnapshot[],
    approvals: ApprovalSnapshot[],
    costs: CostSnapshot[],
    budgetIncidents: BudgetIncidentSnapshot[],
    invocationBlocks: InvocationBlockSnapshot[],
    ownership: OwnershipSnapshot
  },
  operations: {
    transition: TransitionObservation | null,
    phaseBindings: PhaseBindingObservation[]
  }
}
```

Every `DocumentRevision` carries `documentKey`, `issueId`, `revisionId`,
`revisionNumber`, and validated `body`. Each phase snapshot carries the control
issue, relations, assignees, active runs, current phase documents, and any
execution project/root issue visible in Paperclip. Phase order is the charter
array order.

`operations` contains observations needed to describe an in-flight transition;
it is not business authority. A checkpoint may explain `provisioning`, but it
can never turn incomplete Paperclip evidence into success. If operational data
is lost, origin-linked Paperclip records remain sufficient for later
reconstruction.

Exclude event IDs/order/counts, wall-clock time, random values, ambient defaults,
SDK/database/network handles, secrets, mutation functions, agent prose claims,
and prior stored derived state. Host version/capability activation is checked by
M2 before this core runs and is not a mission or phase state input.

## 3. Core signatures

Expected domain outcomes are values. Malformed normalized input returns stable
diagnostics rather than becoming a positive state:

```js
validateSnapshotStructure(snapshot) -> Outcome<NormalizedSnapshot>
deriveEvidenceState(snapshot, phaseId) -> Outcome<EvidenceDerivation>
derivePhaseState(snapshot, phaseId) -> Outcome<PhaseDerivation>
deriveMissionState(snapshot) -> Outcome<MissionDerivation>
deriveTransitionCandidate(snapshot, phaseId) -> Outcome<TransitionCandidate|null>
deriveSnapshot(snapshot) -> DerivationResult
```

`Outcome<T>` is `{ ok: true, value: T }` or
`{ ok: false, errors: StableDiagnostic[] }`. `DerivationResult` returns mission
state, ordered phase results, blockers, gates, diagnostics, and at most one
transition candidate. It does not return mutation functions.

The candidate reuses `transitionKey`, `canonicalProjectRequest`,
`canonicalJsonStringify`, and `sha256Hex`. It also names the full confirmation
binding: governing document key/revision ID/revision number, validation-report
revision, next-phase-brief revision, governance principal, `human_only` resolver
policy, and `none` continuation policy. Today the transition-identity schema
cannot express all of that.

## 4. Derivation order

### Evidence

For a phase: validate document schemas; validate cross-document mission/phase
identity and charter/plan order; resolve the referenced validation contract and
report; validate assertion coverage; resolve each evidence reference and prove
its current revision; validate waiver identity, scope, human approval, and
freshness; then reduce results.

Every assertion must be `pass` with current evidence or `waived` by a current,
properly scoped human decision. `fail` is incomplete work. `blocked`, an open
hard finding, a budget incident, an invocation block, conflicting evidence, or
ambiguous ownership is a hard gate. A terminal phase result is `waived` if at
least one completion assertion required a valid waiver; otherwise it is
`completed`.

### Phase precedence

1. Unambiguous explicit cancellation -> `cancelled`.
2. Invalid/conflicting contracts, open hard governance conditions, budget or
   invocation incidents, or ambiguous ownership -> `blocked`.
3. Accepted current incoming transition whose target is not fully verified ->
   `provisioning`.
4. No project or incoming transition -> `planned`.
5. Project exists but required documents/root issue/binding are unverified ->
   `provisioning`.
6. Verified execution project with no validation attempt -> `active`.
7. A report exists but evidence is incomplete or failing -> `validating`.
8. Evidence is complete and no current accepted confirmation exists ->
   `awaiting_confirmation`.
9. A rejected confirmation returns to `active`, or `blocked` when the rejection
   records a hard governance stop. A stale/superseded confirmation grants no
   permission and requires a newly bound request.
10. The predecessor remains nonterminal until its successor is fully verified;
    then it becomes `completed` or `waived`.
11. The terminal phase becomes terminal only after current terminal evidence,
    final-report verification, and current human mission-completion confirmation.

Failed or partial provisioning never completes the predecessor.

### Mission precedence

1. Explicit unambiguous cancellation -> `cancelled`.
2. Invalid/conflicting mission contracts, any hard phase/governance blocker,
   budget incident, invocation block, or ambiguous ownership -> `blocked`.
3. All phases terminal plus current terminal evidence, final report, and current
   accepted completion confirmation -> `completed`.
4. A current accepted nonterminal confirmation with an unverified target ->
   `transitioning`.
5. Current phase evidence complete without an accepted current confirmation ->
   `awaiting_transition_confirmation`.
6. Verified active, provisioning, or validating work -> `active`.
7. Valid charter/plan with no provisioned phase -> `draft`.

## 5. Fail-closed vocabulary

Reuse the existing codes for the conditions they already name:
`MC_SCHEMA_VERSION_UNSUPPORTED`, `MC_SCHEMA_INVALID`,
`MC_DUPLICATE_STABLE_ID`, `MC_PAIR_IDENTITY_MISMATCH`,
`MC_MISSING_ASSERTION_EVIDENCE`, `MC_UNKNOWN_ASSERTION_RESULT`,
`MC_WAIVER_APPROVAL_MISSING`, `MC_TRANSITION_KEY_TOO_LONG`,
`MC_NON_CANONICAL_REQUEST`, and `MC_REQUEST_HASH_MISMATCH`.

Add only codes whose operator action differs:

- `MC_SNAPSHOT_INVALID`: normalized Paperclip identity/revision/status data is
  absent or structurally impossible.
- `MC_PHASE_SET_MISMATCH`: charter and plan phase IDs/order differ.
- `MC_CONTRACT_REFERENCE_MISSING`: a phase has no resolvable validation
  contract.
- `MC_EVIDENCE_UNAVAILABLE`: a declared evidence reference cannot be resolved.
- `MC_STALE_EVIDENCE`: a report/evidence reference is superseded or lacks the
  revision data needed to prove freshness.
- `MC_HARD_BLOCKER_OPEN`: a hard finding, blocked assertion, or conflicting
  Paperclip relation remains open.
- `MC_BUDGET_INCIDENT_OPEN`: budget or invocation policy blocks execution.
- `MC_AMBIGUOUS_OWNERSHIP`: governance owner, lead, control issue, or binding is
  missing or non-unique where exactly one is required.
- `MC_WAIVER_APPROVAL_INVALID`: waiver approval exists but is unauthorized,
  stale, wrongly scoped, or not human.
- `MC_CONFIRMATION_INVALID`: policy, target, principal, or uniqueness is wrong.
- `MC_STALE_CONFIRMATION`: a confirmation binds a superseded governing
  revision.

M2 owns a separate host-compatibility activation error. M3 may map that failure
in traceability but must not pretend to prove activation.

## 6. Findings, waivers, and blockers

A normalized finding needs stable ID, phase, severity (`info`, `warning`,
`hard`), status (`open`, `resolved`, `waived`), evidence references, and source
revision. Open hard findings block. Warnings and informational findings remain
visible. A waived finding requires a matching current waiver and current human
approval bound to its exact scope. Duplicate IDs, unknown values, phase mismatch,
or ambiguous scope fail closed.

A waived assertion must map to the waiver declared for that assertion. A waiver
never suppresses unrelated hard blockers, budget incidents, ownership ambiguity,
or stale evidence. The deriver never creates or approves a waiver.

## 7. Tests

Table tests cover every mission and phase state, every legal transition, terminal
completion, rejection, cancellation, stale confirmation, partial provisioning,
all assertion statuses, valid/invalid waivers, findings by severity/status,
budget/invocation blocks, ownership ambiguity, charter/plan disagreement,
dangling contract references, and wrong/duplicate confirmation bindings.

Property tests prove deterministic output under deep clone and object-key
permutation, exclusion of event delivery order, transition-key stability and
bounded length, sensitivity to every identity field, and absence of a transition
candidate whenever any gate is false. Cross-process timezone/locale stability
of the canonical request remains covered by the existing contract tests.

Import/purity restrictions are static source checks, not property tests. Crash
recovery, CAS, host idempotency, wake behavior, and event convergence require
later integration/fault tests and must not be claimed by M3.

## 8. Contract gaps

1. `mission-charter.schema.json` has no company/goal binding, cancellation
   marker, phase lead/control/project binding, or host revision envelope. Its
   terminal evidence is not linked to a validation contract/report.
2. `phase-plan.schema.json` has no governed lead source even though the
   transition key includes `nextPhaseLeadAgentId`.
3. Self-declared `planRevisionId` is insufficient: confirmations require the
   host document key plus revision ID and number, and the body value must match
   the host envelope.
4. `validation-contract.schema.json` uses bare evidence IDs and cannot bind the
   observed evidence revision or prove freshness.
5. `phase-validation-report.schema.json` lacks source revision/provenance,
   findings, blocker severity, waiver identity, and approval binding. `waived`
   does not identify its waiver.
6. `validator.mjs` does not verify report evidence is declared/current, the
   charter/plan phase set and order agree, contract references resolve, terminal
   evidence maps to proof, or ownership/confirmation freshness is unambiguous.
7. No versioned schema defines findings, blocker severity/status, or general
   waiver scope and freshness.
8. `transition-identity.schema.json` omits the confirmation target document key
   and revision number, next-phase brief revision, governance principal, and
   resolver/continuation policies.
9. The local transition request is flat while upstream issue #12040 proposes a
   nested `project` DTO; the two request/hash scopes must be reconciled.
10. The lead participates in the transition key without any current v1 document
    governing its source/revision.
11. The terminal phase has no complete final-report/mission-completion contract,
    while `transition-identity` always requires a `nextPhaseId` and project
    request.
12. The repository has no normalized snapshot fixtures or full document-set
    validator/state-machine tests.

These gaps are not permission to widen every Paperclip document in M3. The M3
author must classify each as: required contract repair now, normalized host
envelope supplied later, or explicitly blocked/deferred with a fail-closed gate.

## 9. Deliberate exclusions

No reconciler, leases, SQL, events, startup recovery, SDK calls, mutations,
confirmation requests, project creation, document upserts, wakes, initialization,
import, UI, routine/job, telemetry, final-report generation, automatic waiver,
or crash/concurrency/real-host claims. M3 emits declarative state, diagnostics,
and gates only.

## What a naive design would drop

| Written state-machine item | Home or later owner |
| --- | --- |
| 1. Read subtree, documents, runs, assignees, orchestration summaries, interactions | Normalized snapshot shape; host adapter is M4/M6. |
| 2. Validate schemas/assertions | Existing validator plus document-set/snapshot validation. |
| 3. Incomplete evidence updates report and stops | Pure evidence result/desired report data; CAS write is M4/M6. |
| 4. Conflict/hard governance blocks, no confirmation | Blocker reduction and `canRequestConfirmation: false`. |
| 5. Exact human confirmation and bounded key | Transition candidate includes key, policy, principal, and revision target; request is M6. |
| 6. Wait for current acceptance | `canProvision` stays false without current accepted confirmation. |
| 7. Revalidate after acceptance | Fresh derivation compares every bound revision; stale result grants nothing. |
| 8. Claim operation/persist request hash | Candidate supplies request/hash; atomic operation belongs to M4/M7. |
| 9. Deterministic project creation | Existing canonical helpers; host call is M7. |
| 10. Reconcile documents/root issue | Snapshot models verification target; writes are M7. |
| 11. Re-read, bind, then wake | `canWake` requires verified target; side effects are M7. |
| 12. Complete prior phase/decision log after verification | Terminal phase result requires verified successor; writes are M6/M7. |
| Terminal replacement for 9-11 | Terminal gate requires evidence, final report, and completion confirmation; generation/write is later. |

| Failure invariant | Home or honest boundary |
| --- | --- |
| No confirmation means no project | Pure provisioning gate; real proof is M7. |
| Stale confirmation means no project | Revision freshness gate; real-host interaction proof is M6/M7. |
| One key produces at most one project | Stable candidate only; DB/host authority is M4/M7 and blocked upstream. |
| Event loss/order converges | Events excluded from derivation; reconciler proof is M4/M6. |
| Crash at every mutation boundary converges | Not an M3 claim; M7 fault suite. |
| Failed provisioning never completes predecessor | Pure completion gate; integration proof is M7. |
| Concurrent edits never overwritten | Revision observations only; CAS helper/host proof is M4 and upstream. |
| Wake follows verified provisioning | Pure `canWake` gate; wake-intent proof is M7. |
| Missing/incompatible host prevents activation | M2, deliberately outside the business-state core. |
| Plugin data loss preserves evidence | Core never treats plugin checkpoints as business truth; rebuild proof is M4/M5. |
| Uninstall preserves projects/issues | No destructive M3 behavior; clean-room proof is M9. |

No written item is silently claimed as implemented. M3 owns only the pure gate
or diagnostic named above; later milestones retain mutation, compatibility, and
recovery authority.
