# Mission Control v1 Architecture

Status: accepted by owner on 2026-08-23

## Outcome

Paperclip Mission Control turns a company mission into a sequence of governed
execution phases. When one phase has sufficient completion evidence, the plugin
proposes the next phase, waits for an explicit human confirmation, creates the
next Paperclip project exactly once, and seeds its execution contract.

The first public release targets self-hosted, single-node Paperclip. It is a
separately distributed plugin, not a Paperclip fork or a patch bundle.

## Product contract

A mission is successful when all of the following are true:

- A durable mission charter names the desired outcome, constraints, terminal
  evidence, governance owner, and ordered phases.
- Each phase maps to one Paperclip project and an issue-backed phase control
  record.
- Phase completion is derived from Paperclip evidence, never inferred only from
  elapsed time or an agent's prose claim.
- A human explicitly accepts every phase transition in v1.
- Acceptance causes at most one next project to be created, even after duplicate
  events, worker restarts, retries, or routine overlap.
- The next project receives its phase brief, validation contract, root execution
  issue, goal linkage, and nominated lead before agents are awakened.
- Mission completion produces a final report and cannot silently reopen.

The plugin may recommend work. It does not decide strategy, waive controls, or
declare success without configured evidence and confirmation.

## Design principles

- Paperclip owns business truth: companies, goals, projects, issues, documents,
  interactions, approvals, budgets, checkouts, and runs.
- The plugin owns orchestration mechanics: transition keys, event receipts,
  reconciliation leases, bounded retry metadata, and schema versions.
- Every trigger calls the same level-triggered reconciler. Event handlers never
  apply blind deltas.
- Events are optional latency hints. A periodic host job is the correctness and
  recovery path.
- All mutations are deterministic, attributable, idempotent, and followed by a
  fresh read.
- Missing capabilities, conflicting evidence, unknown schema versions, and
  ambiguous ownership fail closed.
- No direct writes to Paperclip tables, imports from Paperclip server internals,
  or calls to undocumented internal HTTP routes.

## Relationship to Paperclip Missions work

The closed Paperclip Missions branches remain useful design input, not a runtime
dependency. Mission Control reuses their strongest contract concepts:

- Issue-backed mission and phase control records
- Mission brief, plan, validation contract, decision log, milestone summary,
  validation report, and final report documents
- Stable feature, milestone, assertion, finding, and waiver identifiers
- Evidence-backed validation assertions and explicit waivers
- Preservation of checkout ownership, approvals, budgets, and blockers

Those branches model execution inside an existing project. Mission Control adds
the missing cross-project continuity loop and is implemented against the current
public plugin SDK.

## Managed resources

The manifest declares these stable managed resources and job:

- `mission-control`: a control project for mission and transition records
- `mission-steward`: a paused, zero-budget default agent that an operator may
  replace with an existing Chief of Staff
- `mission-continuity`: a managed skill installed for the selected steward
- `mission-reconcile`: a paused routine assigned to the steward and control
  project
- `mission-reconcile-sweep`: an instance-wide scheduled plugin job

The routine uses `skip_if_active`, `skip_missed`, and
`require_external_activity` with company scope. Its timer trigger is installed
disabled. The operator must explicitly select an assignee and activate a trigger.
It provides an optional agent-visible recovery surface and is not a correctness
dependency.

The scheduled job runs every five minutes and is the primary convergence driver.
It lists configured company scopes and reconciles only companies whose operator
has explicitly enabled Mission Control. Installation creates no mission and
performs no company mutation. Domain events reduce latency when delivered; manual
reconcile is the operator fallback.

## Mission data model

### Paperclip-owned records

Each mission has:

- A company goal representing the mission outcome
- One root issue in the Mission Control project with stable plugin origin data
- Versioned documents on the root issue:
  - `mission-charter`
  - `phase-plan`
  - `validation-contract`
  - `decision-log`
  - `final-report`
