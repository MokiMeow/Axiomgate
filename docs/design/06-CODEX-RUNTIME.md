# Codex Runtime

## Goal

Use Codex deeply and visibly for real repository work while adding governance around execution.

## Integration surface (normative)

- **Session control:** `codex exec --json` with prompt via stdin, structured events, and a hard timeout. The App Server JSON-RPC integration is limited to the separately documented Runway quota source; no TypeScript SDK dependency is shipped.
- **Event and token capture:** `codex exec --json` reasoning/token usage feeds the Runway ledger; structured results use `--output-schema`.
- **Sandbox:** intent boundary maps to verified Codex sandbox flags (for example `--sandbox workspace-write`, with network disabled below `PUBLISH`).
- **Policy:** hooks configured per mission (see `docs/design/05-ENVIRONMENT-GUARD.md`).
- **Model plan:** phase-specific GPT-5.6 tier (Sol / Terra / Luna) and reasoning-effort selection, recorded with rationale in the mission state and Build Receipt.
- **Session identity:** persist Builder and Verifier session IDs with explicit roles in `sessions.json`; the primary thread remains available for user-owned `/feedback` submission.

The installed-version observations and limitations are recorded in [`docs/engineering/17-COMPATIBILITY-ADAPTERS.md`](../engineering/17-COMPATIBILITY-ADAPTERS.md).

## Roles

### Builder (core)

Implements the mission within the contract and intent boundary.

### Independent Verifier (core)

A fresh Codex session with no builder-context inheritance. Challenges the diff, tests assumptions, performs security review, and evaluates evidence. It must not inherit unsupported builder conclusions.

### Scout (stretch - board task X3 only)

Maps the repository, dependencies, architecture, test commands, and risks using a lower-cost tier (Luna). Do not build unless the stretch gate opens.

## Execution lifecycle

1. Load contract.
2. Resolve project identity.
3. Compare fresh identity with the mission snapshot.
4. Verify the snapshot and generated hook configuration hashes.
5. Select the contract phase's model/effort and boundary-derived sandbox.
6. Launch the bounded `codex exec --json` session with governance overrides.
7. Parse events, session ID, commands, errors, and raw token usage into local records.
8. Capture a checkpoint on rate limit, timeout, interruption, or truncated stream.
9. Run independent review and machine verification as separate explicit commands.
10. Resume from the stored session/checkpoint or request intervention.

## Canonical state

Extract mission state outside the chat. Do not assume a conversation transcript is durable memory.

## Worktree safety

Use native Codex worktree support where isolation is needed. Custom worktree/branch/port/process leasing is **deferred beyond Build Week** (ADR-008): the vertical mission runs one Builder at a time plus an independent Verifier session, which requires no coordination machinery.

## Recovery (Build Week core)

Support exactly:

- **provider rate limit** - checkpoint mission state, show reset/banked-reset options, `mission resume`;
- **session interruption / crash of the mission's own Codex session** - resume from canonical mission state, never from raw chat memory;
- **cancellation** - clean stop with recoverable state.

## Post-hackathon - do not implement during Build Week

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
