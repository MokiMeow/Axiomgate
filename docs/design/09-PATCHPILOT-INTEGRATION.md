# PatchPilot Integration

## Objective

Integrate PatchPilot as the Verification Engine inside the AxiomGate mission lifecycle and web dashboard. Do not present PatchPilot as an unrelated second product, and do not misrepresent what it is.

## What PatchPilot actually is (verified 2026-07-14)

A pnpm monorepo at the local PatchPilot path, built and live-verified in May 2026:

- `apps/web` - Next.js 15 dashboard and API (hosted demo exists).
- `apps/worker` - scan/remediation worker (inline default; opt-in Redis/BullMQ).
- `apps/cli` - published npm CLI (`patchpilot-cli`).
- `apps/mcp` - stdio MCP server (22 tools).
- `packages/core` - ~40 modules including `osv`, `scanners`, `secrets`, `risk`, `reachability`, `validation`, `codex`, `gitOps`, `github`, `telegram`, `approval`, `audit` (hash chains), `attestation`, `redaction`, `promptInjection`, `mcpToolGuard`, `llmOutputGuard`, `workspace`, `pathSafety`, `queue`, `postgresStore`.
- Persistence: file-backed by default; opt-in Postgres write-through.

**There is no PatchPilot desktop app.** Any earlier reference to "PatchPilot desktop" in this repository is an error corrected by ADR-010.

## Reuse map

The table distinguishes prior PatchPilot capability from what AxiomGate actually consumes. Only the published CLI row crosses the runtime boundary.

| AxiomGate need | Prior PatchPilot capability | Shipped AxiomGate action |
|---|---|---|
| Dependency scanning | Published `patchpilot-cli scan` | Invoke pinned `patchpilot-cli@0.1.3`, parse output, and store command evidence. |
| Target tests/build | Internal validation runner existed | Detect and run the target repository's own commands directly through AxiomGate's timeout runner. |
| Codex remediation | Internal Codex/workspace modules existed | Use AxiomGate's governed mission runtime and hook configuration; rerun only affected checks. |
| PR/deploy guard | GitHub helpers existed | Use AxiomGate identity, target-ownership, policy, and approval modules. |
| Approvals and Telegram | Internal adapters existed | Implement AxiomGate's canonical exact-hash, expiring, single-use store and Telegram relay independently. |
| Receipts and audit chain | Finding-level audit modules existed | Implement the AxiomGate mission receipt and offline verifier from stored AxiomGate evidence. |
| Redaction and prompt safety | Internal helpers existed | Implement and test AxiomGate-local redaction and fail-closed command policy; no PatchPilot source import. |
| Dashboard | PatchPilot had a Next.js product | Ship AxiomGate's zero-dependency loopback dashboard; do not embed or copy PatchPilot UI code. |

## What must remain separate

PatchPilot's CVE Watch Commander identity (inventory, watch mode, CVE enrichment UI) is a different product loop. AxiomGate consumes one published scan command; it does not absorb the watch product.

## Integration boundary

PatchPilot is a separate repo; judges clone only AxiomGate. Integration is via the **published `patchpilot-cli@0.1.3`** (npm, invoked through the timeout runner, output parsed into typed findings) plus the target repo's own test/build commands. There is no co-located `packages/core`, submodule, database access, or in-process PatchPilot API.

The AxiomGate verification layer owns these operations around that narrow scan boundary:

- create verification run (mission, diff, criteria, risk);
- list planned checks;
- execute a bounded run and emit typed events;
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

No PatchPilot state or schema is modified. AxiomGate pins the published CLI version and regression-tests parsing against captured real output. Upgrading PatchPilot requires a new interface probe, updated fixture, malformed-output check, and end-to-end scan before changing the pin.

## Performance

- bounded concurrency; cancellation; streaming output; large-log externalization; incremental reruns; timeout classification; resource cleanup.

## Acceptance

The integration is complete only when a real Codex change flows through PatchPilot, produces a validated finding or pass result, supports remediation, reruns, and attaches evidence in the AxiomGate mission timeline.

## Hackathon delta discipline

PatchPilot predates Build Week (git history: 2026-05-26 → 2026-05-31). `HACKATHON_DELTA.md` lists its pre-existing capabilities explicitly, and demo narration identifies the pinned published PatchPilot CLI as pre-existing work. Misattributing it as new AxiomGate source is a disqualification risk under the Official Rules.
