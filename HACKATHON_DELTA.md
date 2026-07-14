# Hackathon Delta

This file separates pre-existing work from OpenAI Build Week work, as required by the Official Rules.

## Baseline

- **AxiomGate baseline commit:** `58c1a0a` — documentation blueprint only; zero implementation code existed at baseline (2026-07-14).
- **PatchPilot (pre-existing project):** built 2026-05-26 → 2026-05-31 (its own git history), before Build Week. It is a pnpm monorepo: Next.js 15 web dashboard, worker, published npm CLI, MCP server, and `packages/core` (~40 modules: OSV/Gitleaks/Trivy/Syft/Semgrep scanners, Codex remediation in sandboxed workspaces, validation runner, hash-chained audit receipts, HMAC Telegram approvals, redaction, prompt-injection guard).

## Pre-existing capabilities (NOT Build Week work)

- All PatchPilot capabilities listed above.

## Build Week work (everything after `58c1a0a`)

To be updated as commits land:

- Mission Contract system (schema, versioning, hash, editor)
- Environment Guard (identity resolution, deploy-target ownership proof, policy engine, Codex hook enforcement, approval binding)
- Codex Runtime (SDK/`exec --json` adapter, Builder/Verifier roles, mission state, resume)
- Runway lite (token-actuals ledger, reserve, loop detection, capacity snapshot, post-limit resume)
- Mission-level verification API over PatchPilot core
- Evidence Gate (verdict engine, completion gate, Build Receipt, `receipt verify`)
- Mission timeline dashboard + CLI
- Replay Lab (3 scenarios)

## Codex sessions

- Primary build thread session ID: recorded in `CODEX_COLLABORATION.md` (private until submission).
- Build Week commit range: `58c1a0a..HEAD`.
