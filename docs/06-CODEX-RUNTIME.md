# Codex Runtime

## Goal

Use Codex deeply and visibly for real repository work while adding governance around execution.

## Integration surface (normative)

- **Session control:** the official Codex TypeScript SDK / App Server JSON-RPC protocol. Fall back to `codex exec --json` (prompt via stdin) where the SDK is unnecessary.
- **Event and token capture:** `codex exec --json` reasoning/token usage feeds the Runway ledger; structured results use `--output-schema`.
- **Sandbox:** intent boundary → sandbox flags (for example `--sandbox workspace-write`, network disabled below PUBLISH), following the pattern already live-verified in PatchPilot's Codex integration.
- **Policy:** hooks configured per mission (see `docs/05-ENVIRONMENT-GUARD.md`).
- **Model plan:** phase-specific GPT-5.6 tier (Sol / Terra / Luna) and reasoning-effort selection, recorded with rationale in the mission state and Build Receipt.
- **Session identity:** preserve the primary session ID for `/feedback` from day one.

Phase 0 must verify all of the above empirically against the installed Codex version and record results in `docs/17-COMPATIBILITY-ADAPTERS.md`.

## Roles

### Builder (core)

Implements the mission within the contract and intent boundary.

### Independent Verifier (core)

A fresh Codex session with no builder-context inheritance. Challenges the diff, tests assumptions, performs security review, and evaluates evidence. It must not inherit unsupported builder conclusions.

### Scout (stretch — board task X3 only)

Maps the repository, dependencies, architecture, test commands, and risks using a lower-cost tier (Luna). Do not build unless the stretch gate opens.

## Execution lifecycle

1. Load contract.
2. Resolve project identity.
3. Confirm authority.
4. Load the approved capability-policy snapshot and permitted semantic actions.
5. Create model plan.
6. Create branch (use a native Codex worktree only if isolation is needed).
7. Execute bounded phase.
8. Capture checkpoint on rate-limit interruption or phase end.
9. Verify phase.
10. Continue or request intervention.

## Canonical state

Extract mission state outside the chat. Do not assume a conversation transcript is durable memory.

## Worktree safety

Use native Codex worktree support where isolation is needed. Custom worktree/branch/port/process leasing is **deferred beyond Build Week** (ADR-008): the vertical mission runs one Builder at a time plus an independent Verifier session, which requires no coordination machinery.

## Recovery (Build Week core)

Support exactly:

- **provider rate limit** — checkpoint mission state, show reset/banked-reset options, `mission resume`;
- **session interruption / crash of the mission's own Codex session** — resume from canonical mission state, never from raw chat memory;
- **cancellation** — clean stop with recoverable state.

## Post-hackathon — do not implement during Build Week

- General process supervision (PIDs, ports, logs, health tracking of arbitrary processes).
- Model-transition checkpoint/validation machinery and cross-provider handoff packs.
- Failed-compaction recovery (native Codex compaction covers the demo path).
- Partial-external-action reconciliation beyond recording the effective-permission mismatch as evidence.

## Codex evidence

Record:

- primary session ID;
- phase and model;
- commands;
- changed files;
- checkpoints;
- tool calls where available;
- user decisions;
- verification outcomes.

Do not expose private reasoning. Preserve operational evidence.
