# ADR 0005: Allow Private Local Integration Before Upstream Release

Status: proposed by owner on 2026-08-24; pending peer review

## Context

Mission Control needs host contracts that are not yet present in a stable
Paperclip release. Waiting for that release would block local product work, but
putting a compatibility shim inside the plugin would create a second runtime
architecture that could drift from the public package.

## Decision

Keep the public release gate from ADR 0004. Before that gate opens, permit a
private local installation only against an exact, reviewed Paperclip integration
branch containing the same proposed host contracts and enforcement that the
public plugin will consume.

The local lane must satisfy all of these conditions:

- Paperclip changes remain ordinary, reviewable commits intended for upstream;
  the Mission Control plugin does not call internal HTTP routes, import server
  internals, write Paperclip tables, or carry a compatibility shim.
- A repository-owned development lock records the Paperclip remote, base commit,
  ordered patch commits, resulting integration commit, SDK identity, and required
  conformance commands.
- Installation preflight fails closed unless both repositories are clean and at
  the commits recorded by that lock.
- The plugin package remains private, uses development-only version metadata,
  and cannot be published by the release workflow.
- Local installation, configuration, and company mutation require an explicit
  owner go-live action, a current Paperclip backup, and recorded rollback steps.
- The integration branch is development evidence, not a supported host version
  or a substitute for real-host conformance tests.

## Consequences

- Local product development can continue without waiting for an upstream release.
- Local and public execution use one SDK and host contract rather than separate
  code paths.
- The integration branch must be refreshed and reverified when its Paperclip base
  or any constituent patch changes.
- Registry publication, a public compatibility claim, and a stable
  `minimumHostVersion` remain blocked until the required contracts ship together
  in a stable Paperclip release.
