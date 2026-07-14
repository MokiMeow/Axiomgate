# Phase 3 — Codex Runtime

Aligned to board tasks **R1–R2** (ADR-008). Worktree/branch/port leases, provider handoffs, target-model validation, and compaction-recovery machinery are **post-hackathon** (see `MASTER_BUILD_CONTRACT.md`).

## Outcome

Codex executes a mission through governed phases with durable state, honest evidence, and stop/resume.

## Subtasks

- Codex session adapter via the official SDK / `codex exec --json` (prompt via stdin where applicable).
- Sandbox and permission-profile flags derived from the mission intent boundary; never widened mid-mission.
- Event and token capture feeding the Runway ledger.
- Preserve the primary session ID and per-phase model/effort record for `/feedback` and the receipt.
- Builder role contract; independent Verifier as a fresh session with no builder-context inheritance.
- Canonical mission state (append-only events, derived current state); stop and resume without relying on raw chat memory.
- Bounded retries; a killed or crashed session leaves recoverable state.

## Tests

- adapter contract tests against fixture event streams;
- sandbox-mapping tests per boundary level;
- stop/resume round-trip;
- verifier independence (no builder context leakage);
- bounded-retry negative test;
- cancellation cleanup.

## Exit criteria

A mission can stop and resume from canonical state, and the Verifier can independently inspect the Builder's work.
