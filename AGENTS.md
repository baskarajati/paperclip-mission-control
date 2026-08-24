# Agent Instructions

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

## Architecture

- Paperclip is the source of truth for goals, projects, issues, documents, interactions, approvals, budgets, and runs.
- Use documented Paperclip plugin SDK and HTTP contracts only.
- Do not import Paperclip server internals or write directly to Paperclip tables.
- Make event handling idempotent and reconciliation-based.
- Fail closed when compatibility cannot be established.

## Verification

- Write a failing test before behavior changes.
- Report only commands that actually ran and their results.
- Follow `docs/supervision-protocol.md` for milestone handoff.
