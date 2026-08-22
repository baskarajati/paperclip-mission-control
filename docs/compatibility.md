# Compatibility Policy

## Host contract

- Declare the Paperclip plugin API version.
- Declare a minimum supported Paperclip host version.
- Probe required capabilities before activation.
- Refuse activation when correctness cannot be established.
- Never silently patch unsupported Paperclip versions.

## Support matrix

The first alpha will test:

- The first stable Paperclip release containing the idempotent dynamic
  `projects.create` plugin capability
- Current Paperclip stable release
- Current Paperclip master or canary as a non-blocking forecast lane

Development currently audits Paperclip master commit
`cc42a67e7e9e8eb183097afc8ff4ebfa694fb3e0`. That commit is not a public
compatibility promise.

## Required host capability

Project-per-phase requires dynamic project creation. Current Paperclip exposes
only project reads and manifest-managed static project reconciliation to plugins.
Mission Control will not call internal project HTTP routes or write core tables.
Public release is blocked until Paperclip ships a capability-gated, host-side
idempotent project creation method.

## Core defects

- Track unrelated Paperclip defects separately.
- Prefer a fixed minimum host version over compatibility shims.
- If a temporary shim is unavoidable, require an upstream issue, explicit opt-in, idempotency, and a removal version.

## State ownership

- Paperclip owns company business state.
- Plugin state may contain schema versions, cursors, transition identifiers, reconciliation checkpoints, and bounded counters.
- Reconciliation always re-reads Paperclip after writes.
