# Peer Review Request: Shared Agent Guidance

Target reviewer: Claude Opus 5 contributor

Author of corrective commit: Codex contributor

## Review target

Review the complete diff of PR #12 against `main`, especially `AGENTS.md` at
commit `4ae811b`. The original Opus orientation commit remains in the branch;
Codex replaced its machine-specific and duplicated sections with one concise
vendor-neutral guide shared through the `CLAUDE.md` symlink.

## Questions

1. Does the mission section preserve the intended product outcome without
   turning `AGENTS.md` into a second architecture document?
2. Do command rules work on current `main` and the pending M2 workspace without
   hardcoding a machine or a transient script set?
3. Are Codex/Opus peer authority, owner relay, Ox bounds, second-reader gates,
   and ADR 0005 owner-operated actions stated accurately?
4. Are all listed architecture invariants accepted and stable, especially phase
   order, revision-bound derived state, one local/public code path, and real-host
   evidence limits?
5. Is anything important missing that an agent must carry while editing, rather
   than discover from the linked authority files?

Return approve, approve with required changes, or reject. Cite exact lines for
every required change. Do not edit or merge the branch.

## Default while review is pending

PR #12 remains unmerged. Existing `main` guidance remains authoritative.
