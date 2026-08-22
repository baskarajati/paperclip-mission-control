# Mission Control v1 Implementation Plan

Status: draft for independent review

This plan is subordinate to
`docs/plans/2026-08-22-mission-control-architecture.md`. Each milestone requires
its own isolated worktree, bounded implementor brief, failing test first, Codex
review, and owner-approved release actions.

## Release strategy

Work proceeds in two repositories and never hides the host dependency:

- Paperclip upstream: add the narrow idempotent dynamic project capability.
- Mission Control: build the public plugin against the released capability.

No Mission Control package is published until the upstream capability is in a
Paperclip release and the manifest declares that minimum host version.

## Milestone 0: Contract fixtures and ADRs

Deliverables:

- Record ADRs for plugin-not-fork, business/operational state ownership, human
  transition confirmation, and minimum-host policy.
- Copy no Paperclip code. Create repository-owned JSON fixtures for mission
  charter, phase plan, validation contract, report, and transition identity.
- Create a traceability table from architecture invariants to planned tests.
- Pin the audited Paperclip commit only in development metadata.

Acceptance:

- Every document fixture has a version and stable IDs.
- Invalid IDs, duplicate IDs, missing evidence, unknown versions, and unapproved
  waivers have negative fixtures.
- The project creation dependency is represented as blocked, not mocked away in
  production configuration.

Verification:

- Schema fixture tests
- Markdown link and decision-index checks
- `git diff --check`

## Milestone 1: Upstream project creation contract

Repository: Paperclip, isolated contribution branch

Deliverables:

- `projects.create` capability declaration and validator support.
- SDK type and worker protocol method.
- Host client factory wiring and capability enforcement.
- Company/plugin-scoped idempotency persistence and service behavior.
- Project-service call preserving current validation, authorization, environment,
  secret, activity, and telemetry behavior.
- SDK testing-harness support and public documentation.

Acceptance tests:

- Missing capability is denied.
- Cross-company creation is denied.
- Valid creation returns a readable project.
- Identical plugin/company/key replay returns the same project.
- Same key with changed payload is rejected.
- Same key in another company or plugin is independent.
- Concurrent creates converge to one project.
- Retry after simulated response loss returns the original project.
- Invalid environment/workspace/secret data follows existing project rules.
- Activity and telemetry attribution identify the plugin.
- Existing project routes and managed-project tests do not regress.

Gate:

- Open an upstream issue or design discussion before PR if maintainers require it.
- Mission Control implementation may use a pinned reviewed Paperclip branch for
  development, but public compatibility remains blocked until release.

## Milestone 2: Plugin skeleton and compatibility gate

Deliverables:

- pnpm TypeScript workspace with worker, UI, test, and fixture packages only as
  needed.
- Manifest with least-privilege capabilities and managed project, agent, skill,
  and routine declarations.
- `minimumHostVersion` and startup capability check.
- Paused, zero-budget steward and disabled recovery trigger defaults.
- Reproducible build, typecheck, unit test, lint, dependency audit, and package
  content checks in CI.

Acceptance:

- Unsupported hosts fail before any company mutation.
- Install/reconcile/reset are repeatable.
- Installation does not wake agents, spend budget, or activate schedules.
- Package tarball contains only intended runtime assets.

## Milestone 3: Documents and pure state derivation

Deliverables:

- Versioned schema validators for mission and phase documents.
- Pure functions that derive mission, phase, evidence, and blocker state from a
  Paperclip snapshot.
- Stable transition-key generator bound to evidence revisions.
- Finding and waiver validation derived from the strongest Paperclip Missions
  contract concepts.

Acceptance tests:

- Table-driven coverage of every legal state transition.
- Unknown schemas, duplicate IDs, missing claims, stale evidence, open hard
  blockers, budget incidents, and ambiguous ownership fail closed.
- Property tests prove deterministic derivation and stable transition keys.
- No pure-state module imports network, SDK mutation, clock, or random sources.

## Milestone 4: Operational database and reconciler shell

Deliverables:

- Append-only SQL migrations for mission indexes, bindings, transition
  operations, event receipts, and fenced leases.
- Repository interfaces around Paperclip reads/mutations and plugin SQL.
- One level-triggered reconciler with dry-run result types.
- Startup recovery and bounded retry policy.

Acceptance tests:

- Migration from empty and every prior released schema.
- Unique constraints reject duplicate phase bindings and transition keys.
- Lease expiry plus fencing rejects stale writers.
- Duplicate and out-of-order event sequences converge.
- Operational database loss can rebuild indexes from fixtures.
- Retry exhaustion blocks visibly and does not advance state.

## Milestone 5: Mission initialization and read-only import

Deliverables:

