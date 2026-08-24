# M2 Plan Review Record

Date: 2026-08-24

Plan reviewed:
`docs/plans/milestones/0002-plugin-skeleton-and-compatibility.md`

Reviewer: GPT-5.6 Luna, max reasoning, read-only architecture review

Reviewed Paperclip base:
`a14e51d592dd22e2e830e01f94e6783d55df9963`

## Verdict

M2A is suitable as a non-installable, non-publishable foundation after the
changes recorded below. M2B is blocked on additional Paperclip host enforcement
and must not begin merely because M1A and M1B are present.

## Findings and disposition

1. **Accepted: persisted plugins bypass the fresh-install minimum-host gate.**
   `plugin-loader.ts` checks `minimumHostVersion` during installation, but
   `activatePlugin()` refreshes the installed manifest and proceeds toward
   worker startup without repeating that check. The plan now requires
   pre-spawn validation on boot, reload, retry, and auto-restart, with an empty
   host version failing closed.
2. **Accepted: configured does not mean enabled.** The loader currently maps
   every stored config row into `proactiveCompanyScopes`. The plan now requires
   host-side schema-valid `enabled: true` authorization. Worker filtering is
   explicitly defense in depth, not the access-control boundary.
3. **Accepted: company availability is not enforced.**
   `ensurePluginAvailableForCompany()` is currently a no-op even though managed
   project operations call it. The plan now blocks M2B until all company-scoped
   mutation services enforce enabled-and-valid availability.
4. **Accepted: SDK fakes differ materially from the host.** The fake managed
   project `get()` creates missing state, fake configuration is not a faithful
   multi-company model, and fake `runJob()` bypasses scheduling and startup.
   These differences are now named and require paired real-host tests.
5. **Accepted: private alone is not a sufficient installation boundary.** M2A
   remains private and also omits `paperclipPlugin` metadata and runtime
   entrypoints. Package verification checks both properties.
6. **Accepted: unknown manifest keys need a plugin-owned guard.** The host's
   root Zod object is not strict. Package verification must reject unknown
   top-level keys until the host contract does so.
7. **Accepted with scope clarification: dependency audit.** M2 CI blocks known
   high or critical production vulnerabilities; SBOM, provenance, and the full
   release audit remain M9 gates.
8. **Accepted: initial capabilities were too broad.** Initial M2B requests only
   `jobs.schedule` plus capabilities required by its four managed declarations.
   Later milestones add operational capabilities with the operation and test
   that require each one.

## Second-pass findings and disposition

1. **Accepted: M2B cannot probe undeclared future capabilities.** The plan no
   longer claims the M2 package directly rejects a host missing project-create
   or document CAS. Their conformance suites are prerequisite release evidence;
   the M2 manifest requests neither capability.
2. **Accepted with an evidence-based correction: M2A non-installability needs
   boundary tests.** Acceptance now requires rejection by a real Paperclip
   loader, packed-metadata and repository publish-policy checks, and stale-`dist`
   rejection. The proposed `npm publish --dry-run` negative test was rejected:
   npm 10.9.8 returned exit 0 for the current private package, so that command
   cannot prove the boundary.
3. **Accepted: development and stable M2B metadata differ.** M2B-1/M2B-2 stay
   private and make no public minimum-host claim. M2B-3 alone writes the stable
   minimum version and publishable metadata.
4. **Accepted: enabled company authorization is not operation intent.** The M2
   worker explicitly never calls managed reconcile/reset. The later operation
   that invokes them must define its own operator or reconciler intent.
5. **Accepted: compatibility edge cases and adversarial cases are mandatory.**
   Empty, malformed, and invalid-semver host versions fail closed. The entire
   review matrix, a version-compatible host missing a declared feature, and a
   fresh install with pre-existing enabled config are required M2B tests.

## Required adversarial host tests

- persisted incompatible plugin on boot, reload, retry, and auto-restart;
- missing or empty host version;
- package manifest changed after installation;
- disabled, malformed, and unconfigured company proactive calls;
- disabled, malformed, and unconfigured company managed-resource mutations;
- config disabled after sweep selection but before mutation;
- crash and restart during config delivery;
- fake/host managed-project `get()` behavior divergence;
- scheduler startup, overlap, and retry behavior;
- manifest with an unknown top-level key;
- tarball containing a forbidden path or development secret fixture.

## Result

The revised plan separates the immediately implementable M2A repository
foundation from M2B's security and compatibility boundary. No installable
plugin or company mutation is authorized by this review.

Final second-pass verdict: **approved**. No remaining blockers were found after
the dispositions above.
