# Phase 1 — Mission Contract and Runway Lite

Aligned to board tasks **F6** and **R3** (ADR-008). Deferred items live in `docs/design/MASTER_BUILD_CONTRACT.md` "Post-hackathon scope".

## Outcome

A user can turn a one-line objective into a versioned, hashed mission contract with an explainable GPT-5.6 model plan, and Runway records honest capacity data.

## Subtasks

- Mission schema, validation, versioning, and hash (from `docs/02` canonical schemas).
- Contract creation with safe defaults: 3–6 acceptance criteria with evidence types, intent boundary, action policy template.
- Detect one direct policy conflict (objective vs. profile policy) and surface it; full instruction discovery is deferred.
- Intent boundary → sandbox/permission-profile mapping.
- Model Director: phase → GPT-5.6 tier (Sol/Terra/Luna) + reasoning effort with recorded rationale.
- Token-actuals ledger from `codex exec --json`.
- Verification reserve policy.
- Loop-signature detector (same failure/command repetition → pause recommendation).
- One source/confidence-labelled capacity snapshot + expiring-reset reminder (manual + observed input; no scraping dependency).
- Post-limit checkpoint and `mission resume`.

## Tests

- schema/hash/versioning unit tests;
- boundary→sandbox mapping tests;
- ledger correctness against fixture `exec --json` streams;
- loop-detector signal tests;
- no automatic spending/reset/switch (negative test);
- resume-after-limit fixture test.

## Exit criteria

The contract and plan are editable, explainable, persisted, and testable without live provider data; every displayed capacity number carries source + confidence.