- One child control issue per phase with documents:
  - `phase-brief`
  - `phase-validation-contract`
  - `phase-validation-report`
  - `phase-handoff`
- One execution project per provisioned phase
- One root execution issue in each phase project linked back to its control issue
- One confirmation interaction for each proposed transition

Documents are versioned business evidence. Their schemas use stable IDs and
explicit `schemaVersion` fields. Unknown versions block automation.

### Plugin-owned records

The restricted plugin database namespace contains only operational records:

- `missions`: Paperclip IDs, observed document revisions, and reconciliation
  status
- `phase_bindings`: mission/phase IDs mapped to Paperclip project and issue IDs
- `transition_operations`: unique transition key, confirmation ID, state,
  deterministic request hash, attempts, last error, resulting project ID, and
  wake intent/result
- `event_diagnostics`: a bounded ring buffer used only for delivery and lag
  diagnostics
- `reconcile_leases`: company/mission lease with fencing token and expiry

Unique constraints enforce one phase binding and one transition operation per
mission phase. Paperclip documents remain authoritative if operational rows are
lost and can rebuild the plugin index.

## State machine

Mission states:

- `draft`
- `active`
- `awaiting_transition_confirmation`
- `transitioning`
- `blocked`
- `completed`
- `cancelled`

Phase states:

- `planned`
- `provisioning`
- `active`
- `validating`
- `awaiting_confirmation`
- `completed`
- `waived`
- `blocked`
- `cancelled`

Only the reconciler derives state. Stored state is a checkpoint and never
overrides current Paperclip evidence.

The normal transition is:

1. Read the mission snapshot with `ctx.issues.getSubtree`, including relations,
   documents, active runs, and assignees. Read orchestration summaries for
   approvals, costs, open budget incidents, and invocation blocks. Read current
   confirmation state with `ctx.issues.listInteractions`.
2. Validate document schemas and the configured completion assertions.
3. If evidence is incomplete, update the validation report and stop.
4. If evidence conflicts or a hard governance condition is open, mark the phase
   blocked and create no confirmation.
5. Call `ctx.issues.requestConfirmation` with an idempotency key derived from the
   transition key, `resolverPolicy: "human_only"`, `continuationPolicy: "none"`,
   and an `issue_document` target bound to the exact governing document key,
   revision ID, and revision number. The key is at most 255 characters; longer
   revision sets use a canonical SHA-256 digest.
6. Wait. Reconciliation may continue, but no next project is created before an
   accepted, current confirmation exists.
7. Revalidate evidence after acceptance. Superseded evidence invalidates the
   confirmation and requires a new one.
8. Atomically claim the transition operation and persist the canonical project
   request hash.
9. Create the next project through the supported idempotent project API using a
   payload that is a pure function of company, mission, phase, and confirmed
   evidence revisions. Clocks, randomness, ambient defaults, and unbound free
   text are forbidden.
10. Create or reconcile phase documents and the root execution issue.
11. Re-read all created records, record the binding, then wake the selected lead.
12. Complete the prior phase and append the decision log only after provisioning
    verification passes.

For the terminal phase, steps 9 through 11 are replaced with final-report
generation and mission-completion confirmation.

## Reconciliation and concurrency

Paperclip's plugin specification describes at-least-once events, but the
implementation at audited commit `cc42a67e7e9e8eb183097afc8ff4ebfa694fb3e0`
uses an in-process, fire-and-forget bus with no durable queue or redelivery.
Mission Control therefore treats events as lossy, best-effort latency hints.
There is no interaction-resolution plugin event; confirmation acceptance is
detected by the periodic sweep or manual reconcile. The worker subscribes only
to event types the host actually exposes.

The same reconciler is called by:

- Domain events
- The instance-wide scheduled sweep for explicitly enabled company scopes
- The optional managed agent routine
- A manual `Reconcile now` action
- Plugin startup recovery

