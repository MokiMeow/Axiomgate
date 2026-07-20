# Test Strategy

## Principle

Tests must prove the actual claim at the lowest reliable layer and include real boundary coverage for external behavior.

## Test pyramid

### Unit

Pure policy, parsing, scoring, state transitions, redaction, hashing, capacity-snapshot labelling, risk calculation.

### Contract

Schemas and adapters for Codex, PatchPilot, GitHub, Vercel, semantic actions, Telegram, and persistence.

### Integration (Build Week list - nothing else)

- mission persistence (create/load/version/hash);
- hook-to-policy integration (decision round-trip, deny-wins, fail-closed start);
- identity checks (gh/git/Vercel resolution, target-ownership proof);
- PatchPilot verification runs;
- Codex event fixtures (`exec --json` streams → ledger);
- approval binding (command hash, expiry, single-use);
- evidence storage and freshness invalidation;
- receipt generation and `receipt verify`;
- post-limit checkpoint and resume.

(Process supervision, Git worktrees, provider adapter fixtures: future matrix only.)

### End-to-end

Web-dashboard/CLI mission flow from contract to receipt using deterministic fixtures.

### Live smoke

Explicit, opt-in, isolated tests against sandbox GitHub/Vercel/provider resources. Never required for ordinary unit runs.

## Build Week scenario matrix (required - ADR-008)

- mission allow/deny/approval policy;
- command or target mutation after approval (bound approval voided);
- stale/expired approval;
- wrong GitHub identity;
- wrong Vercel target (incl. non-existent / not-owned target);
- authority escalation above the intent boundary;
- effective-permission mismatch recorded;
- denied production action;
- loop detection signal;
- verification finding/remediation/rerun;
- stale-evidence invalidation on new commit;
- missing evidence blocks completion;
- waiver is visible in receipt;
- receipt hash-chain tamper detection;
- secret-bearing output redacted;
- post-limit checkpoint and resume;
- banked-reset reminder (no auto-activation).

## Stretch scenarios (only if board tasks X4/X5 unlock)

- multi-mechanism semantic-action equivalence (same verdict via CLI and MCP mechanism);
- malicious or over-broad capability description blocked by the existing injection guard.

## Future scenario matrix (post-hackathon - do not build tests for these now)

Weekly/rolling quota normalization variants, purchased credits, API budgets, unknown quota, quota-policy change detection (post-limit resume itself is Build Week), model transitions, failed compaction/recovery, provider-adapter fixtures, worktree collisions, maintainability regression.

## Local versus committed data

Use `.local/` for:

- raw results;
- private accounts;
- browser state;
- recordings;
- large logs;
- temporary repos;
- secrets.

Use `tests/fixtures/public/` for sanitized deterministic test data.

Use `demo/fixtures/` for judge replay scenarios.

Use `evidence/public/` only for reviewed public proof.

## Test truth

- Do not mark flaky tests passed without investigation.
- Do not disable tests silently.
- Record platform-specific skips with reason.
- Tests must clean up processes and files.
- Live tests need explicit labels and safeguards.
- Every bug fix requires a regression test when technically possible.
