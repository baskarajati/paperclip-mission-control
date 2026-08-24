# Agent Instructions

- `CLAUDE.md` is a symlink to this file.
- Keep this file concise, vendor-neutral, and free of transient PR status.

## Mission

- Build one public Paperclip plugin that carries a governed mission across
  projects: derive completion evidence, obtain human confirmation, provision the
  next phase exactly once, and close the terminal mission with a final report.
- Prefer the smallest end-to-end slice that advances that continuity loop.
- Do not describe contracts, package scaffolding, or fake-harness evidence as a
  working continuity system.

## Package Manager and Commands

- Use **pnpm** with the version declared by `packageManager`.
- Require `node --version` to satisfy `engines.node`; never hardcode a local Node
  installation path. `.npmrc` sets `engine-strict=true`, so pnpm refuses an
  unsupported runtime. Without it pnpm ignores `engines`, and the suite passes
  green on an unsupported Node.
- Install with `pnpm install --frozen-lockfile`.
- Inspect the checked-out `package.json` scripts. Run `pnpm verify` when it
  exists; otherwise run every relevant available gate and `pnpm test`.
- Runtime dependencies require an accepted plan amendment.
- Run a focused contract test with:

```bash
node --test --test-name-pattern="<name>" tests/contracts/contracts.test.mjs
```

## Commit Attribution

- AI commits MUST include:

```text
Co-Authored-By: (the agent model's name and attribution byline)
```

## Authority

- Merged git state and accepted files under `docs/plans/` and `docs/decisions/`
  are authority. Open PRs and review notes are provisional until accepted.
- Read the applicable milestone plan plus:
  - `docs/plans/2026-08-22-mission-control-architecture.md`
  - `docs/plans/2026-08-22-mission-control-implementation.md`
  - `docs/compatibility.md`
  - `docs/testing/traceability.md`
  - `docs/supervision-protocol.md`
- Work only on the assigned milestone and acceptance criteria in an isolated
  worktree. Commit nothing directly to `main`.
- Stop on ambiguous ownership, unsupported host capabilities, conflicting
  authority, or evidence that invalidates the plan.

## Collaboration and Merge Gates

- Codex and Claude Opus 5 are peer contributors. The project owner relays work
  between their sessions; neither contributor dispatches or drives the other.
- Ox Alpha works only as the bounded implementor or fresh read-only reviewer
  defined by `docs/supervision-protocol.md`.
- A contributor never accepts its own change to contracts, plans, decisions,
  `AGENTS.md`, the supervision protocol, or an upstream contribution.
- Follow `docs/supervision-protocol.md` for branch, PR, review, merge, and
  evidence requirements.
- Never publish or release without the separate owner release gate.
- ADR 0005 local installation, configuration, and company mutation are
  owner-operated actions. Agents prepare and verify artifacts and commands but
  do not execute those actions.

## Architecture Invariants

- Paperclip owns business truth; the plugin owns orchestration mechanics only.
- Mission Control is a plugin, not a fork. Use documented SDK/HTTP contracts;
  never use a plugin-side compatibility shim, server-internal import, internal
  HTTP route, or direct Paperclip table write.
- Private-local and public execution use one plugin code path. The local lane
  requires the exact ADR 0005 source/build/migration/runtime lock and preflight.
- Events are latency hints. The periodic level-triggered sweep is the correctness
  and recovery path.
- Every v1 phase transition requires current evidence and explicit human
  confirmation. The plugin never resolves its own confirmation.
- Never write derived state into a document whose revision binds a confirmation
  or transition identity.
- Phase order is the mission-charter array order. The phase plan must contain the
  same phase IDs in the same order.
- Reuse the repository's canonical serializer/hash and the code registry owned
  by the validation or derivation layer; do not create parallel implementations.
- Unknown versions, stale or conflicting evidence, duplicate IDs, open hard
  blockers, and ambiguous ownership fail closed.

## Verification

- For behavior changes, first capture a failing test for the intended reason,
  then the passing run.
- A negative fixture must fail for its declared defect, not an unrelated schema
  error.
- SDK fakes do not prove real-host authorization, compatibility, concurrency,
  confirmation, document-CAS, installation, or idempotency semantics.
- Update `docs/testing/traceability.md` when an invariant's evidence or status
  changes.
- Report only commands actually run, exact results, compatibility versions,
  remaining risks, and unvalidated live/manual gates.
