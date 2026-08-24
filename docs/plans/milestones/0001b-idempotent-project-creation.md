# M1B: Idempotent Plugin Project Creation

Status: independently reviewed; upstream design discussion open in
[paperclipai/paperclip#12040](https://github.com/paperclipai/paperclip/issues/12040)

## Objective

Add the smallest safe `projects.create` plugin contract needed to create one
organizational Paperclip project per mission phase. A concurrent retry, lost
response, or lost plugin checkpoint must converge on the original project.

M1B is create-only. It does not expose `projects.update`, make the HTTP route
idempotent, or accept workspace, execution-policy, environment, secret,
archival, pause, actor, identifier, timestamp, or arbitrary database fields.

This plan was re-audited against Paperclip `master` commit
`4ffa8de4e2ef4c86f101be6b21ffc1f3c75caa61`. The implementation brief is
`0001b-current-upstream-implementation-brief.md`. A changed implementation base
requires another source audit before work begins.

## Existing upstream work and precedent

PR #6751 proposes `projects.create` and `projects.update`, but it is conflicting,
has no maintainer review, and calls `projectService.create` with an unchecked
runtime payload. It bypasses `assertNoAgentHostWorkspaceCommandMutation`,
`normalizeEnvBindingsForPersistence`, and
`assertEnvironmentSelectionForCompany`. It also lacks durable idempotency,
request-drift detection, concurrency convergence, and recovery semantics.

M1B must publicly reference #6751 and decide whether the maintainers prefer a
new create-only contribution or a replacement branch. It must not duplicate
protocol definitions if #6751 is revived, and it must not include that PR's
`projects.update` surface.

Paperclip's `issue_create_idempotency_keys` table and issue-create service are
the implementation precedent: a bounded key, transaction-scoped
`hashtextextended` advisory lock, unique database constraint, lookup before
creation, and binding inserted last. M1B deliberately differs in five ways:

- the key is scoped by installed plugin identity as well as company;
- a versioned request hash detects accidental key reuse with payload drift;
- live bindings do not expire because projects are low-cardinality and a
  mission phase may be retried long after the issue-create retention window;
- a null project foreign key is a durable tombstone rather than permission to
  recreate silently; and
- binding lookup precedes mutable live-state validation so committed retries
  remain reachable after referenced company state changes.

Paperclip also ships `projects.managed` and `plugin_managed_resources`, which
bind manifest-declared `(company, plugin, resource key)` records to projects.
That contract cannot serve runtime-generated phase keys: the project must exist
in the installed manifest, its binding has no request hash or nullable tombstone,
and reconciliation recreates a missing project as `relinked`. Reusing the table
would also expose a dynamic phase project as manifest-managed in normal project
reads. M1B therefore needs a separate capability and table. `gone` is terminal
for the original key to prevent silent duplication; an operator-approved
replacement records a new phase generation and uses a new derivable key.

## Exact public contract

Add the manifest capability `projects.create` and one SDK operation:

```ts
type PluginProjectCreateInput = {
  companyId: string;
  idempotencyKey: string;
  project: {
    name: string;
    description?: string | null;
    status?: "backlog" | "planned" | "in_progress" | "completed" | "cancelled";
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

ctx.projects.create(input): Promise<PluginProjectCreateResult>;
```

The final status enum must be imported from the current shared validator rather
than duplicated. The host parses a strict allowlisted schema and rejects unknown
or protected fields. `goalIds` is treated as an unordered set: duplicates are
removed and IDs are sorted before hashing and persistence.

Expected key-reuse outcomes are values, not thrown HTTP errors, because current
worker RPC maps host errors without an approved numeric plugin error code to
`INTERNAL_ERROR`. Schema, authorization, capability, and infrastructure failures
remain errors.

The mutation result returns only the project ID. It must not return Paperclip's
full `Project`, because that type includes environment, workspace, execution
policy, pause, archive, and other read-side fields. A plugin needs
`projects.read` and a separate `ctx.projects.get` call to read the created
project. `projects.create` does not grant an implicit project-read capability.

The idempotency key is trimmed, normalized to Unicode NFC, non-empty, and at
most 255 characters. SDK documentation must require a key derived from durable
domain identity, such as `mission:{missionId}:phase:{phaseNumber}`. A random key
cannot recover from checkpoint loss and is therefore incorrect usage.

`projects.create` alone is the recovery lookup. A replay re-derives the key and
payload and calls the same operation; M1B does not add `getCreated`.

## Capability and company boundary

- Add `projects.create` to the shared capability declaration.
- Update both live `METHOD_CAPABILITY_MAP` enforcement and the parallel server
  operation map, while testing denial through the live host-client gate.
- Resolve the company through the invocation scope and require it to equal the
  request company.
- Scope idempotency with the host's installed `pluginId`; the caller cannot
  supply or override plugin identity.
- On a first create only, validate every `goalId` and a non-null `leadAgentId`
  belong to the request company.
- The plugin activity actor is the installed plugin. No caller-supplied actor,
  user, agent, or run attribution is accepted.

The narrow DTO intentionally excludes workspace references, workspace commands,
`env`, `executionWorkspacePolicy`, `archivedAt`, `pausedAt`, and `pauseReason`.
`leadAgentId` is an organizational field and is company-validated on a binding
miss. Supporting any excluded field requires a later public design that
preserves its complete authorization and lifecycle contract.

## Stable request identity and replay order

1. Parse the strict public DTO, apply explicit defaults, normalize the
   idempotency key, and canonicalize the unordered goal-ID set.
2. Compute a pure request hash from `project` only. Do not query or normalize
   mutable company state before this hash.
3. Use a code-unit-ordered canonical JSON serializer that recursively sorts
   object keys and preserves semantically ordered arrays. Do not use the current
   locale-dependent `portability-hash.ts` ordering.
4. Store `v1:sha256:<hex>` and cover a fixed non-ASCII fixture with a literal
   expected hash.
5. Open the transaction, take the scoped advisory lock, and read the binding.
6. Matching hash plus live project returns `replayed` without revalidating goals
   or other mutable company state.
7. Different hash returns `conflict` without mutation. Return the live bound
   project ID when one exists so the plugin can deliberately reconcile.
8. Matching hash plus a null project binding returns `gone`.
9. Only a binding miss performs current-state ownership validation and creation.

Lookup before live-state validation is required for convergence when referenced
company state changes after a committed response is lost.

## Persistence and lifecycle

Add `project_create_idempotency_keys`:

```text
id uuid primary key
company_id uuid not null references companies on delete cascade
plugin_id uuid not null references plugins on delete cascade
idempotency_key text not null
request_hash text not null
project_id uuid null references projects on delete set null
created_at timestamptz not null
updated_at timestamptz not null
```

Required database authority:

- unique `(company_id, plugin_id, idempotency_key)`;
- partial lookup index on `(company_id, plugin_id, project_id)` where
  `project_id is not null`;
- the unique index remains the final concurrency authority even with the
  advisory lock.

`project_id is null` is the tombstone; no `deleted_at` column or deletion hook is
needed. The foreign key covers all project deletion paths. Live bindings and
tombstones remain for the lifetime of the company and soft-installed plugin.
Soft uninstall/reinstall retains the plugin row and bindings. Explicit hard
uninstall with data removal cascades the bindings; the operator has chosen to
discard recovery identity, while created projects remain normal company data.

## Transaction-aware creation core

Add a bounded transaction-aware project insertion helper rather than wrapping
the current service methods unchanged. The current `projectService` closes over
the pool, while goal and hydration helpers use that captured executor; calling
them inside an outer transaction can read through a different connection.

The plugin create transaction performs, in order:

1. scoped advisory lock and binding lookup;
2. first-create goal ownership validation;
3. resolve the name with Paperclip's existing
   `resolveProjectNameForUniqueShortname` rule, then insert the safe DTO;
4. goal-link inserts through the same transaction executor;
5. idempotency binding insert;
6. `project.created` activity persistence with `actorType: "plugin"` and the
   installed plugin ID.

Project, goal links, binding, and activity commit or roll back together. The
binding is inserted last and the unique index guards unexpected races.

Activity publication is deferred until after commit through the repository's
existing `postCommitPublications` seam. It must never publish an uncommitted
project and must never publish on replay. This matches the current production
pattern used by issue, decision, and onboarding creation, including its crash
window between commit and in-process publication. Although the plugin
specification describes at-least-once delivery, current publication is not a
durable queue; M1B does not expand scope to repair that host-wide gap. The
durable activity row and Mission Control reconciliation preserve correctness
without the event, so M1B does not introduce a one-off outbox. Telemetry is
likewise post-commit, new-create-only, and best effort.

The existing HTTP route retains its actor attribution and behavior. M1B may
extract executor-aware project/goal helpers used by both paths, but it must not
rewrite the route or expand the plugin DTO to achieve superficial schema parity.

## Expected implementation surface

- shared capability constants and a strict plugin project-create validator;
- plugin SDK types, protocol, worker RPC host, host client factory, fake harness,
  README, and protocol fixtures;
- server capability mappings and plugin host services;
- bounded transaction-aware project and goal insertion helpers;
- activity persistence plus post-commit publication integration;
- database schema/export, generated migration, migration journal, and schema
  contract test;
- `doc/plugins/PLUGIN_SPEC.md` capability and SDK documentation;
- focused authorization, isolation, atomicity, replay, event, telemetry, SDK,
  fake-parity, and regression tests.

Build `packages/db` before generating the Drizzle migration because its config
reads compiled `dist/schema/*.js`.

## Required tests

- missing capability and missing/mismatched invocation company scope fail;
- runtime unknown/protected fields fail strict parsing;
- create and replay results contain only the discriminant and project ID, with no
  full-project or read-side fields;
- cross-company goal IDs or lead-agent IDs fail without mutation;
- two requested names with the same derived shortname preserve Paperclip's
  unique URL-key naming behavior;
- valid creation persists one project, normalized goal set, binding, and plugin
  activity row;
- an injected failure after project, goals, binding, or activity leaves no
  partial rows;
- identical replay returns the original project despite later goal deletion or
  other mutable company-state drift;
- payload drift returns exact `conflict` status and mutates nothing;
- deleted project returns exact `gone` status through the foreign-key tombstone;
- an archived bound project still returns `replayed`; an operator-approved
  replacement uses a new phase-generation key;
- infrastructure failure throws and is distinguishable from domain outcomes;
- the same key is independent across companies and plugins;
- concurrent identical requests create one project, binding, activity, event,
  and telemetry signal;
- lost response and lost checkpoint converge using a re-derived durable key;
- canonical hash is stable across shuffled object keys and non-ASCII keys;
- soft uninstall/reinstall replays the original project;
- project is readable when the post-commit event subscriber runs;
- replay emits no duplicate event or telemetry;
- SDK fake returns the same result union and side-effect counts as the real host;
- HTTP project-create actor attribution and existing managed-project behavior do
  not regress.

## Gates and stop conditions

Before implementation:

- open a public design issue referencing PR #6751 and the issue-create
  idempotency precedent;
- resolve whether maintainers want a new create-only PR or a replacement for
  #6751;
- obtain agreement on the strict DTO, discriminated result, lifetime retention,
  tombstone, soft/hard uninstall, and best-effort post-commit event semantics;
- re-audit upstream head and write a file-bounded implementation brief;
- have Opus 5 and the designated implementor review the final brief.

During implementation, stop if upstream requests `projects.update`, workspace or
secret fields, a different error/result model, expiring live bindings, an outbox,
or a broad project-route refactor. Those changes require a new architecture
decision rather than silent scope growth.

Acceptance still requires focused and full Paperclip checks, green required CI,
5/5 Greptile with no actionable finding, maintainer approval, upstream merge,
and inclusion in a released Paperclip version before Mission Control consumes
the capability.
