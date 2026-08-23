# Supervision Protocol

## Roles

- Project owner: approves architecture, implementation start, and releases.
- Codex contributor: plans, implements, reviews, verifies, commits, and pushes.
- Claude Opus 5 contributor: holds the same authority as Codex. The two are
  peers and they review each other.
- Ox Alpha implementor: edits only the assigned isolated worktree and milestone.
- Ox Alpha reviewer: uses a fresh read-only session separate from implementation.

A contributor never accepts its own contract change or its own governance
change. An independent reader always accepts that class of change.

## Merge policy

A contributor may open, review, and merge its own pull request when the change
touches only these paths:

- `docs/reviews/**`
- `tests/**`
- `.github/workflows/**` and other repository tooling
- source that declares no contract

A second reader must accept a pull request that touches:

- `contracts/**`
- `docs/plans/**`
- `docs/decisions/**`
- `AGENTS.md` or this file
- any upstream-facing contribution

## Git discipline

- Commit nothing directly to `main`. Every change arrives through a branch and
  a pull request.
- Name a branch `feat|fix|docs|chore/<scope>`.
- Write Conventional Commit subjects in the imperative mood.
- Keep the tree green at every commit, so `git bisect` stays useful. Record the
  red and green evidence in the pull request body.
- Add the `Co-Authored-By` trailer to every AI commit, as AGENTS.md requires.
- Squash-merge a pull request and delete the branch.
- Never force-push a shared branch. Never rewrite `main`.

## Upstream authority

A contributor may comment on, open, and update issues and pull requests in
`paperclipai/paperclip` and in the `baskarajati/paperclip` fork. Every upstream
claim cites a file and a commit. A contributor records each upstream action in
`docs/reviews/`.

## Planning gate

1. A contributor writes the architecture and milestone plan.
2. The peer contributor reviews the complete plan independently.
3. A fresh Ox Alpha session reviews the same plan read-only with maximum requested reasoning effort.
4. The author verifies findings against current Paperclip source and contracts.
5. The author records accepted and rejected findings with reasons.
6. The project owner approves implementation.

## Implementation gate

1. A contributor creates an isolated worktree and milestone brief.
2. Ox Alpha writes the failing test and smallest implementation.
3. Ox Alpha returns the diff, commands run, results, risks, and unresolved questions.
4. The briefing contributor inspects the diff and runs independent verification.
5. Rejected work returns as a bounded correction brief.
6. A contributor who did not write the change decides whether the milestone is
   accepted and committed.

## Prohibited actions for a bounded implementor

These limits apply to an implementor working under a bounded milestone brief.
They do not apply to a contributor.

- Pushes, pull requests, releases, or package publication
- Live Paperclip installation or company mutation
- Destructive git operations
- Scope expansion beyond the assigned milestone
- Disabling tests, governance checks, or security controls
- Direct changes to the Paperclip repository

## Evidence

Each accepted milestone records:

- Plan and acceptance-criteria references
- Exact diff and commit
- Verification commands and results
- Compatibility versions tested
- Known limitations and rollback instructions
