# Mission Control v1 Plan Review

Date: 2026-08-23

Status: reconciled and accepted by owner

## Reviewers

- Claude Opus 5, fresh read-only Claude Code session with maximum effort
- Ox Alpha, fresh read-only OMP session with maximum requested reasoning
- Codex supervisor, source verification against Paperclip
  `origin/master` commit `cc42a67e7e9e8eb183097afc8ff4ebfa694fb3e0`

The first Ox Alpha process returned no tokens after 25 minutes and was
terminated. A fresh, narrower max-reasoning session completed the independent
review. Neither reviewer edited either repository.

## Verdict

Both independent reviewers found the direction conditionally sound and rejected
implementation from the original draft. All blocking findings accepted below
have been incorporated into the architecture and milestone plan.

## Accepted findings

- The current Paperclip event implementation is lossy and contradicts the
  specification's at-least-once statement. Events are now latency hints; an
  instance-wide five-minute job is the correctness sweep for explicitly enabled
  companies.
- Paperclip exposes no interaction-resolution plugin event. Confirmation
  acceptance is poll-detected with bounded latency.
- Paperclip already provides race-safe confirmation idempotency, `human_only`
  resolution, document-revision targeting, and stale expiry. The design now uses
  those host contracts directly and tests them on a real host.
- Dynamic project creation needs atomic host idempotency plus a durable
  plugin-origin binding and lookup. Deterministic names are not accepted as a
  correctness mechanism.
- Project creation payloads must be canonical and deterministic, with their hash
  persisted before the host call.
- Plugin document `upsert` omits the core service's required `baseRevisionId`.
  Exposing that field is now a second upstream prerequisite.
- The SDK fake diverges from production confirmation and document behavior.
  Harness conformance is characterized early and real-host evidence is mandatory.
- Event IDs are unsuitable business deduplication keys. The event receipt table
  became a bounded diagnostics buffer.
- Fencing protects only plugin checkpoints. Host mutations rely on host
  idempotency and compare-and-swap.

## Modified recommendations

- Opus suggested a scheduled job as the primary driver. Accepted with an
  additional explicit company-enable gate because jobs are instance-wide.
- Ox suggested deterministic project name/description search for orphan recovery.
  Retained only as possible diagnostics; correctness requires the upstream atomic
  origin binding and lookup.
- Both suggested client-side document re-read/retry. Source verification found a
  stronger existing core contract: `baseRevisionId` is already enforced by the
  document service but absent from the plugin bridge. The plan requires exposing
  that atomic host check instead of relying on a time-of-check/time-of-use window.

## Deferred findings

- Automatic phase confirmation remains out of v1.
- Multi-node and Paperclip Cloud support remain out of v1.
- Dynamic project update/archive remains out of v1.
- The exact minimum Paperclip version remains unknown until upstream contracts
  merge and ship. This blocks publication, not pure schema/state work.

## Implementation gate

The owner approved the reconciled architecture and milestone plan on 2026-08-23.
Implementation may proceed under `docs/supervision-protocol.md`. Live installs,
publication, and releases retain their separate owner gates.
