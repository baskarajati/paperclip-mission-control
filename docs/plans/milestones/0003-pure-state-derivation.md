# Milestone 3 Plan: Documents and Pure State Derivation

Status: plan returned for review. Implementation is gated on section 6.

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

- **The counter-design consult did not run.** See section 6.
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

### 5.1 The snapshot type is a public shape

M3 must define what a Paperclip snapshot looks like. Every later milestone
reads it. Getting it wrong is expensive, which is why it is flagged rather
than assumed.

### 5.2 Five contract gaps, each confirmed by a probe

Probes were run against the current contracts in this worktree. The output is
real:

```text
GAP 1 CONFIRMED: plan phases [intake, validation, a-phase-the-charter-never-declared]
                 charter phases [intake, validation, payment] -> validates
GAP 2 CONFIRMED: every phase lacks validationContractRef -> validates
GAP 3 CONFIRMED: phase entry keys = ["phaseId","objective","validationContractRef"]
GAP 4 CONFIRMED: charter phase entry keys = ["phaseId","objective"]
GAP 5 CONFIRMED: validator exports = ["CONTRACT_TYPES","validateDocument","validatePair","validateTransitionIdentitySemantics"]
```

| Gap | What it means for the deriver | Recommendation |
| --- | --- | --- |
| 1. The charter phase list and the plan phase list may disagree | The deriver cannot tell which list defines the mission | Add a cross-document check that fails closed with a new code `MC_PHASE_SET_MISMATCH` |
| 2. `validationContractRef` is optional | A phase may declare no evidence at all | Fail closed. Architecture line 23 forbids inferring completion without evidence. A phase with no contract can never complete |
| 3. No terminal-phase marker | The deriver must know when the mission ends | Derive it from order. The terminal phase is the last one. Add no field. This follows the ratified "ordered phases" |
| 4. The charter phase entry carries only `phaseId` and `objective` | The charter cannot express a lead or a contract | Leave it. The plan is the operational document. Do not widen the charter in M3 |
| 5. No document-set validator exists | Only one document at a time can be validated | Add a set-level validator in M3. It is the deriver's front door |

### 5.3 New error codes are a public vocabulary

M3 must extend the `MC_*` list. Every addition is a public contract that later
milestones and operators read. This plan deliberately does not fix the list
before the counter-design returns. The consult prompt asks the counterpart to
derive its own codes, so agreement or divergence on the vocabulary is real
evidence and not an echo of this plan.

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

**Triggers fired.** Two of them. Section 5 is not empty, so the
irreversible-decision trigger fired. The plan spans four slices, so the size
trigger fired.

**Seat.** Adversarial counterpart, which the roster requires to be a different
model family from the lead. Codex holds that seat in this project.

**Channel: the project owner.** The owner commands each agent directly and
relays between them. A contributor does not open another contributor's session.
The consult therefore travels as a committed prompt that the owner pastes into a
Codex session, at `docs/plans/milestones/0003-consult-prompt.md`. It is written
blind: it states the problem, the constraints, and the canon, and it contains
none of this plan's answers.

**Status: dispatched to the owner, answer pending.**

**Correction on the record.** The author first tried to dispatch this consult
directly to a Codex session over MCP. That was wrong. It would have taken
control of a session the owner owns and hidden the exchange from him. Both calls
failed with HTTP 400 before any session started, so no Codex session ran and no
context was sent. The owner corrected the approach the same day. The committed
prompt is the primary channel, not a fallback.

**Divergences.** None recorded yet. This section stays open until the
counter-design returns. Per the planning contract, agreement between two designs
is a warning and not a confirmation, so the divergence list must be filled in
before slices 2 and 3 are accepted.

**Default if the answer does not arrive.** Implementation waits. The slices
below are ordered so that waiting costs little. If the owner prefers speed over
the counter-design, slice 1 starts immediately with the snapshot type marked
provisional, and the author absorbs the rework.

## Slices

| Slice | Content | Needs the consult |
| --- | --- | --- |
| 1 | Snapshot type, document-set validator, purity guard | Yes, because the snapshot shape is public |
| 2 | Phase state derivation, fail-closed rules, new codes | Yes |
| 3 | Mission state derivation, blockers, waivers, budget incidents | Yes |
| 4 | Property tests, traceability update | No |

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
