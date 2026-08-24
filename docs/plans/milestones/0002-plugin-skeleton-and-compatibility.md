# Milestone 2 Plan: Plugin Skeleton and Compatibility Gate

Status: draft for independent review

Author: Codex contributor

Date: 2026-08-24

Audit bases:

- Mission Control `main` at `962ce4140bb92626c0fecb8909de3d5ca6e73541`
- Paperclip `master` at `a14e51d592dd22e2e830e01f94e6783d55df9963`
- latest stable npm `@paperclipai/plugin-sdk` observed as `2026.817.0`

This plan refines Milestone 2 in
`docs/plans/2026-08-22-mission-control-implementation.md`. It does not authorize
publication, live installation, or company mutation.

## Outcome

Create the smallest public package foundation that can become an installable
Paperclip plugin without claiming support for host contracts that do not exist
yet. Installation must be inert by default. Unsupported hosts must fail before
company mutation. A scheduled worker may run, but it may reconcile only
companies whose operator has explicitly saved `enabled: true` configuration.

Milestone 2 is split because current Paperclip does not recognize the required
`projects.create` capability:

- **M2A, available now:** repository/package structure, reproducible build and
  quality gates, pure compatibility/configuration policy, mutation-free worker
  core, and package-content verification. The plugin package remains private
  and deliberately has no `paperclipPlugin` install metadata.
- **M2B, host-gated:** final SDK dependency, manifest, worker entrypoint,
  managed resources, scheduled job, startup compatibility enforcement,
  real-host installation tests, and removal of `private`. M2B begins only after
  M1A, M1B, and the host enforcement prerequisites below exist together on one
  reviewed Paperclip integration branch. It becomes release-compatible only
  after all of them ship in one stable host release.

M2A is a preparatory slice, not completion of Milestone 2.

## Alternatives considered

### Full installable plugin now

Rejected. Paperclip `master` and stable SDK `2026.817.0` do not contain
`projects.create`. Adding it through TypeScript augmentation, a copied enum, an
internal HTTP call, or a permissive manifest cast would be a compatibility shim
that bypasses the host capability contract.

### Wait for upstream before creating anything

Rejected. Build reproducibility, package boundaries, opt-in policy, disabled
defaults, and release guards do not depend on project mutation. Waiting would
couple ordinary repository work to an unrelated maintainer schedule.

### Split foundation and integration

Accepted. It creates useful, verifiable artifacts now while keeping the public
install boundary mechanically closed until the real SDK and host support it.

## Repository structure

M2A converts the root into a private pnpm workspace without moving the accepted
M0 contracts or M3 modules:

```text
package.json                         private workspace orchestrator
pnpm-workspace.yaml
tsconfig.base.json
packages/
  plugin/
    package.json                     private until M2B acceptance
    tsconfig.json
    src/
      company-config.ts              strict enabled/default parsing
      sweep-policy.ts                pure selection of enabled company scopes
    tests/
      company-config.test.ts
      sweep-policy.test.ts
scripts/
  verify-package.mjs                deterministic allowlist/content checks
```

M2B adds only after the integration gate:

```text
packages/plugin/
  src/manifest.ts
  src/worker.ts
  src/managed-resources.ts
  src/templates.ts
  tests/manifest.test.ts
  tests/worker.test.ts
  tests/real-host/compatibility.test.ts
  skills/mission-continuity/SKILL.md
  agents/mission-steward/AGENTS.md
  dist/                              build output, never source authority
```

No UI bundle is added in M2. M8 owns operator UI. No database migration is added
in M2; M4 owns operational persistence. The root remains the authority for
versioned mission contracts rather than duplicating them into a package.

## Compatibility contract

The minimum host version remains unset in M2A and in the private M2B-1/M2B-2
development artifacts. The exact value is written once in M2B-3, from the first
stable Paperclip release containing all upstream contracts and host enforcement
prerequisites. A canary tag or git SHA is not a minimum supported version, and
M2B-1/M2B-2 make no public compatibility claim.

Current Paperclip does not expose `hostVersion`, plugin API version, or a host
capability inventory through the public `PluginContext`. The values exist in the
internal initialize protocol but are unavailable to plugin code. M2 must not
cast into worker internals or invent a runtime probe API.

Compatibility is enforced at the supported boundary:

1. Before every worker startup, including boot, reload, retry, and auto-restart,
   the Paperclip loader validates the refreshed manifest schema, plugin API
   version, capability names, feature/capability consistency, and
   `minimumHostVersion` against a non-empty, valid-semver running host version.
   Failure marks the plugin incompatible/error and does not call worker
   `setup()`.
