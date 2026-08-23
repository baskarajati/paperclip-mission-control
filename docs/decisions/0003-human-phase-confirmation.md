# ADR 0003: Require Human Confirmation for Every v1 Phase

Status: accepted on 2026-08-23

## Decision

Every v1 phase transition requires a Paperclip confirmation interaction accepted
by the configured human governance principal. The confirmation is bound to exact
plan, validation, and next-phase brief revisions.

## Consequences

- No agent can silently change strategy or provision the next project.
- The host enforces the principal with `resolverPolicy: "human_only"`; the plugin
  never resolves its own confirmation.
- Revised evidence invalidates earlier confirmation.
- Agent-addressed interaction wake behavior is not a correctness dependency.
- Policy-driven automatic transitions are deferred.
