# M1B Plan Review

Date: 2026-08-23

Reviewed plan:
`docs/plans/milestones/0001b-idempotent-project-creation.md`

Audited Paperclip base:
`63df7ad2b3b26e3684e322d421d767f3f107635e`

## Reviewers

- Claude Opus 5 through Claude Code CLI, maximum effort, read-only source audit
- GPT-5.6 Luna, maximum reasoning, read-only source audit and final confirmation
- Codex supervisor reconciliation and repository verification

## Reconciled findings

The first draft was not accepted. Review identified that replay validation was
ordered incorrectly, existing project helpers could not safely join an outer
transaction, expected conflict outcomes could not be distinguished through the
current RPC error mapping, activity publication needed to be deferred until
commit, and mutable field classes made the public surface too broad.

The accepted candidate was narrowed to organizational project fields only. It:

- uses deterministic `projects.create` replay without a second lookup method;
- returns `created`, `replayed`, `conflict`, or `gone` as domain values;
- scopes keys by company and installed plugin identity;
- hashes a strict, pure DTO before mutable live-state validation;
- validates goal ownership only on the first creation;
- preserves project shortname uniqueness;
- stores a dedicated lifetime binding with an `ON DELETE SET NULL` tombstone;
- distinguishes soft uninstall from explicit hard data removal;
- commits project, goal links, binding, and activity atomically;
- publishes activity only after commit through the existing production seam;
- treats domain events and telemetry as non-authoritative reconciliation hints;
- excludes project update, workspaces, commands, environments, secrets,
  execution policies, archival state, lead-agent assignment, and protected
  database fields.

## Existing upstream work

The plan must reference Paperclip PR #6751. That PR defines the same capability
name but directly forwards an unchecked create payload to the project service,
does not preserve route controls, and has no durable concurrency or replay
contract. The public design issue must also distinguish runtime-dynamic phase
creation from the existing manifest-bound `projects.managed` contract and reuse
the issue-create idempotency mechanism as implementation precedent.

## Verdict

Luna's final verdict was **approve with no remaining blocking issues**.

Opus's final verdict was **approve with three required documentation revisions**:
document the managed-project precedent, correct the event-delivery rationale,
and preserve project shortname uniqueness. All three revisions are incorporated
in the reviewed plan.

M1B implementation remains blocked on the public upstream design discussion,
fresh upstream-head audit, and a separate file-bounded implementation brief.
