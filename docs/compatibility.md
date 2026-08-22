# Compatibility Policy

## Host contract

- Declare the Paperclip plugin API version.
- Declare a minimum supported Paperclip host version.
- Probe required capabilities before activation.
- Refuse activation when correctness cannot be established.
- Never silently patch unsupported Paperclip versions.

## Support matrix

The first alpha will define and test:

- Oldest supported Paperclip release
- Current Paperclip stable release
- Current Paperclip master or canary as a non-blocking forecast lane

## Core defects

- Track unrelated Paperclip defects separately.
- Prefer a fixed minimum host version over compatibility shims.
- If a temporary shim is unavoidable, require an upstream issue, explicit opt-in, idempotency, and a removal version.

## State ownership

- Paperclip owns company business state.
- Plugin state may contain schema versions, cursors, transition identifiers, reconciliation checkpoints, and bounded counters.
- Reconciliation always re-reads Paperclip after writes.
