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

The general architecture audit used Paperclip master commit
`cc42a67e7e9e8eb183097afc8ff4ebfa694fb3e0`. The later Milestone 2 host-enforcement
audit at `a14e51d592dd22e2e830e01f94e6783d55df9963` supersedes it for M2 planning.
Neither commit is a public compatibility promise or an integration lock.

Before a qualifying stable release exists, private local development may use
only the exact reviewed integration commit recorded by the repository's
development lock. The lock is an installation precondition, not a supported
version range. Preflight also proves a fresh build, the expected applied migration
journal, and the running host's required capability response. A changed base,
patch set, build identity, migration state, or capability result requires a new
review and conformance run.

## Required host capability

Project-per-phase requires dynamic project creation. Current Paperclip exposes
only project reads and manifest-managed static project reconciliation to plugins.
Mission Control will not call internal project HTTP routes or write core tables.
Public release is blocked until Paperclip ships a capability-gated, host-side
idempotent project creation method with atomic plugin-origin binding.

Current plugin document `upsert` omits the core service's required
`baseRevisionId`, so existing documents cannot be updated through the real host
without conflict even though the SDK fake accepts the write. Public release also
requires the SDK/protocol bridge to expose that compare-and-swap field.

The private-local lane supplies these contracts by composing their ordinary
Paperclip contribution commits on a reviewed fork branch. Mission Control uses
the resulting SDK directly. It does not emulate either contract in plugin code.

## Delivery semantics

The current plugin event bus is in-process and fire-and-forget despite the plugin
specification describing at-least-once delivery. Events are compatibility hints,
not a correctness contract. A five-minute instance job reconciles only companies
that explicitly enable Mission Control.

## Core defects

- Track unrelated Paperclip defects separately.
- Prefer a fixed minimum host version over compatibility shims.
- Do not put a Paperclip compatibility shim of any kind in Mission Control.
  Required contracts and unrelated host defects remain separate, reviewable
  Paperclip contributions that may compose into the locked integration branch;
  otherwise Mission Control fails closed.

## State ownership

- Paperclip owns company business state.
- Plugin state may contain schema versions, cursors, transition identifiers, reconciliation checkpoints, and bounded counters.
- Reconciliation always re-reads Paperclip after writes.