2. The final worker compiles without casts against the exact supported SDK. An
   older host cannot accept the new `projects.create` manifest capability, and
   a host older than the joint release fails the minimum-version gate.
3. Real-host conformance tests prove project idempotency and document CAS on the
   oldest supported stable release. Successful installation or method presence
   alone never proves those semantics.

Package verification fails if a publishable artifact lacks a concrete
`minimumHostVersion`, declares a capability outside the reviewed allowlist, or
does not depend on the matching stable SDK. It also rejects unknown top-level
manifest keys because the current host schema strips rather than rejects them.
If future Paperclip changes bypass the loader check or require a plugin-owned
runtime probe, M2 stops and requests a public SDK runtime-info contract rather
than using an internal API.

Current Paperclip `master` does not yet satisfy item 1: the minimum-host check
runs on fresh install, while persisted activation refreshes the manifest and
spawns the worker without repeating that check. M2B therefore depends on a
separate upstream pre-spawn compatibility gate; M1A and M1B alone are not
sufficient.

## Additional host enforcement prerequisites

M2B requires three reviewed host changes in addition to M1A and M1B:

1. **Pre-spawn compatibility revalidation.** Every activation path validates
   the refreshed installed manifest and a non-empty valid-semver host version
   before worker setup. A persisted plugin that becomes incompatible across a
   host downgrade, package replacement, or restart stays stopped with an
   operator-visible reason.
2. **Enabled company authorization.** Proactive scopes are derived only from
   company configs that pass the plugin schema and explicitly enable the
   plugin. Merely having a stored config row does not authorize that company.
   Disabled, malformed, and unconfigured companies are denied by the host.
3. **Mutation-service availability enforcement.** Every company-scoped host
   mutation, including managed-resource reconcile/reset, checks the same
   enabled-and-valid authorization before acting. The current
   `ensurePluginAvailableForCompany` no-op must become an enforcing boundary.

Worker-side filtering and generation checks remain defense in depth. They are
not the security boundary and cannot compensate for missing host enforcement.
Host-owned operational rows needed to record a disabled plugin's status are
allowed; Paperclip company business objects must remain mutation-free.

## Company opt-in and sweep policy

Use Paperclip's company-scoped plugin configuration as the M2 opt-in authority:

```ts
type MissionControlCompanyConfig = {
  enabled: boolean; // default false; only literal true enables
};
```

Unknown keys and non-boolean values fail validation. Missing config parses as
`{ enabled: false }`. Installation creates no company config row.

After the prerequisite host patch, Paperclip loads stored company configs before
worker startup, authorizes only schema-valid configs with `enabled: true`, and
replays them through `onConfigChanged`. The worker keeps an in-memory map keyed
by company ID:

- startup begins with an empty map;
- the plugin definition sets `multiCompanyConfig: true`; without that explicit
  declaration the SDK intentionally rejects distinct second-company config;
- `onConfigChanged(companyId, config)` rejects a missing/null company scope,
  strictly parses the payload, and replaces one entry;
- missing, invalid, or `enabled !== true` entries are excluded from sweeps;
- every accepted config change increments an in-memory generation for that
  company;
- the scheduled job snapshots `{ companyId, generation }` for enabled entries
  only, deduplicated and sorted by company ID;
- the reconcile boundary rechecks that the same company is still enabled at the
  same generation before each external mutation; M2 exposes this guard and M4
  must use it rather than retaining a stale boolean;
- restart rebuilds the map from host-delivered configuration;
- the map is a runtime cache, never business authority.

M2B's sweep handler records a diagnostic `not_implemented` outcome for every
enabled company and returns without mutation. M4 replaces that callback with
the reconciler. The M2 worker must not perform placeholder writes, create
control records, call managed reconcile/reset, or simulate success. The
scheduled job handler is always registered because the manifest declares the
job. On a supported development host, incomplete work is represented inside
the handler rather than as a missing-handler failure. On an incompatible host,
only the loader/health diagnostic is emitted and worker `setup()` never runs.

## Final manifest blueprint

M2B-1/M2B-2 privately exercise this blueprint against the reviewed integration
branch. M2B-3 alone adds the concrete minimum version and publishable metadata.
The final M2B-3 manifest declares:

- plugin ID `paperclip-mission-control`;
- API version 1;
- exact `minimumHostVersion` from the joint stable upstream release;
- worker entrypoint only;
- `mission-reconcile-sweep` job on `*/5 * * * *`;
- managed control project `mission-control`;
- managed paused agent `mission-steward`, monthly budget 0;
- managed skill `mission-continuity`;
- managed paused routine `mission-reconcile` with:
  - `skip_if_active` concurrency;
  - `skip_missed` catch-up;
  - `require_external_activity` gate at company scope;
  - disabled schedule trigger.

