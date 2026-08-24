# Milestone 3 Consult Prompt

Purpose: obtain an independent counter-design for Milestone 3 from the
adversarial counterpart seat, which the roster requires to be a different model
family from the lead.

Rules for the dispatcher:

- Paste the block below verbatim into a fresh Codex session.
- Do not attach `docs/plans/milestones/0003-pure-state-derivation.md`. The
  consult must be blind. A counter-design that has seen the lead's plan is a
  review, and a review cannot surface an entity the lead never conceived.
- Return the full answer. It is recorded in section 6 of the plan, divergence by
  divergence, each marked adopted, refuted with a reason, or escalated.

---

You are the adversarial counterpart and consulting architect for the Paperclip
Mission Control project. Produce an INDEPENDENT design. Another architect is
designing the same milestone in parallel, and you are deliberately not shown
their work. Be concise but complete.

Repository, read-only: `/Users/realinorevandy/dev/paperclip-mission-control-wt-m3`

Read first:

- `AGENTS.md`
- `docs/plans/2026-08-22-mission-control-architecture.md`, especially "Product
  contract", "Mission data model", "State machine", "Reconciliation and
  concurrency", and "Failure invariants"
- `docs/plans/2026-08-22-mission-control-implementation.md`. Milestone 3 is the
  requirement. Milestones 4 to 7 tell you what consumes your output.
- `contracts/**`, `fixtures/**`, `tests/contracts/contracts.test.mjs`
- `docs/testing/traceability.md`

Task: design Milestone 3, "Documents and pure state derivation". Do not write
production code. Produce a design.

Answer these:

1. Module boundary and file layout. What files, what does each own, and what is
   the import direction? Justify against the existing `contracts/` layout.
2. The input type. Milestone 3 derives state "from a Paperclip snapshot".
   Define that snapshot precisely. What is in it, what is deliberately not in
   it, and why?
3. Exact function signatures for the derivation core.
4. How are mission state and phase state derived? Give the decision order.
   Phase states: planned, provisioning, active, validating,
   awaiting_confirmation, completed, waived, blocked, cancelled. Mission
   states: draft, active, awaiting_transition_confirmation, transitioning,
   blocked, completed, cancelled.
5. Fail-closed rules. The architecture requires unknown schemas, duplicate IDs,
   missing claims, stale evidence, open hard blockers, budget incidents, and
   ambiguous ownership to fail closed. Which stable error codes, and where is
   each detected? `contracts/validator.mjs` already defines a code vocabulary.
   Reuse it or justify extending it, and name every code you add.
6. Findings, waivers, and blockers. How does the deriver treat them?
7. Test strategy. What must the table-driven tests cover, and what genuinely
   needs a property test rather than an example?
8. Contract gaps. What does the current `contracts/v1` schema set fail to
   provide that a correct deriver needs? Be specific and cite the file. This is
   the highest-value part of your answer.
9. Scope discipline. What would you deliberately not build in Milestone 3, and
   why?

Hard constraints from the repository. Do not violate them:

- Zero runtime dependencies. Node 24.11 or newer. ESM `.mjs`, matching the style
  of `contracts/v1/canonical.mjs`.
- Pure functions only in the derivation core: no clock, no randomness, no
  network, no SDK, no filesystem.
- Phase order is ratified as document order. The architecture, line 20, says the
  charter names "ordered phases". Do not invent an ordering field.
- Paperclip owns business truth. The plugin owns orchestration mechanics only.
- Derived phase state must never be written into a Paperclip document whose
  revision binds a confirmation or a transition key. A defect of exactly that
  kind was just repaired. See
  `docs/reviews/2026-08-23-canonical-request-divergence.md`, Finding 5.

Final section, mandatory, and the most important one: "What a naive design would
drop." Build it by walking the WRITTEN steps of the architecture's state machine,
steps 1 to 12, and the written "Failure invariants" list. Map each written step
and each invariant to something in your design, or mark it dropped with a
reason. Do not derive this list from the shape of your own design. List every
step or invariant that has no home in your design.
