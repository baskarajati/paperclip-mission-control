# Milestone 3 Plan: Documents and Pure State Derivation

Status: reconciled with the independent counter-design on 2026-08-24. Slice 1 is
unblocked. Slices 2 and 3 are specified and ready.

Author: Claude Opus 5 contributor

Base: `feat/m3-pure-state-derivation`, branched from
`fix/phase-plan-drops-derived-state` at `c7ff2dd`

Worktree: `/Users/realinorevandy/dev/paperclip-mission-control-wt-m3`

## 1. Verified premises

Each premise names the command or the file that proves it.

- **The base is fresh.** `main` is `6f1c3b5`. This branch stacks on PR #10, whose
  CI passed on Node 24 and Node 25. M3 must not merge before #10.
- **The environment works before any change.** In the fresh worktree,
  `pnpm install --frozen-lockfile` then `pnpm test` returned `tests 30, pass 30,
  fail 0`. The worktree started without `node_modules`, which is gitignored;
  the install created it.
- **Phase order is ratified, not open.** The architecture, line 20, states the
  charter names "ordered phases". Phase order is document order. M3 invents no
  ordering field. Line 193 ratifies that the terminal phase replaces steps 9
  through 11 with a final report.
- **The state machine is written, not inferred.** The architecture, lines
  136 to 195, lists the mission states, the phase states, and the twelve
  transition steps. Section 6 of this plan maps every step.
- **A document revision is load-bearing.** The architecture, line 279, states
  the host expires a pending confirmation when its target document gains a
  revision. This is why derived state stays out of Paperclip documents. See
  issue #8.
- **The existing code was read, not assumed.** `contracts/validator.mjs` owns the
  `MC_*` code vocabulary and pair validation. `contracts/v1/canonical.mjs` owns
  canonical JSON, the SHA-256 helper, the transition key, and the canonical
  project request.
- **No peer is editing this area.** Codex holds no open branch touching
  `contracts/`. The open pull requests are #9 and #10, both mine.

### Premises this session could not verify

Each one is BLOCKING if false at execution time.

- ~~The counter-design consult did not run.~~ **Resolved on 2026-08-24.** It
  ran blind and is reconciled in section 6.
- **The host can supply the snapshot fields.** Architecture step 1 reads
  "orchestration summaries for approvals, costs, open budget incidents, and
  invocation blocks". This repository holds no host type for them. M3 defines
  the shape it needs. Milestones 4 and 6 must map real host reads onto that
  shape. If the host cannot supply a field, the snapshot type changes.

## 2. Pattern to mirror

`contracts/validator.mjs` is the nearest existing implementation of the same
kind of change. M3 copies from it:

- pure ESM in `.mjs`, no runtime dependency;
- one `SemanticError` class carrying a stable `MC_*` code;
- semantic checks placed before schema checks where the semantic code is the
  more useful signal.

`contracts/v1/canonical.mjs` is the pattern for pure derivation: a header
comment that states the rules, exported pure functions, and no import beyond
`node:crypto`.

**One deliberate deviation.** The deriver returns a value for a domain outcome
instead of throwing. A blocked phase and a phase awaiting confirmation are
expected results, not errors. This mirrors the ruling already made for M1B in
`docs/plans/milestones/0001b-idempotent-project-creation.md`, where expected
key-reuse outcomes became values rather than thrown errors. Malformed input
still throws.

## 3. Known failure modes and guards

| Failure mode | Class | Guard |
| --- | --- | --- |
| The branch stacks on an unmerged PR and drifts | stale world | Rebase before opening the M3 pull request. Do not merge M3 before #10. |
| A fresh worktree has no `node_modules` | environment | Already hit and fixed. The install command is in section 4. |
| A second error vocabulary appears | cross-cutting spine | The deriver imports its codes from one exported list. A test asserts every thrown code is a member. |
| A second canonical JSON or hash implementation appears | cross-cutting spine | Import from `canonical.mjs`. A test asserts the deriver source declares no serializer of its own. |
| The deriver reads a clock, randomness, or the network | project-specific purity | A test scans the derivation source for `Date`, `Math.random`, `process`, `node:fs`, `node:net`, and `fetch`. |
| An unknown enum value maps silently to a default state | fail-open | Exhaustive branch with a throwing default, plus one table row per unknown value. |
| Two agents edit `contracts/` at once | concurrency | M3 adds files. It edits an existing contract only where section 5 lists it. |
| "Done" claimed from types and counts | perception | The table tests assert the derived state value, never only the absence of a throw. |