- Initialize a new mission goal, control issue, phase issues, and documents.
- Dry-run import scanner for an existing onboarding project.
- Import produces a proposed charter/phase plan and diagnostics; it mutates only
  after a separate explicit human confirmation.
- Manual reconcile plugin action.

Acceptance tests:

- Initialization is idempotent by mission origin key.
- Existing onboarding data is never silently reclassified.
- Ambiguous project/goal/lead mappings require operator correction.
- Re-running after partial failure converges without duplicate issues/documents.

## Milestone 6: Evidence and confirmation loop

Deliverables:

- Evidence collection and validation-report upsert.
- Current-revision human confirmation creation and monitoring.
- Rejection, supersession, cancellation, and expiry handling.
- Event subscriptions feeding the common reconciler.
- Recovery routine using external-activity gating.

Acceptance tests:

- Incomplete or conflicting evidence creates no confirmation.
- Exactly one confirmation exists per transition key.
- Accepted stale confirmation cannot provision.
- Rejected confirmation records a decision and returns safely.
- Plugin-origin events do not create a feedback loop.
- Event loss is repaired by the routine; routine/event overlap is harmless.

## Milestone 7: Idempotent phase provisioning

Deliverables:

- Call supported `ctx.projects.create` with the transition key.
- Seed next phase brief, validation contract, root execution issue, goal links,
  lead, and control bindings.
- Verify all writes before waking the lead or completing the previous phase.
- Terminal-phase final report and mission-completion path.

Acceptance tests:

- No/current/stale confirmation invariants.
- Crash injection before and after every external mutation.
- Concurrent reconciles and response-loss retries produce one project.
- Partial provisioning resumes in place.
- Wake occurs once and only after verified provisioning.
- Terminal phase creates no extra project.

## Milestone 8: Operator UI and diagnostics

Deliverables:

- Mission list/detail, phase timeline, evidence status, blockers, confirmation
  link, transition history, compatibility status, and reconciliation health.
- Initialize, dry-run import, reconcile, retry, and cancel actions.
- Accessible loading, empty, error, stale, and blocked states.

Acceptance:

- UI does not expose a mutation unavailable through validated worker routes.
- Keyboard navigation, focus order, accessible names, contrast, and reduced
  motion receive manual evidence.
- Untrusted document content is escaped.
- Large histories are paginated and bounded.

## Milestone 9: Compatibility, fault, and release candidate

Deliverables:

- Test matrix for oldest supported host, current stable, and non-blocking master.
- Fresh install, upgrade, restart, uninstall/reinstall, and backup/restore tests.
- Failure injection for event duplication/loss/reordering, database outage,
  worker crash, host timeout, and agent wake failure.
- Threat model, operator guide, migration guide, rollback guide, changelog, SBOM,
  provenance, and signed release workflow.

Release gates:

- Upstream project capability exists in a stable Paperclip release.
- All architecture invariants have automated or explicitly manual evidence.
- No critical/high security findings; lower findings have disposition.
- Two clean-room installations succeed from the packed artifact.
- Owner approves public alpha release separately.

## CI lanes

Required on pull requests:

- Formatting and lint
- Typecheck
- Unit and schema tests
- Database migration tests
- Worker integration tests with SDK harness
- UI component/accessibility checks
- Package-content and forbidden-import checks
- Dependency and secret scan

Required before release:

- Oldest/current host integration matrix
- Crash and concurrency suite
- Upgrade and reinstall suite
- Packed-artifact clean-room smoke
- Manual UI and operator recovery checklist

Current Paperclip master is a forecast lane and may be non-blocking only after a
stable minimum-host lane exists.

## Supervised execution loop

For every implementation milestone:

1. Codex writes a brief with files, contract, acceptance tests, and prohibitions.
2. Codex creates an isolated worktree from the accepted parent commit.
3. Ox Alpha implements only that milestone with maximum requested reasoning.
4. Ox Alpha returns the diff and actual command results without committing,
   pushing, publishing, installing, or mutating live Paperclip.
5. Codex reviews every diff, runs independent verification, and either returns a
   bounded correction brief or accepts and commits it.
6. High-risk concurrency, migration, security, and release milestones receive a
   fresh independent Opus review before acceptance.

## Stop conditions

Stop and return to architecture review if:

- Upstream rejects the dynamic project capability or changes its semantics.
- Paperclip's plugin runtime becomes multi-node before lease assumptions are
  revised.
- A required domain event or interaction read contract is unavailable and the
  routine cannot safely reconcile it.
- A requested feature would bypass Paperclip ownership, approval, budget,
  checkout, or capability controls.
- The implementor needs to change Paperclip outside the approved upstream
  milestone.
