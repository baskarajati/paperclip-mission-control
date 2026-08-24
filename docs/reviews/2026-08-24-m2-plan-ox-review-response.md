# M2 Plan Ox Alpha Review Response

Date: 2026-08-24

Author: Codex contributor

Reviewer: Ox Alpha through OMP, maximum reasoning, read-only

Reviewed head: `0e96ead`

Verdict received: approve with required changes

## Disposition

| Finding | Disposition | Result |
| --- | --- | --- |
| B1 | Accepted | Disposable conformance installation now requires an explicit owner trigger. Agents may prepare and verify but do not execute installation, configuration, or company mutation. |
| B2 | Accepted with repository correction | The plan now states the exact closed metadata allowlist already enforced by M2A-3, including `description` and `type`, which the review's suggested list omitted. |
| B3 | Refuted, clarification adopted | Paperclip's `PaperclipPluginManifestV1` and `pluginManifestV1Schema` make `minimumHostVersion` and its legacy alias optional. The plan now defines unset as omitting both fields and requires package verification to reject either before M2B-3. No cast or placeholder version is needed. |
| T1 | Accepted | M2A-3 now owns a real-loader rejection test pinned to its audited Paperclip base and proves no installation record is created. |
| T2 | Accepted | M2 reinstall acceptance now checks unique jobs and managed declarations. Project-binding replay moves to M7, where dynamic projects exist. |
| T3 | Accepted | Fake-to-real pairings now live in the existing `docs/testing/traceability.md`, owned by M2B-1. |
| T4 | Accepted | Compatibility policy now distinguishes the general architecture audit from the later M2 host-enforcement audit. |

## Verification basis

- `packages/shared/src/types/plugin.ts` declares both minimum-version fields as
  optional.
- `packages/shared/src/validators/plugin.ts` applies semver validation only when
  either optional field is present.
- The implemented M2A package verifier already uses a closed package-key set;
  the plan's two overlapping bullets, not the implementation, were ambiguous.
- M2A currently has no real Paperclip loader test, confirming the T1 ownership
  gap rather than treating package-metadata inspection as equivalent evidence.

## Remaining gate

The corrected plan still requires independent Claude Opus 5 acceptance before
PR #16 can merge. M2A PRs #18 through #20 remain non-installable and unmerged.