## 4. Proof-of-done, defined before building

Commands, each of which must be quoted in the done report with real output:

```text
pnpm install --frozen-lockfile
pnpm test                          # 30 existing, plus the new tests, 0 fail
git diff --check
```

Evidence artifacts:

- A red run for every new behaviour, quoted before the green run.
- Table-driven tests with one row for each legal phase transition and one row
  for each fail-closed rule.
- A property test proving that one snapshot always derives one identical
  result, across shuffled object key order.
- A purity test proving the derivation source imports no clock, randomness,
  filesystem, or network.
- `docs/testing/traceability.md` rows moved from `planned` to `covered` only
  for the invariants M3 actually proves. `INV-RUN-003`, `INV-RUN-005`, and
  `INV-RUN-007` stay `blocked-upstream`.
- CI green on Node 24 and Node 25.

## 5. Irreversible decisions flagged

These need agreement before implementation, because each one sets a public
shape or a public vocabulary that Milestones 4 through 7 will depend on.

### 5.1 The snapshot shape is a public contract

Every later milestone reads it. It is now specified by the counter-design and
adopted: each document travels in a host revision envelope of `documentKey`,
`issueId`, `revisionId`, `revisionNumber`, and `body`, beside phase controls,
confirmations, approvals, costs, budget incidents, invocation blocks, and
ownership. Paperclip facts and plugin observations stay in separate domains, so
an operational checkpoint can never be mistaken for business truth.

### 5.2 Contract gaps, reconciled

Five gaps were confirmed here by probe. The counter-design found twelve, with a
substantial overlap. The union is below, each classified as the counter-design
requires: repair now, host envelope later, or blocked.

Probe output from this worktree, quoted because it is evidence rather than
opinion:

```text
GAP 1 CONFIRMED: plan phases [intake, validation, a-phase-the-charter-never-declared]
                 charter phases [intake, validation, payment] -> validates
GAP 2 CONFIRMED: every phase lacks validationContractRef -> validates
GAP 3 CONFIRMED: phase entry keys = ["phaseId","objective","validationContractRef"]
GAP 4 CONFIRMED: charter phase entry keys = ["phaseId","objective"]
GAP 5 CONFIRMED: validator exports = ["CONTRACT_TYPES","validateDocument","validatePair","validateTransitionIdentitySemantics"]
```

| Gap | Classification | Lands in |
| --- | --- | --- |
| No document carries a host revision envelope; a self-declared `planRevisionId` cannot satisfy a confirmation that binds a document key, revision ID, and revision number | Repair now, in the snapshot rather than in the document schemas | Slice 1 |
| No snapshot fixtures and no document-set validation exist | Repair now | Slice 1 |
| The charter phase list and the plan phase list may disagree, and still validate | Repair now, `MC_PHASE_SET_MISMATCH`. The charter is the order authority | Slice 2 |
| `validationContractRef` is optional and may resolve to nothing | Repair now, `MC_CONTRACT_REFERENCE_MISSING`. A phase with no contract can never complete, because the architecture forbids inferring completion without evidence | Slice 2 |
| Evidence references are bare IDs and cannot prove freshness | Repair now, `MC_STALE_EVIDENCE`, using the envelope from slice 1 | Slice 2 |
| `validator.mjs` performs no cross-document checks at all | Repair now | Slice 2 |
| The report carries no provenance, no findings, no blocker severity, and no waiver identity; a `waived` result does not name its waiver | Repair now | Slice 3 |
| No versioned schema defines a finding, its severity, its status, or waiver scope and freshness | Repair now | Slice 3 |
| `transition-identity` omits the confirmation target document key and revision number, the next-phase brief revision, the governance principal, and the resolver and continuation policies | Repair now | Slice 4 |
| `transition-identity` cannot express a terminal phase, because `nextPhaseId` and a project request are always required | Repair now | Slice 4 |
| The charter carries no company or goal binding | Host envelope later; the snapshot supplies `companyId` and `missionGoalId` | Slice 1 shape |
| Cancellation has no representation | Host envelope later. Refuted as a charter field, see divergence 17. Cancellation is Paperclip business truth and is read from host state | Slice 3 |
| The charter phase entry carries only `phaseId` and `objective` | Leave as is. The plan is the operational document, and widening the charter buys nothing | Not scheduled |
| No document governs the phase lead, although the transition key includes `nextPhaseLeadAgentId` | **Blocked** on paperclipai/paperclip#12040 | Fail closed |
| The local request is flat while upstream proposes a nested `project` DTO | **Blocked** on the same issue. See Finding 1 of the divergence review | Fail closed |

