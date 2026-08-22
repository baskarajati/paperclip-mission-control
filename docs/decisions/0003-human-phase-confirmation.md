# ADR 0003: Require Human Confirmation for Every v1 Phase

Status: proposed

## Decision

Every v1 phase transition requires a Paperclip confirmation interaction accepted
by the configured human governance principal. The confirmation is bound to exact
plan, validation, and next-phase brief revisions.

## Consequences

- No agent can silently change strategy or provision the next project.
- Revised evidence invalidates earlier confirmation.
- Agent-addressed interaction wake behavior is not a correctness dependency.
- Policy-driven automatic transitions are deferred.