A database lease serializes a mission locally. A fencing token prevents an
expired worker from committing a stale checkpoint. Database uniqueness, not the
lease alone, protects transition identity. Host-side idempotency protects dynamic
project creation across the failure window between host mutation and plugin
checkpointing.

The reconciler produces the same state with zero, one, or many event deliveries
in any order. Event IDs are not business deduplication keys. Self-generated
plugin operation events are recognized by stable origin IDs and may trigger
verification, but never create recursive work.

## Required upstream host contract

Current Paperclip master at audit commit
`cc42a67e7e9e8eb183097afc8ff4ebfa694fb3e0` exposes project reads and
manifest-managed project reconciliation, but no dynamic project mutation through
`PluginProjectsClient`. Calling `POST /companies/:companyId/projects` from a
worker would bypass the plugin capability boundary and is rejected by this plan.

Public v1 therefore has a hard upstream dependency:

- Add `projects.create` as a manifest capability.
- Add `ctx.projects.create(input)` to plugin SDK API v1.
- Require `companyId`, project fields, and a bounded `idempotencyKey`.
- Scope idempotency by company and calling plugin identity.
- Return the original project for a repeated identical key.
- Reject reuse of a key with a non-equivalent payload.
- Atomically create both the project and a durable plugin-origin binding that
  records plugin identity, origin key, idempotency key, canonical request hash,
  and resulting project ID.
- Resolve a created project by `(companyId, pluginId, idempotencyKey)` so a crash
  after host mutation but before plugin checkpointing is recoverable.
- Apply normal company authorization, validation, secret normalization,
  environment restrictions, activity attribution, and telemetry.
- Add protocol, host-client, capability, SDK testing harness, service, migration,
  route-equivalence, authorization, and retry/crash tests.

Current plugin document `upsert` also omits the core document service's required
`baseRevisionId`. As a result, the SDK cannot safely update an existing document,
while its fake harness accepts the write. The same upstream release must expose
`baseRevisionId` through the SDK/protocol/host bridge and preserve the core
service's atomic conflict behavior. Mission Control never performs blind document
updates.

Both contracts must be merged and released before Mission Control is installable.
The plugin then declares that release as `minimumHostVersion`. Until that version
exists, CI may test against a pinned Paperclip commit, but published packages
must not claim compatibility with an unreleased host.

Project update/archive support is deliberately deferred. v1 creates projects and
uses existing issue/document APIs for ongoing orchestration.

## Confirmation semantics

Every v1 phase transition uses the host's `human_only` resolver policy and targets
a human governance principal, not another agent.
This avoids relying on unresolved agent-addressed interaction wake behavior and
keeps strategy changes accountable. The selected steward prepares and monitors
the request; the human accepts or rejects it.

Confirmation is bound to:

- Mission ID and phase ID
- Exact phase plan revision
- Exact validation report revision
- Proposed next phase brief revision
- Target governance principal

Rejected requests return the phase to `active` or `blocked` with a decision-log
entry. The host returns an existing equivalent confirmation for a repeated
idempotency key, rejects a changed payload for the same key, and expires a pending
confirmation when its target document gains a revision. The plugin never resolves
its own confirmation. Edited evidence always requires a new confirmation.

Confirmation-to-provisioning latency is bounded by the five-minute sweep cadence
plus host/job delay. Operators can use manual reconcile when lower latency is
required.

## UI and operator workflow

The plugin UI is an operational console, not a second task system. It shows:

- Mission and phase state derived from Paperclip
- Evidence completeness and blockers
- Pending confirmation and revision bindings
- Last reconciliation, next recovery run, and degraded health
- Provisioned project links and transition history

Actions are limited to initialize mission, validate documents, reconcile now,
retry a failed operation, and cancel before provisioning. Confirmation itself
uses Paperclip's native interaction surface.

## Security and safety

- Request only required manifest capabilities.
- Do not resolve or persist plaintext secrets.
- Validate every plugin API/UI payload at the worker boundary.
- Escape operator-authored content in UI and treat documents as untrusted input.
- Cap document size, list pagination, event retention, retries, and diagnostic
  payloads.