The two blocked rows are the reason M3 stops at a transition candidate. It never
claims a request shape that upstream has not agreed.

### 5.3 The error-code vocabulary, reconciled

A code is admitted only when the operator action differs from every existing
code. Existing codes are reused for the conditions they already name.

| Code | Condition |
| --- | --- |
| `MC_SNAPSHOT_INVALID` | Normalized identity, revision, or status data is absent or structurally impossible |
| `MC_PHASE_SET_MISMATCH` | The charter and the plan disagree on phase identifiers or order |
| `MC_CONTRACT_REFERENCE_MISSING` | A phase has no resolvable validation contract |
| `MC_EVIDENCE_UNAVAILABLE` | A declared evidence reference cannot be resolved |
| `MC_STALE_EVIDENCE` | A report or evidence reference is superseded, or lacks the revision data needed to prove freshness |
| `MC_HARD_BLOCKER_OPEN` | A hard finding, a blocked assertion, or a conflicting Paperclip relation is open |
| `MC_BUDGET_INCIDENT_OPEN` | A budget or invocation policy blocks execution |
| `MC_AMBIGUOUS_OWNERSHIP` | A governance owner, lead, control issue, or binding is missing or not unique where exactly one is required |
| `MC_WAIVER_APPROVAL_INVALID` | A waiver approval exists but is unauthorized, stale, wrongly scoped, or not human |
| `MC_CONFIRMATION_INVALID` | A confirmation policy, target, principal, or uniqueness is wrong |
| `MC_STALE_CONFIRMATION` | A confirmation binds a superseded governing revision |

Milestone 2 owns host-compatibility activation and its error. M3 may map that
failure in traceability. M3 must not claim to prove activation.

### 5.4 What M3 will NOT do

Recorded so the boundary is explicit, per the owner's rule that deferrals are
logged.

- No SQL, no migrations, no plugin database. That is Milestone 4.
- No host reads, no SDK, no network. Milestone 3 is pure.
- No confirmation creation or monitoring. That is Milestone 6.
- No project provisioning. That is Milestone 7.
- No lead-agent field in any document. That waits on the upstream answer to
  `leadAgentId` in issue #12040.

## 6. Consult record

**Triggers fired.** Two. Section 5 is not empty, so the irreversible-decision
trigger fired. The plan spans four slices, so the size trigger fired.

**Seat and channel.** Adversarial counterpart, a different model family from the
lead, reached through the project owner. The owner relayed
`docs/plans/milestones/0003-consult-prompt.md` to the seat. A contributor never
opens a peer's session.

**Status: returned and reconciled on 2026-08-24.**

**Counter-design.** GPT-5.6 Luna at maximum reasoning produced it blind. It
received only the consult prompt and the authoritative files that prompt names.
It never saw this plan. Codex then audited the answer against repository canon
and corrected two contradictions before recording it: a rejected confirmation
returns to `active` or `blocked`, and host activation stays a Milestone 2
concern. The document is
`docs/reviews/2026-08-24-m3-independent-counterdesign.md`, delivered as pull
request #15.

**Correction on the record.** The author first tried to dispatch this consult
directly to a Codex session over MCP. That was wrong, and it would have taken
control of a session the owner owns. Both calls failed before any session
started, so nothing ran. The owner corrected the route.

### Divergences and resolutions

The counter-design is deeper than this plan in the input model and in the
decision order. It is adopted almost entirely. The two designs were written
against the same canon, so convergence is expected; per the planning contract,
agreement is treated as a warning and not as a confirmation, and each converged
item below names the evidence both designs relied on.

