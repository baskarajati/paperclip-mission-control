# Review: Canonical Project-Create Request Divergence

Date: 2026-08-23

Reviewer: Claude Opus 5, read-only contributor session

Status: findings raised; the owner selected Option A on 2026-08-23; the upstream
request is posted

## Scope

This review compares three contracts that must agree before Milestone 7 can
provision a phase project:

1. The merged Milestone 0 canonical request in
   `contracts/v1/transition-identity.schema.json` and `contracts/v1/canonical.mjs`.
2. The M1B public contract in `docs/plans/milestones/0001b-idempotent-project-creation.md`,
   now published upstream in
   [paperclipai/paperclip#12040](https://github.com/paperclipai/paperclip/issues/12040).
3. Current Paperclip `master` at `63df7ad2b3b26e3684e322d421d767f3f107635e`.

## Verified state

- Upstream `master` is unchanged at `63df7ad2b3b26e3684e322d421d767f3f107635e`.
  The M1B plan audit base has no drift.
- Issue #12040 is open, has no maintainer comment, no label, and no assignee.
  Its relationship with PR #6751 is unresolved. PR #6751 is open, conflicting,
  and last updated 2026-05-26.
- M1A pull request #12036 is open and mergeable. Greptile scored it 5/5. Every
  required check passed except `General tests (server (3/5))`, which timed out
  on unrelated setup-token PTY tests. It waits for a maintainer rerun and review.
- `pnpm install --frozen-lockfile` and `pnpm test` pass on `main`: 27 tests, 0
  failures, Node v25.6.0, pnpm 9.15.4.

## Finding 1: the two request DTOs do not match (blocking)

Milestone 0 defines a flat request with seven required fields:

```text
companyId, name, description, status, goalIds, leadAgentId, idempotencyKey
```

The published M1B contract defines a nested request and excludes `leadAgentId`:

```text
{ companyId, idempotencyKey, project: { name, description?, status?, goalIds?,
  targetDate?, color?, icon? } }
```

`INV-M0-010` in `docs/testing/traceability.md` asserts the seven-field set and is
marked `covered`. That status stays correct, because the Milestone 0 test proves
the Milestone 0 contract. The contract itself is now inconsistent with the host
capability this project asked upstream to ship.

Impact: if Paperclip ships the DTO exactly as published, Mission Control cannot
set the next-phase lead when it creates the phase project. The architecture
places the lead in the created project, and `canonicalProjectRequest` sends it.

Upstream evidence that `leadAgentId` is an ordinary organizational field:

- `packages/shared/src/validators/project.ts:110` declares
  `leadAgentId: z.string().guid().optional().nullable()` inside `projectFields`,
  next to `name`, `description`, `status`, `goalIds`, `targetDate`, `color`, and
  `icon`.
- `packages/db/src/schema/projects.ts:16` stores it as a nullable foreign key to
  `agents`.
- `server/src/routes/projects.ts:153` applies environment, workspace-command, and
  secret controls only. It applies no company-ownership check to `leadAgentId`.

`leadAgentId` is therefore not in the same risk class as `env`,
`executionWorkspacePolicy`, `workspace`, `archivedAt`, or `pausedAt`. Including
it needs one added control: on a first create, the agent must belong to the
request company. That control is identical in shape to the `goalIds` ownership
check the M1B plan already requires.

## Finding 2: the identity hash and the host drift hash have different scopes

Mission Control hashes the whole flat request. The host hashes the `project`
subtree only, with its own `v1:sha256:<hex>` canonical serializer. The two hashes
answer different questions, so this is not automatically a defect. It is
currently undocumented, and Milestone 7 persists a hash before mutation.

Required clarification before Milestone 7:

- The host hash is the sole authority for the `conflict` result.
- The Mission Control hash is a local drift guard over transition identity.
- Every field Mission Control sends inside `project` must be covered by the
  Mission Control hash, so a host `conflict` always maps to a change Mission
  Control can name.

## Finding 3: the host may rewrite the project name

`resolveProjectNameForUniqueShortname` in `server/src/services/projects.ts:483`
returns `"<name> 2"` when the derived short name collides. Its pathological
fallback returns `` `${requestedName} ${Date.now()}` ``, which is a clock value.

Consequences for Milestone 7:

- The persisted project name is not a pure function of the canonical request.
- Provisioning verification must not compare names for equality.
- Name and description must never be used for recovery or identity. The
  reconciled plan review already rejected deterministic-name recovery. This is
  the upstream mechanism that makes that rejection necessary.

Mission Control names are ASCII by schema, so they always take the suffix path.
The non-ASCII branch that skips suffixing does not apply.

## Finding 4: the lead agent is an unmodelled identity input

`transitionKey` in `contracts/v1/canonical.mjs` includes `nextPhaseLeadAgentId`.
The key is also the host idempotency key.

No contract document declares the phase lead. `contracts/v1/phase-plan.schema.json`
carries `phaseId`, `objective`, `state`, and `validationContractRef` only.
`contracts/v1/mission-charter.schema.json` carries `phaseId` and `objective`
only. The lead therefore enters transition identity from a source that no
governed document holds, and `boundPlanRevisionId` does not cover it.

Two consequences follow.

- A lead reassignment changes the transition key. The host then sees an
  unrelated first create and cannot return `conflict`. The plugin unique
  constraint on one binding per mission phase is the only guard, so the
  transition blocks instead of duplicating.
- A lead reassignment leaves no revision trail. The bound plan revision stays
  the same, so the evidence chain does not record who changed the lead.

Two internal repairs are available, and both are Milestone 0 contract changes:

1. Declare the lead in the phase plan. The lead becomes governed evidence,
   `boundPlanRevisionId` covers it, and the transition key can drop the field.
   A lead change then produces a new bound revision, which is the correct
   evidence behaviour.
2. Keep the lead in the transition key and accept that a lead change starts a
   new transition identity.

Repair 1 is the stronger option, because it makes the lead reviewable evidence
instead of ambient input. This choice is internal to Mission Control. It does not
change the upstream request.

## Finding 5: a phase-state write invalidates the transition key (blocking)

`contracts/v1/phase-plan.schema.json` requires `state` on every phase entry.
`fixtures/valid/phase-plan.json` carries three different phase states in one
document. The phase plan therefore changes whenever a phase changes state.

`fixtures/valid/transition-identity.json` binds `boundPlanRevisionId` to
`694ff4bb-73ee-54e9-b6ec-50e57bf88bb4`. The phase plan carries the same value in
`planRevisionId`. `transitionKey()` in `contracts/v1/canonical.mjs` includes
`boundPlanRevisionId`, and `canonicalProjectRequest()` uses that key as the host
idempotency key.

The consequence chain is:

1. A writer records a new phase state in the phase plan.
2. The document gains a new revision.
3. `boundPlanRevisionId` changes.
4. The transition key changes.
5. The host receives an unseen idempotency key and creates a second project for
   the same mission phase.

The repository does not yet define who writes `state`. Both answers are defects.
If the reconciler writes it, the key breaks during a live transition. If nothing
writes it, the field is dead and it misleads every future reader.

The architecture states that the reconciler alone derives state, and that stored
state is a checkpoint which never overrides Paperclip evidence. A derived
checkpoint must therefore not live inside a document whose revision is an
identity input.

This contradicts `INV-RUN-003`, "one transition key produces at most one
project". That invariant is `blocked-upstream`, so no current test can catch the
defect. It would first appear at Milestone 7.

Three repairs are available:

1. Remove `state` from the phase plan and hold phase state in the plugin
   database, where the architecture already places reconciliation checkpoints.
2. Bind the transition key to a document that never carries derived state.
3. Split the phase plan into an intent document and a status document.

Repair 1 is recommended. It keeps one writer per field and it needs no new
document type.

## Options

**Option A — ask upstream to include `leadAgentId` (recommended, selected).**
Comment on issue #12040 before the maintainer answers. Request one added field plus a
first-create company-ownership check on the agent. Milestone 0 then needs a
shape change from flat to nested. Finding 4 is decided separately.

**Option B — remove the lead from the create contract.** Drop `leadAgentId` from
the Milestone 0 canonical request and from the transition key. Assign the phase
lead through another supported path. No such plugin path is confirmed today, so
this option needs its own audit and a new architecture decision record.

**Option C — defer to a later capability.** Ship M1B as published and add the
lead later. The M1B plan excludes `projects.update`, so this leaves Mission
Control without a lead-assignment path for the whole of v1.

Option A is recommended because the field already exists in
`createProjectSchema`, it does not expand the authorization surface, and the
design discussion is still open with no maintainer position to reverse.

## Decision

The project owner selected Option A on 2026-08-23. Mission Control asks upstream
to include `leadAgentId` in the create-only DTO.

The request is posted as
[issue #12040 comment 5388138457](https://github.com/paperclipai/paperclip/issues/12040#issuecomment-5388138457).
A coordination note is posted on
[PR #6751](https://github.com/paperclipai/paperclip/pull/6751#issuecomment-5388140648),
so its author learns that a narrower create-only proposal exists.

Three follow-up items remain open:

- Milestone 0 contracts need a flat-to-nested shape change once the maintainer
  answers. That is a Codex-owned change.
- The transition-key placement in Finding 4 needs its own decision. It is
  independent of the upstream answer.
- Finding 5 is a blocking defect and needs a tracked repair before Milestone 7.

## Upstream request as posted to issue #12040

Posted on 2026-08-23 as
[comment 5388138457](https://github.com/paperclipai/paperclip/issues/12040#issuecomment-5388138457).

> **Addition to the proposed DTO: `leadAgentId`**
>
> One field is missing from the DTO above, and I would like maintainer direction
> before implementation.
>
> `leadAgentId` is an ordinary organizational column, not a control-plane field.
> In `packages/shared/src/validators/project.ts` it sits inside `projectFields`
> beside `name`, `description`, `status`, `goalIds`, `targetDate`, `color`, and
> `icon`. In `packages/db/src/schema/projects.ts` it is a nullable foreign key to
> `agents`. It carries none of the authorization surface that made me exclude
> `env`, `executionWorkspacePolicy`, `workspace`, and `archivedAt`.
>
> The proposed delta is one optional field and one check:
>
> ```ts
> project: {
>   name: string;
>   description?: string | null;
>   status?: ProjectStatus;
>   goalIds?: string[];
>   leadAgentId?: string | null;   // added
>   targetDate?: string | null;
>   color?: string | null;
>   icon?: ProjectIconName | null;
> }
> ```
>
> - On a binding miss only, verify the agent belongs to the request company.
>   This matches the `goalIds` ownership check already proposed. The existing
>   HTTP route applies no such check, so the plugin path stays the stricter of
>   the two. I am not proposing any change to the route.
> - `leadAgentId` joins the hashed `project` payload, so reuse of one key with a
>   different lead returns `conflict` rather than mutating anything.
> - The capability stays create-only. This does not reintroduce
>   `projects.update`.
>
> Without the field, a plugin can create a project but cannot record the agent
> responsible for it until a separate update capability exists. My use case
> assigns one lead agent per mission phase at creation time.
>
> I am happy to implement the contract with or without this field, whichever the
> maintainers prefer.

## Boundaries respected

- No approved plan, decision record, contract, fixture, or test was modified.
  Findings 1, 4, and 5 each require a contract change. Each one is raised for
  review rather than applied here.
- Upstream contact was limited to two comments on existing threads. No upstream
  issue, pull request, or branch was created or edited.
