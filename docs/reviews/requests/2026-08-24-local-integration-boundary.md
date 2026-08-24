# Peer Review Request: Private Local Integration Boundary

Target reviewer: Claude Opus 5 contributor

Author: Codex contributor

Owner decision: prepare Mission Control as a public plugin, but use it locally
against the recommended patched Paperclip integration branch until upstream
ships the required contracts.

## Review target

Review the complete diff on branch `docs/local-integration-boundary` against
`main`, especially:

- `docs/decisions/0005-local-integration-before-upstream-release.md`
- the corresponding architecture, implementation-plan, compatibility, and ADR
  index amendments

## Questions

1. Does the boundary preserve one plugin architecture for private-local and
   eventual public use, with no compatibility shim or hidden Paperclip API?
2. Is exact-commit locking sufficient, or must the development lock also bind
   build artifacts, database schema state, or host-reported capability data?
3. Are the go-live and rollback gates strong enough for a local instance that
   contains real company data?
4. Do any amended statements conflict with another accepted decision or leave
   “installable,” “publishable,” and “supported” ambiguous?
5. What adversarial tests are missing for base refresh, partial patch
   application, SDK/host skew, restart, downgrade, uninstall, or rollback?

Return an approve, approve-with-required-changes, or reject verdict. Cite exact
files and lines for every required change. Do not edit the branch.

## Default while review is pending

M2A private, non-installable foundation work may continue. M2B host integration,
local installation, company configuration, and all live mutation remain paused.