Installation may register manifest declarations and the instance job, but it
must not reconcile company-managed resources, create a mission, wake an agent,
or spend budget. The M2 worker never calls managed reconcile/reset. A later
milestone must define the explicit operator or reconciler operation that does;
the M2 host gate establishes company authorization, not operation intent.

The capability list is derived from operations, not copied from a broad example.
M2B must produce a checked table mapping every capability to at least one exact
SDK call or declaration. The initial M2B allowlist is only:

- `jobs.schedule` for the declared inert sweep job;
- `projects.managed`, `agents.managed`, `routines.managed`, and `skills.managed`
  because the corresponding managed resources are declared.

M2B makes no events or metrics call, so it does not request those capabilities.
The anticipated later-milestone groups are:

- worker/platform: `events.subscribe`, `metrics.write`;
- reads: `companies.read`, `projects.read`, `issues.read`,
  `issue.subtree.read`, `issue.relations.read`, `issue.comments.read`,
  `issue.interactions.read`, `issue.documents.read`, `agents.read`, `goals.read`,
  `approvals.read`, `costs.read`, `issues.orchestration.read`;
- writes used by later milestones: `projects.create`, `issues.create`,
  `issues.update`, `issue.relations.write`, `issues.wakeup`,
  `issue.comments.create`, `issue.interactions.create`,
  `issue.documents.write`, `activity.log.write`;
- managed resources: `projects.managed`, `agents.managed`, `routines.managed`,
  `skills.managed`;
- operational persistence added with M4:
  `database.namespace.migrate`, `database.namespace.read`,
  `database.namespace.write`.

Capabilities for resolving interactions, responding to approvals, resuming
agents, invoking agents, outbound HTTP, secrets, access administration,
authorization writes, webhooks, tools, and UI are excluded unless a later
approved milestone names an exact operation that requires them.

The final manifest is not added with knowingly unused future capabilities.
Instead, each later milestone that introduces an operation adds its capability
and regression test in the same change. The blueprint above is the anticipated
v1 ceiling, not the M2B initial allowlist.

## Build and release guards

