# Failure Invariant Traceability

Source: `docs/plans/2026-08-22-mission-control-architecture.md`, section
"Failure invariants". Status values: `covered` (proven by an existing,
passing test), `planned` (assigned to a named milestone), and
`blocked-upstream` (depends on an unreleased Paperclip host contract).

## Milestone 0 contract invariants

| Invariant ID | Architecture invariant | Milestone | Evidence type | Status |
| --- | --- | --- | --- | --- |
| INV-M0-001 | Unknown schema versions fail closed (`MC_SCHEMA_VERSION_UNSUPPORTED`) | 0 | Fixture test `tests/contracts/contracts.test.mjs` ("invalid fixtures fail with their declared stable code" > `unknown-schema-version`) | covered |
| INV-M0-002 | Stable IDs match the bounded lowercase kebab-case grammar; reuse fails closed (`MC_DUPLICATE_STABLE_ID`) | 0 | Schema pattern tests plus fixture subtest `duplicate-stable-id` | covered |
| INV-M0-003 | Assertions require evidence; missing or empty evidence fails closed (`MC_MISSING_ASSERTION_EVIDENCE`) | 0 | Fixture subtest `missing-assertion-evidence` (pair validation) | covered |
| INV-M0-004 | Waivers require explicit human approval evidence, and approval actor/evidence references must be Paperclip IDs; unapproved or malformed waivers fail closed (`MC_WAIVER_APPROVAL_MISSING`, `MC_SCHEMA_INVALID`) | 0 | Fixture subtests `unapproved-waiver`, `waiver-approved-by-not-uuid`, and `waiver-approval-evidence-ref-not-uuid` (pair validation) plus focused waiver-ID unit tests | covered |
| INV-M0-005 | Transition keys are bounded to 255 characters (`MC_TRANSITION_KEY_TOO_LONG`); long revision sets collapse to a canonical SHA-256 digest | 0 | Unit test "transition keys stay within 255 characters" plus fixture subtest `key-too-long` | covered |
| INV-M0-006 | Project-create requests are canonical, deterministic, byte-stable across processes, timezone, and locale; hash verification is executable (`MC_REQUEST_HASH_MISMATCH`) | 0 | Unit tests for key-order independence and cross-process determinism plus fixture subtests `hash-mismatch`, `non-canonical-request`, and `request-drift` | covered |
| INV-M0-007 | A validation report belongs to exactly one contract; mission ID and phase ID must match on both documents (`MC_PAIR_IDENTITY_MISMATCH`) | 0 | Fixture subtest `pair-identity-mismatch` plus unit test "pair validation rejects mission or phase identity mismatch" (pair validation) | covered |
| INV-M0-008 | Every assertion result maps to an assertion the contract declares (`MC_UNKNOWN_ASSERTION_RESULT`) | 0 | Fixture subtest `unknown-assertion-result` plus unit test "pair validation rejects assertion results not declared by the contract" (pair validation) | covered |
| INV-M0-009 | Paperclip entity, revision, evidence, user, goal, agent, and interaction IDs are lowercase RFC 4122 UUIDs; other shapes fail closed (`MC_SCHEMA_INVALID`) | 0 | `paperclipId` schema grammar plus fixture subtest `paperclip-id-not-uuid` plus unit test "paperclip IDs must be lowercase RFC 4122 UUIDs" | covered |
| INV-M0-010 | The canonical project-create request carries exactly the proposed Paperclip project fields (`companyId`, `name`, `description`, `status`, `goalIds`, `leadAgentId`, `idempotencyKey`) with deterministic `backlog` status, the mission goal as sole linked goal, and the next-phase lead agent (`MC_NON_CANONICAL_REQUEST`) | 0 | Schema field set plus unit test "canonical project-create request uses real proposed Paperclip project fields" plus fixture subtests `non-canonical-request`, `request-drift`, and `paperclip-id-not-uuid` | covered |

## Runtime invariants assigned to later milestones

| Invariant ID | Architecture invariant | Milestone | Planned evidence type | Status |
| --- | --- | --- | --- | --- |
| INV-RUN-001 | No confirmation means no next project | 7 | Real-host confirmation-gate integration test | planned |
| INV-RUN-002 | Stale confirmation means no next project (target-document revision expires the pending confirmation) | 6, 7 | Real-host revision-binding interaction test | planned |
| INV-RUN-003 | One transition key produces at most one project | 4, 7 | Unique-constraint migration test plus crash/concurrency suite; depends on the unreleased host-side idempotent project-create contract | blocked-upstream |
| INV-RUN-004 | Zero, duplicate, missing, and out-of-order events converge to the same state | 4, 6 | Level-triggered reconciler table-driven tests with event-loss injection | planned |
| INV-RUN-005 | A worker crash at every mutation boundary converges without duplicate projects | 7 | Crash-injection suite before and after every external mutation | blocked-upstream |
| INV-RUN-006 | Failed provisioning never marks the previous phase complete | 7 | Provisioning-verification unit and integration tests | planned |
| INV-RUN-007 | Concurrent document edits are never overwritten | 3, 4 | Compare-and-swap helper tests always sending the observed `baseRevisionId` | blocked-upstream |
| INV-RUN-008 | A project wake is requested only after verified provisioning; a repeated wake cannot repeat provisioning | 7 | Wake-intent recording test with retry tolerance | planned |
| INV-RUN-009 | A missing or incompatible host capability prevents activation | 2 | Startup capability-check test against `minimumHostVersion` | planned |
| INV-RUN-010 | Plugin data loss does not erase Paperclip mission evidence | 4, 5 | Rebuild-from-documents reconciliation test | planned |
| INV-RUN-011 | Plugin uninstall does not delete mission projects or issues | 9 | Uninstall/reinstall clean-room suite | planned |

## Upstream blockers

Dynamic project creation (INV-RUN-003 and INV-RUN-005) and document
compare-and-swap (INV-RUN-007) require unreleased Paperclip host contracts
recorded in `dev/paperclip-host-baseline.json`. They remain
`blocked-upstream` until those contracts are merged and released. They are not
mocked as production support.

No test in this repository claims to verify live host limits, live host
idempotency, or any behavior of an unreleased Paperclip host version.
