# Agent Instructions

`CLAUDE.md` is a symlink to this file, so every agent reads one set of
instructions. Keep this file vendor-neutral.

## Package Manager

- Use **pnpm** after the package workspace is approved.
- Do not add runtime dependencies before architecture approval.

## Commit Attribution

- AI commits MUST include:

```text
Co-Authored-By: (the agent model's name and attribution byline)
```

## Authority

- Treat approved files under `docs/plans/` and `docs/decisions/` as authoritative.
- Work only on the assigned milestone and acceptance criteria.
- Follow `docs/supervision-protocol.md` for push and pull-request authority. Never
  publish or release without the separate owner release gate.
- Private-local installation, configuration, and company mutation under ADR 0005
  are owner-operated go-live actions. Agents may prepare and verify the artifacts
  and commands, but they do not execute those actions.
- Use an isolated worktree for implementation.
- Stop on ambiguous ownership, unsupported host capabilities, or conflicting state.

## Commands

`CLAUDE.md` is a symlink to this file. Every agent reads the same instructions.

**Check the runtime first.** The default `node` on this machine is v22, which is
below the `engines.node` floor of `>=24.11.0`. `pnpm` does not enforce the floor,
so the suite runs green on an unsupported runtime and the reporter output even
looks different. Prefix commands to select Node 25:

```bash
PATH=/opt/homebrew/bin:$PATH node --version   # expect v24.11.0 or newer
```

```bash
PATH=/opt/homebrew/bin:$PATH pnpm install --frozen-lockfile
PATH=/opt/homebrew/bin:$PATH pnpm test        # whole suite
```

Run one test by name, which `pnpm test` cannot do:

```bash
PATH=/opt/homebrew/bin:$PATH node --test \
  --test-name-pattern="transition keys stay within 255" \
  tests/contracts/contracts.test.mjs
```

There is no build step and no linter. `test` is the only script. CI runs the
same two commands on Node 24 and Node 25, plus a guard that fails when
`package.json` declares any runtime dependency, plus `git diff --check` over the
pull-request diff.

## Architecture rules

- Paperclip is the source of truth for goals, projects, issues, documents, interactions, approvals, budgets, and runs.
- Use documented Paperclip plugin SDK and HTTP contracts only.
- Do not import Paperclip server internals or write directly to Paperclip tables.
- Make event handling idempotent and reconciliation-based.
- Fail closed when compatibility cannot be established.

## How the system fits together

### Two repositories, one product

Mission Control is a Paperclip plugin, never a fork (ADR 0001). It needs two
host capabilities that upstream has not released: idempotent dynamic
`projects.create`, and `baseRevisionId` on plugin document upsert. Until both
ship in one Paperclip release, this repository can build pure contracts and
derivation only. It cannot publish.

Upstream work happens in sibling worktrees beside this one, against
`paperclipai/paperclip` with a `baskarajati` fork remote.
`dev/paperclip-host-baseline.json` pins the audited upstream commit. That commit
is development metadata, not a compatibility promise.

### The transition identity chain

This is the load-bearing concept, and it spans several files. Read it before
changing any contract.

```
transition identity  ->  transitionKey()  ->  projectCreateRequest.idempotencyKey
        |                                              -> host idempotency key
        +-- boundPlanRevisionId, boundEvidenceRevisionId
                     -> also the target revisions a human confirmation binds
```

The same bound revisions do two jobs. They mint the host idempotency key, and
they gate the human confirmation. The host expires a pending confirmation when
its target document gains a revision. So a write to a bound document does two
damaging things at once: it cancels the approval the transition waits for, and
it mints a new idempotency key, which makes the host create a second project for
one phase.

The rule that follows: **derived state never lives in a Paperclip document whose
revision binds a confirmation or a transition key.** Phase state belongs in the
plugin database. Issue #8 is the defect that established this.

### Contracts, fixtures, tests

- `contracts/v1/*.schema.json` hold shape only, JSON Schema 2020-12, every
  object `additionalProperties: false`.
- `contracts/validator.mjs` composes Ajv with the semantic rules JSON Schema
  cannot express. It owns the `MC_*` error-code vocabulary. Add a code here or
  nowhere.
- `contracts/v1/canonical.mjs` is pure: canonical JSON, SHA-256, the transition
  key, and the canonical project-create request. It imports `node:crypto` and
  nothing else. Never write a second serializer or a second hash.
- `fixtures/valid/` has one document per contract. `fixtures/invalid/<defect>/`
  holds a realistic payload plus a sibling `expected.json` naming the stable code
  it must fail with. The expected code stays outside the payload so the payload
  stays realistic. A pair fixture sets `"type": "pair"` and supplies both the
  validation contract and the report.

A negative fixture must fail for the reason it claims. Check that it is not
passing on an unrelated schema violation.

### Where authority lives

| Location | Role |
| --- | --- |
| `docs/plans/`, `docs/decisions/` | Authoritative. Cite them; do not re-litigate them |
| `docs/plans/milestones/` | One bounded brief or plan per milestone |
| `docs/reviews/` | Findings and reconciliations, including rejected ones |
| `docs/testing/traceability.md` | Every architecture invariant mapped to a test and a status: `covered`, `planned`, or `blocked-upstream` |
| `docs/compatibility.md` | Host version policy and the known host gaps |
| `docs/supervision-protocol.md` | Roles, merge policy, git discipline, and how a request reaches a peer agent |

### Ratified facts that look like open questions

Check here before proposing a design that re-decides one of these.

- Phase order is document order. The architecture ratifies "ordered phases". No
  ordering field exists, and none is needed. The terminal phase is the last one.
- Plugin events are latency hints, not a delivery contract. The five-minute
  sweep is the correctness path.
- A human accepts every phase transition in v1. The plugin never resolves its
  own confirmation.
- Paperclip owns business truth. The plugin owns orchestration mechanics only:
  transition keys, receipts, leases, retry metadata, schema versions.
- Unknown schema versions, duplicate IDs, missing evidence, conflicting
  evidence, and ambiguous ownership all fail closed.

## Verification

- Write a failing test before behavior changes. Quote the red run, then the
  green run. A red run that fails for an unrelated reason proves nothing.
- Report only commands that actually ran and their results.
- Follow `docs/supervision-protocol.md` for milestone handoff.
