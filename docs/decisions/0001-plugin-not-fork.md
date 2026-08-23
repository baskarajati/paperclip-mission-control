# ADR 0001: Distribute Mission Control as a Plugin

Status: accepted on 2026-08-23

## Decision

Build and distribute Mission Control as an independent Paperclip plugin. Submit
missing generic host capabilities upstream and declare the released minimum host
version. Do not maintain a Paperclip fork, monkey patch, or hidden compatibility
shim.

## Consequences

- Users receive a reusable installable product with an explicit compatibility
  boundary.
- Paperclip remains authoritative for business state and lifecycle controls.
- Public release waits for required SDK capabilities to ship upstream.
- Unrelated Paperclip defects remain separate upstream fixes.
