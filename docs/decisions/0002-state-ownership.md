# ADR 0002: Split Business Truth from Operational State

Status: proposed

## Decision

Store mission intent, evidence, decisions, phases, and results in Paperclip goals,
projects, issues, documents, and interactions. Store only reconciliation indexes,
leases, receipts, retries, and transition operation identity in the plugin-owned
database namespace.

## Consequences

- Paperclip remains inspectable and useful without the plugin.
- Reinstall can rebuild operational indexes from Paperclip records.
- Every mutation must be reconciled and linked with stable origin identifiers.
- Plugin database uniqueness and host idempotency are both required.