| # | Divergence | Resolution |
| --- | --- | --- |
| 1 | The pure core must not import `validator.mjs`, which pulls in Ajv and the filesystem. Validation runs before derivation in the pipeline, not inside it | **Adopt.** This plan implied the boundary and never stated it. Slice 1 satisfies it, and the import rule becomes an executable guard |
| 2 | Every document travels in a host revision envelope: `documentKey`, `issueId`, `revisionId`, `revisionNumber`, `body` | **Adopt.** This is the entity the lead design lacked. A confirmation binds a document key, a revision ID, and a revision number, so a bare document body can never support the transition chain. Self-declared `planRevisionId` is not the host envelope |
| 3 | The snapshot also carries phase controls, confirmations, approvals, costs, budget incidents, invocation blocks, and ownership | **Adopt.** This plan deferred them to later slices. Because the snapshot is a public shape, defining it once whole is cheaper than growing it three times |
| 4 | The phase control record is separate from the evidence documents | **Adopt.** The lead design conflated them |
| 5 | `Outcome<T>` returning collected diagnostics, rather than throwing on the first defect | **Adopt.** An operator surface needs every defect at once. Section 2 of this plan already committed to values over throws, and slice 1 had not yet honoured it |
| 6 | A full phase precedence of eleven steps and a mission precedence of seven | **Adopt whole.** This plan deliberately left the decision order open for the consult. This fills it |
| 7 | Eleven new error codes, admitted only when the operator action differs | **Adopt**, including the admission test |
| 8 | `MC_PHASE_SET_MISMATCH` for a charter and plan that disagree | **Converged independently.** Both designs derived it from the same probe-able gap, so the agreement rests on evidence rather than on a shared frame |
| 9 | Purity is a static source check, not a property test | **Converged independently.** Slice 1 already implements it, and both guards were proven to fail when violated |
| 10 | The charter is the authority for phase order; the plan must agree | **Adopt.** The architecture ratifies ordered phases in the charter. This plan asserted document order without naming which document wins |
| 11 | Findings need a versioned schema: stable ID, phase, severity, status, evidence references, source revision | **Adopt** as the slice 3 input. The lead design named findings as a deliverable and gave them no shape |
| 12 | `transition-identity` cannot express the terminal phase, and it omits the confirmation target document key, revision number, next-phase brief revision, governance principal, and the resolver and continuation policies | **Adopt.** A gap the lead design missed. `nextPhaseId` and a project request are always required, so a terminal transition cannot be represented at all |
| 13 | Host activation belongs to Milestone 2 and is not an input to the business-state core | **Adopt** |
| 14 | Derivation modules live under `contracts/v1/`, because the logic is bound to schema version 1 | **Adopt** |
| 15 | The flat local request and the nested upstream `project` DTO must be reconciled | **Escalate.** This is Finding 1 of `docs/reviews/2026-08-23-canonical-request-divergence.md`, and it is blocked on the upstream answer to paperclipai/paperclip#12040. M3 fails closed here rather than guessing |
| 16 | The counter-design specifies the whole of M3 at once | **Sequencing retained, not refuted.** The design is adopted as written; this plan keeps delivering it in slices, because one unreviewable pull request serves nobody |
| 17 | The charter should gain a cancellation marker | **Refuted.** Cancellation is Paperclip business truth, not a Mission Control declaration. ADR 0002 splits business truth from operational state, so cancellation is read from host state in the snapshot. Widening the charter would move a fact the host owns into a document the plugin writes |

**One divergence changes work already built.** Item 2 and item 5 both change
slice 1, which is open as pull request #13. Slice 1 is being revised rather than
defended.

## Slices

| Slice | Content | Status |
| --- | --- | --- |
| 1 | Snapshot shape with the host revision envelope, structural validation returning `Outcome`, purity and import guards | Unblocked. Open as #13, being revised against divergences 1, 2, 3, 4, and 5 |
| 2 | Evidence reduction and phase precedence, with the codes those rules need | Specified by the counter-design. Ready after slice 1 |
| 3 | Mission precedence, findings, waivers, blockers, budget and invocation gates | Specified. Ready after slice 2 |
| 4 | Transition candidate, property tests, traceability update | Ready after slice 3. Divergence 15 stays fail-closed until upstream answers |

Contract repairs are not a single slice. Each gap in section 5 is classified
there as repair now, host envelope later, or blocked, and each repair travels
with the slice that first needs it.

## Allowed files

- `contracts/v1/**` for new pure modules and any schema change section 5 lists
- `fixtures/**`
- `tests/**`
- `docs/testing/traceability.md`
- this plan and the consult prompt

Do not modify the architecture, the ADRs, `AGENTS.md`, or the supervision
protocol under this milestone.

## Handoff

The done report returns: files changed, the red and green evidence actually
run, the completed section 6 divergence list, remaining risks, and
`git diff --stat`.
