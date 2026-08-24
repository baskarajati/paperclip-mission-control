# M1B Current-Upstream Implementation Brief

Status: proposed; requires peer acceptance before implementation

Supervisor: Codex

Implementor: GPT-5.6 Luna at maximum reasoning

Upstream repository: `paperclipai/paperclip`

Required implementation base:
`4ffa8de4e2ef4c86f101be6b21ffc1f3c75caa61`

Public design discussion:
[paperclipai/paperclip#12040](https://github.com/paperclipai/paperclip/issues/12040)

## Objective

Implement the accepted create-only, capability-gated, host-idempotent
`projects.create` contract from
`docs/plans/milestones/0001b-idempotent-project-creation.md`. This brief is for
the reviewed private-local Paperclip integration lane. Do not open an upstream
pull request until a maintainer answers the design discussion and the owner
authorizes publication.

Stop before editing if `origin/master` is not the required implementation base,
if issue #12040 has new maintainer direction, or if PR #6751 or another project
mutation contribution has moved. Repeat the source audit instead.

## Required red evidence

Add focused tests first. They must fail for the missing M1B contract and prove:

- `projects.create` is absent from the manifest capability set and both runtime
  capability maps;
- the worker RPC, real host client, and SDK fake expose no conforming create
  operation;
- the real host cannot persist a project-create idempotency binding;
- repeated, concurrent, conflicting, and deleted-project calls do not have the
  required result semantics;
- the current project insertion path cannot atomically join project, normalized
  goals, binding, and plugin-attributed activity in one transaction;
- a cross-company goal or lead agent is not accepted by the new strict path;
- replay currently cannot bypass later mutable goal or agent state;
- event and telemetry side effects cannot yet be shown to occur once and only
  after commit.

Do not use a compile error as the red test. Each red test must reach the intended
runtime or schema boundary.

## Allowed implementation surface

The implementor may edit only these upstream paths:

- `packages/shared/src/constants.ts`
- one new strict project-create validator under
  `packages/shared/src/validators/`, its direct export, and focused validator
  tests;
- `packages/plugins/sdk/src/types.ts`
- `packages/plugins/sdk/src/protocol.ts`
- `packages/plugins/sdk/src/worker-rpc-host.ts`
- `packages/plugins/sdk/src/host-client-factory.ts`
- `packages/plugins/sdk/src/testing.ts`
- `packages/plugins/sdk/README.md`
- focused SDK tests and protocol fixtures under `packages/plugins/sdk/tests/`;
- `server/src/services/plugin-capability-validator.ts`
- `server/src/services/plugin-host-services.ts`
- `server/src/services/projects.ts`
- `server/src/services/activity-log.ts` only if an existing exported
  post-commit seam cannot be reused unchanged;
- focused M1B tests under `server/src/__tests__/`;
- one new schema file under `packages/db/src/schema/` and its direct export;
- the generated migration, snapshot, and journal entries under
  `packages/db/src/migrations/`;
- one focused database schema or migration contract test under
  `packages/db/src/`;
- `doc/plugins/PLUGIN_SPEC.md`.

Any other path requires a revised brief. Do not change the HTTP project route,
UI, unrelated telemetry contracts, plugin lifecycle, managed-project behavior,
environment behavior, workspace behavior, or Mission Control.

## Exact contract

Add `projects.create` and:

```ts
type PluginProjectCreateInput = {
  companyId: string;
  idempotencyKey: string;
  project: {
    name: string;
    description?: string | null;
    status?: ProjectStatus;
    goalIds?: string[];
    leadAgentId?: string | null;
    targetDate?: string | null;
    color?: string | null;
    icon?: ProjectIconName | null;
  };
};

type PluginProjectCreateResult =
  | { status: "created"; projectId: string }
  | { status: "replayed"; projectId: string }
  | { status: "conflict"; projectId: string | null }
  | { status: "gone"; projectId: null };
```

The result contains no `Project` object. A caller needs `projects.read` and a
separate `ctx.projects.get` call to read project state. Tests must prove that
`projects.create` alone cannot expose environment, workspace, execution-policy,
pause, archive, codebase, budget, or managed-resource data on either create or
replay.

The validator is strict. It rejects unknown keys. It imports the current status
and icon registries. It normalizes the idempotency key with trim and Unicode NFC,
rejects an empty value, and caps it at 255 characters. It removes duplicate goal
IDs and sorts them by JavaScript code-unit order before hashing and persistence.
It applies explicit defaults before hashing.

Bound all caller-controlled collections and text in the strict validator. Use a
255-code-unit maximum for `name`, a 20,000-code-unit maximum for `description`,
and at most 100 unique goal IDs. Treat a larger input as a schema error before
hashing or opening a transaction.

Put M1B request normalization, code-unit-ordered serialization, and hashing in
the same new shared validation module. The host and tests import that one
implementation; do not duplicate it across SDK and server. Do not use
`packages/shared/src/portability-hash.ts`, whose locale-dependent key order is
not byte-stable across runtimes. Hash only the normalized `project` object as
`v1:sha256:<lowercase hex>`. Include `leadAgentId` in that object.

## Transaction and replay order

Implement one transaction-aware insertion core. Every query that decides or
performs creation uses the transaction executor.

1. Parse and normalize before opening the transaction.
2. Compute the request hash without reading mutable company state.
3. Begin a transaction.
4. Take a transaction-scoped advisory lock derived from company ID, installed
   plugin ID, and idempotency key.
5. Read the binding before validating goals or lead assignment.
6. Return `replayed` for a matching hash and live project.
7. Return `conflict` for a different hash without mutation.
8. Return `gone` for a matching tombstone without mutation.
9. On a binding miss only, verify all goals and the non-null lead agent belong to
   the invocation company.
10. Resolve the project name through
    `resolveProjectNameForUniqueShortname` and insert only the strict DTO.
11. Insert the normalized goal links with the same executor.
12. Insert the idempotency binding.
13. Persist one `project.created` activity row with `actorType: "plugin"` and the
    installed plugin ID.
14. Commit, then publish the queued activity and emit project-created telemetry.

The database unique key remains the final concurrency authority. A replay never
publishes activity, a plugin event, or telemetry. A post-commit publication
failure does not change the committed result and does not permit a second
project.

## Persistence

Add `project_create_idempotency_keys` exactly as specified by the accepted M1B
plan. The foreign keys must cascade on company and plugin hard deletion and use
`ON DELETE SET NULL` for project deletion. The live/tombstone binding has no
expiry. Soft uninstall preserves the plugin row and binding; hard data removal
deletes the binding while the created project remains ordinary company data.

Build `packages/db` before migration generation. Accept only generated migration
artifacts that contain the table, both required indexes, and all three foreign-key
actions. Do not hand-edit generated snapshots to hide drift.

## Required green evidence

Focused tests must prove every test listed in the accepted M1B plan, including:

- capability denial through the live host-client gate and the server operation
  map;
- missing, expired, and mismatched invocation company scopes;
- strict unknown/protected-field rejection;
- cross-company goal and lead-agent rejection without rows or side effects;
- exact created, replayed, conflict, and gone results;
- one project, binding, activity, event, and telemetry signal under concurrent
  identical calls;
- rollback after injected failures at each transaction boundary;
- replay after goal or lead-agent state changes;
- key isolation across companies and installed plugins;
- soft-uninstall replay and hard-removal binding cascade;
- in-flight create interleavings with soft uninstall, reinstall, and hard purge;
  either create commits before hard purge and the later purge removes its
  binding, or purge wins and creation rolls back, but no failed transaction may
  leave a project or activity row;
- stable non-ASCII canonical hash fixture;
- bounded-name, description, and goal-cardinality rejection before mutation;
- mutation results contain no full-project or read-side fields;
- post-commit readability and no replay side effects;
- SDK fake parity;
- no regression in HTTP project creation, shortname resolution, or
  manifest-managed project reconciliation.

After focused checks, run the upstream PR-ready commands at the pinned base:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

Report exact commands, versions, results, and any skipped test. A fake-only test
does not satisfy real-host, migration, authorization, transaction, concurrency,
uninstall, or publication acceptance.

## Handoff and stop conditions

The implementor returns the diff, red and green commands, results, risks, and
unresolved questions. The implementor does not commit, push, open or update a
public issue or pull request, install Paperclip, or mutate a live company.

Stop and return to architecture review if implementation requires
`projects.update`, a workspace or environment field, secret handling, a new
error model, an expiring binding, a plugin-side shim, an outbox, or a project
route rewrite.
