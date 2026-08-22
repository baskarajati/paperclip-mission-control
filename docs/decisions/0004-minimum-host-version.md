# ADR 0004: Fail Closed Below the Minimum Host Version

Status: proposed

## Decision

Publish Mission Control only after Paperclip releases the required idempotent
dynamic project capability. Declare that release in `minimumHostVersion`, probe
required capabilities at startup, and refuse mutation when compatibility cannot
be established.

## Consequences

- Correctness does not depend on fragile version shims.
- Development may pin an unreleased Paperclip commit, but distribution cannot
  claim support for it.
- Compatibility testing covers the oldest supported release, current stable, and
  current master as a forecast lane.
