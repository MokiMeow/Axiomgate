# Phase 5 - Evidence Gate and Approvals

> Historical phase plan. Use [TASKS.md](TASKS.md) and the [implementation status](../engineering/21-IMPLEMENTATION-STATUS.md) for current completion claims.

Aligned to board tasks **E1-E2** and **G4** (ADR-008, ADR-014). AxiomGate owns its mission-level approval store, Telegram adapter, redaction, verdict engine, and receipt chain. PatchPilot source is not imported.

## Outcome

Completion and external actions are evidence-bound and human-understandable.

## Subtasks

- Implement proof links.
- Compute criterion verdicts.
- Build Human Review Map.
- Implement typed semantic approvals.
- Add web dashboard and CLI flows.
- Add Telegram as a secondary surface.
- Reconcile effective permissions.
- Redact and hash evidence.
- Generate receipts.
- Block completion when evidence is missing.
- Support explicit waivers.

## Tests

- missing evidence;
- stale evidence;
- tampered evidence;
- waiver;
- approval expiry;
- target change;
- Telegram replay protection;
- receipt determinism;
- redaction.

## Exit criteria

A mission cannot be marked complete or perform a consequential action without the appropriate evidence and authorization.
