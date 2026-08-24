# ADR 0005: Allow Private Local Integration Before Upstream Release

Status: accepted by owner and peer contributor on 2026-08-24

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
  ordered patch commits, resulting integration commit, SDK identity, expected
  migration-journal state, fresh-build commands and artifact identity, required
  capability inventory, and conformance commands.
- Installation preflight fails closed unless both repositories are clean and at
  the commits recorded by that lock, build outputs are freshly derived from those
  commits, the applied Paperclip migration journal matches the locked expectation,
  and the running host returns the required capability probe result. The go-live
  record captures the observed journal and probe output; the source lock does not
  substitute for either live check.
- ADR 0004's runtime rule remains in force: probe on every activation and refuse
  mutation whenever compatibility cannot be established. Exact source locking is
  an additional precondition, not a replacement for runtime enforcement.
- The plugin package remains private, uses development-only version metadata,
  and cannot be published by the release workflow.
- Local installation, configuration, and company mutation require an explicit
  owner-operated go-live action. Agents may prepare and verify the procedure but
  do not execute it.
- Before the first go-live, restore the current Paperclip backup into a disposable
  environment and verify it. Record rollback steps, run a mutation-free reconcile
  dry run, and use a disposable or non-critical test company for the first enabled
  mutation.
- Rollback disables or uninstalls Mission Control before reverting Paperclip code.
  Additive integration migrations may remain as inert schema. Re-enabling the
  plugin is prohibited until source, build, migration, and runtime checks all match
  a reviewed lock again; code-back/schema-forward mismatch must mutate nothing.
- The integration branch is development evidence, not a supported host version
  or a substitute for real-host conformance tests.

## Consequences

- Local product development can continue without waiting for an upstream release.
- Local and public execution use one SDK and host contract rather than separate
  code paths.
- The integration branch must be refreshed and reverified when its Paperclip base
  or any constituent patch, SDK build, expected migration state, or capability
  result changes.
- Registry publication, a public compatibility claim, and a stable
  `minimumHostVersion` remain blocked until the required contracts ship together
  in a stable Paperclip release.
