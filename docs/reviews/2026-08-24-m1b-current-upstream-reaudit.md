# M1B Current-Upstream Re-audit

Date: 2026-08-24

Issue: [#14](https://github.com/baskarajati/paperclip-mission-control/issues/14)

Audited upstream repository: `paperclipai/paperclip`

Audited upstream commit:
`4ffa8de4e2ef4c86f101be6b21ffc1f3c75caa61`

Prior accepted-plan audit commit:
`63df7ad2b3b26e3684e322d421d767f3f107635e`

## Verdict

The upstream implementation assumptions still hold. The audited M1B surface has
no source diff across the 19 upstream commits between the two pinned commits.
Paperclip still has no dynamic project-create plugin capability. The public
design issue remains open without a maintainer answer, PR #6751 remains open,
and the narrower historical PR #9100 is closed without merge.

Implementation is ready only for the reviewed private-local lane and only at the
pinned commit. Public contribution remains blocked on upstream direction and the
owner publication gate.

Two design defects must be repaired before implementation. The owner selected
`leadAgentId` for the M1B DTO and the merged Milestone 0 contract requires it,
while the accepted M1B plan still excludes it. The accepted result also returns
Paperclip's full `Project`, which would bypass the separate `projects.read`
capability. This branch adds the first-create lead ownership check, narrows every
mutation result to a project ID, and supplies a file-bounded brief. Those plan
changes require peer acceptance under the supervision protocol.

## Source evidence

- The HTTP route still validates company access, environment selection,
  agent-host workspace commands, and secret bindings before calling the project
  service (`server/src/routes/projects.ts:153-179`). The M1B DTO excludes those
  control-plane fields, so it does not need to duplicate their normalization.
- The project service still closes over its supplied executor, resolves
  shortname collisions before insertion, writes the legacy goal ID, inserts goal
  links, and hydrates through helper calls (`server/src/services/projects.ts:403-414,
  483-510,543-575`). The M1B core must therefore receive and consistently use a
  transaction executor.
- The shared validator still treats `leadAgentId` as an ordinary optional project
  field (`packages/shared/src/validators/project.ts:103-117`), and the database
  stores it as a nullable agent foreign key
  (`packages/db/src/schema/projects.ts:7-30`). The plugin path adds a stricter
  same-company check on a binding miss.
- The public `Project` read model includes environment, workspace, execution
  policy, pause, archive, codebase, budget, and managed-resource fields
  (`packages/shared/src/types/project.ts:78-113`). Returning it from a mutation
  guarded only by `projects.create` would bypass `projects.read`, so the result is
  narrowed to a project ID.
- The host client still enforces both the method capability and invocation
  company scope before delegation
  (`packages/plugins/sdk/src/host-client-factory.ts:594-699`). M1B must add its
  method to that live map and to the server's parallel operation map.
- `logActivity` still supports transaction-local persistence with deferred
  publication (`server/src/services/activity-log.ts:151-158,217-228`). M1B can
  reuse this seam and publish only after commit.
- Soft reinstall still reuses the plugin row, while hard removal deletes it
  (`server/src/services/plugin-registry.ts:139-163,249-278`). The proposed plugin
  foreign-key cascade preserves the intended replay and hard-removal semantics.
- The issue-create precedent still uses a transaction advisory lock, lookup
  before insert, and a unique company/key binding
  (`server/src/services/issues.ts:7072-7111,7326-7333` and
  `packages/db/src/schema/issue_create_idempotency_keys.ts:5-24`).
- Migration generation still compiles schema from `dist/schema/*.js`, and the
  journal currently ends at `0226` (`packages/db/drizzle.config.ts:3-9`,
  `packages/db/src/migrations/meta/_journal.json`).

## Drift review

The exact audit command returned `AUDITED_SURFACE_DIFF=none` for the route,
project and activity services, plugin host and capability services, plugin
lifecycle registry, plugin SDK, shared constants and validator, relevant database
schemas, and migration journal. The 19 intervening commits do not change the M1B
contract surface.

The two adjacent commits named in issue #14 also do not invalidate the design:

- environment capability classification does not matter because the strict M1B
  DTO excludes environment and workspace policy fields;
- plugin boot retry does not replay project creation by itself. A worker retry
  reaches the same host idempotency binding, and only a first create queues
  publication or telemetry.

Later upstream work through `4ffa8de4e` is confined to Runner, bridge hardening,
UI, lockfile, and CI areas relative to the issue's `a14e51d` snapshot. Runner now
has a private code-unit-ordered `canonicalJson` for its replay protocol
(`packages/paperclip-runner/src/protocol/replay-contract.ts:119-131`). It is not
an exported shared host contract, and it preserves `undefined` differently from
the SDK's private config canonicalizer. M1B therefore keeps one request-specific
normalizer, serializer, and hash in its shared validator module rather than
importing a private Runner implementation or changing existing portability hash
outputs.

## Reconciled design findings

### Accepted: add `leadAgentId`

The owner-selected upstream addition is necessary for the merged canonical
Mission Control request. Hash it with the project payload and validate the agent's
company only on a binding miss. Replay must remain reachable after later agent
state changes.

### Accepted: return only `projectId`

Creation authority is not read authority. `created` and `replayed` return only
the status and project ID. A plugin must separately declare `projects.read` and
call `ctx.projects.get` to inspect the project. This keeps replay from exposing
fields that were never part of the create DTO.

### Accepted: keep host and Mission Control hashes distinct

The host hash detects reuse of one host key with a different normalized project
payload. Mission Control's hash guards the full transition identity. M1B does not
reuse or persist the plugin's transition hash as host authority.

### Accepted: preserve post-commit best-effort publication

The activity row is atomic business evidence. The event and telemetry are
non-authoritative hints. M1B must not add a one-off outbox, and replay must not
repeat either side effect.

### Not expanded: global project shortname serialization

The current project table has no company/shortname unique constraint, and the
existing resolver reads then inserts. M1B preserves the existing resolver and
serializes identical idempotency calls. It does not claim to repair concurrent
shortname allocation across unrelated HTTP and plugin creates. A global repair
would change the existing route and is outside this milestone.

### Accepted: bound caller-controlled input

The current HTTP validator leaves project text and goal-array cardinality mostly
unbounded. The new plugin capability applies explicit name, description, and
unique-goal limits before hashing or database work. This is a capability-local
resource bound and does not change the HTTP route.

## Public coordination state

- [Issue #12040](https://github.com/paperclipai/paperclip/issues/12040) is open
  with the `leadAgentId` addition posted and no maintainer reply.
- [PR #6751](https://github.com/paperclipai/paperclip/pull/6751) is open and still
  proposes the broader unchecked create/update surface.
- [PR #9100](https://github.com/paperclipai/paperclip/pull/9100) is closed without
  merge and had no durable idempotency contract.
- Current upstream contribution rules also request roadmap coordination in
  Discord for a core feature. No upstream implementation PR should be opened
  before that coordination and the owner publication gate.

## Commands run

```sh
git fetch origin --prune
git rev-parse origin/master
git diff --quiet 63df7ad2b..origin/master -- <audited paths>
git rev-list --count 63df7ad2b..origin/master
gh issue view 12040 -R paperclipai/paperclip
gh pr view 6751 -R paperclipai/paperclip
gh pr view 9100 -R paperclipai/paperclip
gh search prs projects.create --repo paperclipai/paperclip
```

Observed result: upstream head `4ffa8de4e2ef4c86f101be6b21ffc1f3c75caa61`,
19 intervening commits, and no audited-surface diff.

## Gate

Do not begin M1B implementation until a peer contributor accepts this plan
amendment and implementation brief. After acceptance, local-only work may begin
at the exact pinned Paperclip commit. Any upstream movement or maintainer response
invalidates the pin and triggers another audit.