M2A adds these root commands:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm verify:package
pnpm verify
```

Use Node 24.11 or newer and pnpm 9.15.4. Lock all direct dependencies. Runtime
dependencies require an explicit plan amendment; pure policy code has none.

`verify:package` creates a dry-run tarball in a temporary directory and checks:

- only allowlisted runtime/documentation paths are present;
- no tests, fixtures containing invalid payloads, source maps, local paths,
  worktrees, environment files, credentials, or development metadata ship;
- manifest/worker entrypoints exist only in M2B;
- package metadata, license, repository, engines, and files allowlist agree;
- the package remains private before the M2B release gate;
- a publishable package has a concrete minimum host version and final manifest;
- the tarball can be installed into a clean temporary project without lockfile
  mutation outside that directory.

M2A additionally runs three release-boundary tests:

- a real Paperclip loader rejects the tarball because no plugin metadata,
  manifest, or worker entrypoint is discoverable;
- the packed `package.json` retains literal `private: true`, omits
  `publishConfig` and `paperclipPlugin`, and the repository publish-policy check
  rejects it as non-publishable. `npm publish --dry-run` is not used as evidence:
  npm 10.9.8 exits successfully for a private package in dry-run mode;
- verification starts from a clean build and then injects stale `dist`
  manifest/worker artifacts, proving the allowlist rejects them.

CI runs Node 24 and 25 for install, build, typecheck, lint, unit tests,
`git diff --check`, package verification, and a production-dependency audit.
Known high or critical production vulnerabilities block M2 acceptance unless a
time-bounded exception is documented in the same review. SBOM, provenance, and
the full release audit remain M9 release gates.

## Harness boundary

The SDK fake proves registration, declared capability gates, config parsing,
job dispatch, and side-effect counts. It does not prove:

- document CAS conflict behavior;
- confirmation idempotency, freshness, expiry, or resolver policy;
- dynamic project idempotency, tombstones, or crash recovery;
- host installation/minimum-version rejection;
- proactive company authorization;
- activity/event delivery guarantees.

Known fake/host semantic differences are explicit test hazards:

- fake `projects.managed.get()` creates a missing project, while the host calls
  managed resolution with `createIfMissing: false`;
- the fake config store is not a faithful multi-company delivery model;
- fake `runJob()` directly invokes a handler and does not model scheduler,
  startup, retry, or overlapping-run behavior.

Each fake test that touches one of these surfaces is paired in the traceability
record with a required real-host test. Fake-only evidence can never move a
real-host invariant to `covered`.

## Acceptance

### M2A

- Workspace install is reproducible from the lockfile on Node 24 and 25.
- Existing M0/M3 contract tests remain green without moving contract files.
- Company config enables only literal `true`; malformed and missing config are
  disabled.
- Sweep selection is deterministic, deduplicated, and contains enabled
  configured companies only.
- The M2A package cannot be installed as a Paperclip plugin or published.
- Real-loader rejection, packed-metadata/publish-policy checks, and stale-`dist`
  rejection prove that non-installability and repository publication boundary.
- Build, typecheck, lint, tests, package checks, and `git diff --check` pass.

### M2B

- Final manifest validates without casts against the reviewed Paperclip SDK.
- Host below `minimumHostVersion` rejects installation before worker startup.
- A persisted incompatible plugin is rejected on boot, reload, retry, and
  auto-restart before worker `setup()`.
- Empty, malformed, and invalid-semver host versions fail closed before worker
  `setup()`.
- M2B-3 cannot set its minimum version or publishable metadata until M1A, M1B,
  and all host enforcement prerequisites have passed their real-host
  conformance suites in the same stable release. Project-create and document
  CAS are prerequisite evidence, not capabilities requested by the M2 manifest.
- Fresh install creates no mission, does not reconcile managed resources, does
  not wake agents, and spends no budget.
- The five-minute job performs zero company mutation with no enabled config.
- One enabled company is selected; configured-but-disabled and unconfigured
  companies are not selected.
- Direct proactive and managed-resource mutation calls for disabled, malformed,
  and unconfigured companies are denied by the host even if the worker is
  malicious or defective.
- Disabling or changing a company after selection invalidates its generation
  token before any later mutation boundary.
- Restart reconstructs enabled scopes from host config delivery.
- Managed steward and routine declarations remain paused, budget zero, with the
  routine trigger disabled.
- Package tarball contains only intended runtime assets.
- Real-host tests run against the reviewed integration branch; public support
  remains blocked until the same contracts appear in a stable release.
- The mandatory adversarial matrix includes every case in
  `docs/reviews/2026-08-24-m2-plan-review.md`, plus an otherwise version-compatible
  host missing a required declared feature and a fresh install where an enabled
  company config already exists.

## Implementation slices

1. **M2A-1: workspace and toolchain.** Add workspace files, plugin package shell,
   build/typecheck/lint/test scripts, and CI without changing runtime behavior.
2. **M2A-2: pure policy.** Add failing tests, then config and sweep-selection
   functions.
3. **M2A-3: package guard.** Add tarball allowlist and negative leak fixtures.
4. **M2B-0: host enforcement integration.** Land and review pre-spawn
   compatibility revalidation, enabled-only proactive scopes, and enforced
   company availability on all mutation services, with boot/reload/restart and
   malicious-worker denial tests.
5. **M2B-1: reviewed SDK integration.** Pin the reviewed joint Paperclip branch,
   add typed manifest/worker, and prove diagnostic-only unsupported behavior.
6. **M2B-2: inert installation.** Add managed declarations and scheduled job;
   verify zero mutations until explicit opt-in.
7. **M2B-3: stable release boundary.** Replace the development SDK pin with the
   first joint stable release, set `minimumHostVersion`, run clean-host tests,
   and make the package structurally publishable. Publication still requires
   owner approval and M9 release acceptance.

Each slice uses its own branch/worktree, failing test first for behavior, peer
review, and fresh verification. A slice may be merged independently only when
the tree remains honest about its incomplete status.

## Stop conditions

Stop and amend the architecture if:

- Paperclip maintainers reject or materially reshape either upstream contract;
- minimum-host enforcement is removed or does not run before activation;
- proactive company scope includes disabled, malformed, or merely configured
  companies;
- a company-scoped mutation service can bypass enabled-and-valid availability;
- M2 requires plugin SQL, UI, automatic managed-resource reconciliation, or a
  live mutation to prove compatibility;
- a package becomes installable or publishable before the joint stable host
  release is known;
- tests require a production compatibility shim, internal HTTP call, direct
  Paperclip table access, or copied host implementation.

## Proof of done

The final milestone record must include exact commits, file list, commands and
outputs, Node/SDK/host versions, package tarball listing, real-host installation
evidence, known limitations, and rollback instructions. M2 is complete only
after M2B. M2A completion must be reported as foundation work, never as a
working Paperclip plugin.
