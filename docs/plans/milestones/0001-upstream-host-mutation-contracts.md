# Milestone 1 Brief: Upstream Host Mutation Contracts

Owner approval: 2026-08-23

Temporary implementor: GPT-5.6 Luna at maximum reasoning while Ox Alpha is
quota-blocked

Supervisor: Codex

Upstream repository: `paperclipai/paperclip`

Audited upstream base: `05b35d4669cebea2e1d0bad194caf883b43d8550`

## Outcome

Add the two narrow Paperclip host contracts that Mission Control needs for safe
phase transitions. Keep the contributions reviewable as two focused upstream
pull requests, but do not mark Milestone 1 complete until both contracts are
merged and released in the same supported Paperclip version.

1. M1A exposes issue-document compare-and-swap through the public plugin SDK.
2. M1B adds capability-gated, host-idempotent dynamic project creation.

Mission Control may test against reviewed contribution commits during
development. It must not claim public compatibility until Paperclip releases
both contracts.

## Upstream coordination

- Search current public issues and pull requests before each contribution.
- Follow `paperclipai/paperclip` contribution and pull-request templates.
- Use public GitHub issue references only. Do not expose private Paperclip
  instance identifiers or Mission Control workspace links.
- M1A tracks `paperclipai/paperclip#12015`.
- M1B requires its own public feature/design discussion before implementation.

## M1A: Plugin issue-document compare-and-swap

Branch: `fix/plugin-document-upsert-cas`

Worktree: `/Users/realinorevandy/dev/paperclip-mc-m1a-document-cas`

### Allowed scope

- `packages/plugins/sdk/src/types.ts`
- `packages/plugins/sdk/src/protocol.ts`
- `packages/plugins/sdk/src/worker-rpc-host.ts`
- `packages/plugins/sdk/src/testing.ts`
- Focused tests under `packages/plugins/sdk/tests/**`
- `server/src/services/plugin-host-services.ts`
- One focused server test under `server/src/__tests__/**`
- Public plugin/API documentation directly affected by the SDK contract

Do not change database schema, migrations, REST document semantics, core
document-service conflict behavior, unrelated plugin capabilities, UI, lock
behavior, or Paperclip runtime configuration.

### Required behavior

- Add optional nullable `baseRevisionId` to the public issue-document upsert
  input.
- Forward the value unchanged through the worker protocol, RPC client, host
  client, and server plugin-host bridge.
- Delegate conflict authority to `documents.upsertIssueDocument`; do not add a
  weaker preflight comparison outside its transaction.
- Creating a missing document without a base revision succeeds.
- Creating a missing document with a base revision conflicts.
- Updating an existing document requires the current base revision.
- Missing or stale base revision conflicts without creating a new revision.
- The SDK testing harness enforces the same create/update/conflict contract as
  the real host. It must not accept blind updates.
- Existing company-scope and `issue.documents.write` capability enforcement is
  unchanged.

### Required red/green evidence

Before implementation, add focused tests that show:

- the worker RPC path drops `baseRevisionId`,
- the plugin host bridge cannot perform a valid existing-document update, and
- the SDK fake accepts a blind update that the real host rejects.

After implementation, prove:

- exact forwarding of `baseRevisionId` at every public boundary,
- successful create and current-revision update,
- missing and stale revision conflicts with no revision-number increase,
- create-with-base conflicts,
- cross-company and missing-capability behavior does not regress.

Run the smallest focused suites first, then the upstream PR-ready checks required
by `AGENTS.md`: `pnpm -r typecheck`, `pnpm test:run`, and `pnpm build`. Report any
baseline or environment failure exactly; do not hide it with exclusions.

### M1A handoff

The implementor returns only files changed, red/green commands and results,
remaining risks, and `git diff --stat`. The implementor must not commit, push,
open or edit the public issue/PR, install Paperclip, mutate a live instance, or
modify this brief. Codex independently reviews and verifies before committing.

## M1B: Idempotent dynamic project creation

M1B begins only after Codex audits the current project route, project service,
plugin capability validator, host protocol, SDK fake, telemetry, secret/env
normalization, workspace rollback, and migration conventions. Its separate
bounded implementation brief must preserve every existing project-create rule.

The contribution must provide:

- a `projects.create` manifest capability and SDK method,
- company and invocation-scope enforcement,
- a bounded idempotency key scoped by company and calling plugin,
- canonical request hashing and rejection of key/payload drift,
- atomic project creation plus durable plugin-origin binding,
- lookup by `(companyId, pluginId, idempotencyKey)`,
- convergence under replay, concurrency, response loss, and plugin checkpoint
  loss,
- existing environment, workspace, agent-host command, secret, activity, and
  telemetry behavior from the project route,
- SDK fake and public documentation support.

M1B must not expose a partial public capability whose host mutation or recovery
contract is not atomic.

## Milestone acceptance gate

Milestone 1 is accepted only when:

- both upstream contributions pass focused and full required checks,
- both public PRs satisfy Paperclip CI and review requirements,
- both changes are merged upstream,
- a Paperclip release contains both contracts, and
- Mission Control records that released version as its minimum host boundary.

Until then, `INV-RUN-003`, `INV-RUN-005`, and `INV-RUN-007` remain
`blocked-upstream`.