- Attribute all mutations to the plugin or the acting principal.
- Never auto-enable a routine, grant an agent budget, or wake an agent during
  installation.
- Installation, upgrade, reset, retry, and uninstall are safe to repeat.
- Authoritative mission input documents are never overwritten. Plugin-owned
  document updates pass the exact observed `baseRevisionId`; a conflict causes a
  fresh derivation and bounded retry, then a visible blocked state.

## Upgrade and recovery

SQL migrations are append-only and checksum-verified by Paperclip. The worker
refuses startup on an unknown future schema. Before each release, upgrade tests
cover the oldest supported plugin schema and current schema.

On startup, the worker scans bounded incomplete operations and reconciles them
from Paperclip. If the host reports a project created for an idempotency key but
the plugin binding is missing, reconciliation records the existing project and
continues. If multiple candidate records exist, the mission blocks for human
repair.

Project create requests are canonical and deterministic. The transition row
stores their hash before the host call. Recovery refuses to reuse a claimed key
with another payload, including after a plugin upgrade. Host idempotency and the
plugin transition uniqueness constraint protect different failure boundaries;
neither replaces the other.

Uninstall leaves Paperclip business records intact. Reinstall rebuilds indexes
from origin-linked issues and documents. Plugin-owned database retention follows
Paperclip's uninstall policy.

## Observability

Structured activity and metrics include:

- Reconciliation outcome and duration
- Event delivery diagnostics and lag
- Confirmation age
- Transition attempt and result
- Idempotent project replay
- Blocked reason category
- Schema or host incompatibility

Logs use IDs and categories, not document bodies or resolved secrets.

## Compatibility boundary

The first public alpha supports:

- Self-hosted, single-node Paperclip only
- Plugin API version 1
- Node and package-manager versions required by the selected Paperclip SDK
- The first released host version containing idempotent `projects.create`

Cloud, multi-node workers, automatic phase confirmation, dynamic project update,
and Paperclip versions below the minimum host are explicit non-goals.

## Failure invariants

The implementation must prove:

- No confirmation means no next project.
- Stale confirmation means no next project.
- One transition key produces at most one project.
- Zero, duplicate, missing, and out-of-order events converge to the same state.
- A worker crash at every mutation boundary converges without duplicate projects.
- Failed provisioning never marks the previous phase complete.
- Concurrent document edits are never overwritten.
- A project wake is requested only after verified provisioning; a repeated wake
  is explicitly tolerated and cannot repeat provisioning.
- A missing or incompatible host capability prevents activation.
- Plugin data loss does not erase Paperclip mission evidence.
- Plugin uninstall does not delete mission projects or issues.

## Rejected alternatives

- Paperclip fork: creates permanent merge and distribution burden.
- Direct database writes: violates ownership and bypasses service invariants.
- Internal HTTP calls from the worker: bypasses declared capabilities and creates
  an unstable auth contract.
- Static manifest project per possible phase: cannot represent reusable,
  user-defined phase sequences.
- Treat phases only as issues in one project: does not satisfy project-per-phase.
- Agent-to-agent confirmation for v1: depends on a separate wake-path defect and
  weakens human governance.
- Timer-only polling: increases latency and cost while still requiring
  idempotency.

## Resolved review questions

- Project creation follows the host interaction precedent: scope by company and
  plugin, compare a canonical payload, return the original on an equivalent
  replay, and reject changed payload. Claimed keys are immutable across upgrades.
- Approval and budget-incident events exist. No interaction-resolution event
  exists, so confirmation acceptance depends on the scheduled sweep.
- The alpha supports new mission initialization and read-only onboarding import.
  Import remains non-mutating until a separate human confirmation.
- The exact minimum host version remains unset until both upstream contracts are
  released. This blocks publication, not pure contract implementation.
