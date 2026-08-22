# Supervision Protocol

## Roles

- Project owner: approves architecture, implementation start, and releases.
- Codex supervisor: owns plans, acceptance criteria, review, verification, commits, pushes, and releases.
- Ox Alpha implementor: edits only the assigned isolated worktree and milestone.
- Opus 5 reviewer: performs independent read-only plan review.
- Ox Alpha reviewer: uses a fresh read-only session separate from implementation.

## Planning gate

1. Codex writes the architecture and milestone plan.
2. Opus 5 reviews the complete plan read-only.
3. A fresh Ox Alpha session reviews the same plan read-only with maximum requested reasoning effort.
4. Codex verifies findings against current Paperclip source and contracts.
5. Codex records accepted and rejected findings with reasons.
6. The project owner approves implementation.

## Implementation gate

1. Codex creates an isolated worktree and milestone brief.
2. Ox Alpha writes the failing test and smallest implementation.
3. Ox Alpha returns the diff, commands run, results, risks, and unresolved questions.
4. Codex inspects the diff and runs independent verification.
5. Rejected work returns as a bounded correction brief.
6. Codex alone decides whether the milestone is accepted and committed.

## Prohibited implementor actions

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
