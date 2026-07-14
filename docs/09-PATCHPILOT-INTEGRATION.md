# PatchPilot Integration

## Objective

Integrate PatchPilot as the Verification Engine inside the AxiomGate mission lifecycle and web dashboard. Do not present PatchPilot as an unrelated second product, and do not misrepresent what it is.

## What PatchPilot actually is (verified 2026-07-14)

A pnpm monorepo at the local PatchPilot path, built and live-verified in May 2026:

- `apps/web` — Next.js 15 dashboard and API (hosted demo exists).
- `apps/worker` — scan/remediation worker (inline default; opt-in Redis/BullMQ).
- `apps/cli` — published npm CLI (`patchpilot-cli`).
- `apps/mcp` — stdio MCP server (22 tools).
- `packages/core` — ~40 modules including `osv`, `scanners`, `secrets`, `risk`, `reachability`, `validation`, `codex`, `gitOps`, `github`, `telegram`, `approval`, `audit` (hash chains), `attestation`, `redaction`, `promptInjection`, `mcpToolGuard`, `llmOutputGuard`, `workspace`, `pathSafety`, `queue`, `postgresStore`.
- Persistence: file-backed by default; opt-in Postgres write-through.

**There is no PatchPilot desktop app.** Any earlier reference to "PatchPilot desktop" in this repository is an error corrected by ADR-010.

## Reuse map

| AxiomGate need | Existing PatchPilot module | Build Week action |
|---|---|---|
| Dependency/secret/SAST scanning | `osv`, `scanners`, `secrets`, `sbom` | Reuse; wire to mission plan |
| Run target repo's tests/build | `validation` | Reuse; extend to arbitrary configured commands |
| Codex remediation loop | `codex`, `workspace` (secret-scrubbed disposable workspaces, sandbox flags, stdin prompts) | Reuse; parameterize by mission authority |
| PR creation | `github`, `gitOps` (live-verified) | Reuse; gate behind Environment Guard |
| Approvals (Telegram, HMAC, two-step) | `telegram`, `approval` | **Extend** with mission-level semantic approvals and command-hash binding — do not rebuild |
| Receipts / audit chain | `audit`, `attestation` | **Extend** from finding-level to mission-level Build Receipt |
| Redaction | `redaction`, `env` | Reuse verbatim |
| Prompt-injection defense | `promptInjection`, `mcpToolGuard`, `llmOutputGuard` | Reuse; label as heuristic |
| Dashboard shell | `apps/web` | Extend with mission timeline views |

## What must remain separate

PatchPilot's CVE Watch Commander identity (inventory, watch mode, CVE enrichment UI) is a different product loop. AxiomGate consumes engine functions; it does not absorb the watch product.

## Integration boundary

Typed internal API over `packages/core` functions (in-process within one monorepo). No UI scraping, no shell parsing where a structured interface exists, no cross-module database access.

Operations:

- create verification run (mission, diff, criteria, risk);
- list planned checks;
- start/cancel run;
- stream typed events;
- get findings;
- validate finding;
- attach remediation;
- rerun affected checks;
- export evidence.

## Mission-flow requirements

1. Receive the mission, diff, risk, and required checks.
2. Construct a verification plan from acceptance criteria + changed files.
3. Execute checks; stream typed progress.
4. Create findings (candidate vs validated status).
5. Support validated remediation by Codex within mission authority.
6. Rerun affected checks; invalidate stale evidence.
7. Attach evidence to criteria; contribute to the Build Receipt.

## Dashboard requirements

- Verification stage within the mission timeline.
- Check status grouped by acceptance criterion.
- Candidate versus validated finding status.
- One-click view of command/output/evidence.
- Remediation timeline.
- No "green" overall status while required checks are missing, stale, failed, or unverified.
- Accessible loading, error, empty, and cancelled states.

## Migration

- Back up existing PatchPilot state before schema changes.
- Explicit schema migration with rollback.
- Preserve existing PatchPilot projects/runs where practical.
- Existing PatchPilot regression suite must pass after integration.

## Performance

- bounded concurrency; cancellation; streaming output; large-log externalization; incremental reruns; timeout classification; resource cleanup.

## Acceptance

The integration is complete only when a real Codex change flows through PatchPilot, produces a validated finding or pass result, supports remediation, reruns, and attaches evidence in the AxiomGate mission timeline.

## Hackathon delta discipline

PatchPilot predates Build Week (git history: 2026-05-26 → 2026-05-31). `HACKATHON_DELTA.md` must list its pre-existing capabilities explicitly, and the demo narration must say "our existing PatchPilot engine" out loud. Misattributing pre-existing work is a disqualification risk under the Official Rules.
