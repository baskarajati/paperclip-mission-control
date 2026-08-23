# Milestone 0 Brief: Contract Fixtures and Traceability

Owner approval: 2026-08-23

Implementor: Ox Alpha

Supervisor: Codex

## Outcome

Establish executable, repository-owned v1 data contracts before plugin runtime
work. This milestone must make valid examples pass, required invalid examples
fail with stable semantic codes, and map every architecture failure invariant to
a future verification milestone.

## Allowed files

- `package.json`
- `pnpm-lock.yaml`
- `contracts/**`
- `fixtures/**`
- `tests/contracts/**`
- `dev/paperclip-host-baseline.json`
- `docs/testing/traceability.md`

Do not modify this brief or any existing governance, architecture, ADR, review,
compatibility, contribution, security, or supervision file.

## Required contracts

Provide JSON Schema Draft 2020-12 schemas and executable semantic validation for:

- Mission charter
- Phase plan
- Validation contract
- Phase validation report
- Transition identity and canonical project-create request

Every top-level document has `schemaVersion: 1`. Stable domain IDs use a bounded,
lowercase kebab-case grammar. Unknown fields fail validation unless the schema
explicitly identifies an extension point.

The transition identity contract includes:

- Company, mission, current phase, and next phase IDs
- Bound plan and evidence revision IDs
- A transition key no longer than 255 characters
- Canonical project-create request data
- SHA-256 request hash

The canonical request is deterministic and contains no timestamp, random value,
locale-dependent value, or ambient default. Hash verification is executable.

## Fixtures

Provide at least one valid fixture for every contract and invalid fixtures for:

- Unknown schema version
- Duplicate stable IDs
- Missing assertion evidence
- Waiver without explicit human approval evidence
- Invalid or mismatched transition request hash
- Transition key over 255 characters
- Non-canonical or nondeterministic project request field

Invalid fixtures declare their expected stable error code outside the contract
payload so the payload itself remains realistic.

## Package boundary

- Use pnpm and a private root package.
- Pin `packageManager` to `pnpm@9.15.4`.
- Require Node `>=24.11.0`, matching the audited Paperclip host policy.
- Runtime dependencies are prohibited.
- Development dependencies may include only the smallest maintained JSON Schema
  validation tools needed for this milestone.
- Tests run with `pnpm test` under Node 24 or newer.

## Development baseline

`dev/paperclip-host-baseline.json` records Paperclip repository, audited commit
`cc42a67e7e9e8eb183097afc8ff4ebfa694fb3e0`, audit date, API version, and the two
unreleased blocking host contracts. It must state that the commit is development
metadata and not a production compatibility promise.

## Traceability

`docs/testing/traceability.md` maps every failure invariant in the accepted
architecture to:

- A stable test/invariant ID
- The milestone that will prove it
- Planned evidence type
- Current status (`covered`, `planned`, or `blocked-upstream`)

Milestone 0 contract invariants must be `covered`. Dynamic project creation and
document compare-and-swap must be `blocked-upstream`, not mocked as production
support.

## Required verification

- First demonstrate at least one required invalid fixture incorrectly passes or
  has no validator before implementation.
- `PATH=/opt/homebrew/bin:$PATH pnpm install --frozen-lockfile`
- `PATH=/opt/homebrew/bin:$PATH pnpm test`
- `git diff --check`
- Confirm `package.json` has no `dependencies` field or it is empty.
- Confirm no file imports Paperclip server internals.

## Handoff

Return only:

- Files changed
- Red/green evidence actually run
- Remaining risks or questions
- `git diff --stat`

Do not commit, push, open a pull request, install into Paperclip, publish a
package, or modify the main worktree.
