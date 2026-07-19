# Hackathon Delta

This record separates pre-existing work from OpenAI Build Week work.

## Baseline

- **AxiomGate baseline:** commit `58c1a0a` on 2026-07-14. It contained the documentation blueprint and no product implementation.
- **Build Week range:** `58c1a0a..HEAD`. The pre-submission product checkpoint is `f9e0449`; submission sanitation and hardening continue as small commits after that checkpoint.
- **Repository:** <https://github.com/mokimeow/axiomgate>.

## Pre-existing work

PatchPilot was built in a separate repository before Build Week (2026-05-26 through 2026-05-31). AxiomGate invokes the published `patchpilot-cli@0.1.3` dependency scanner unchanged through a process boundary. PatchPilot source was not copied, modified, vendored, or added as a submodule. Its pre-existing scanner/remediation/audit capabilities are not claimed as AxiomGate Build Week work.

## Built during Build Week

- a strict, versioned, canonically hashed Mission Contract and Model Director;
- Codex App Server quota-window parsing, live/manual Runway capacity, reserve warnings, token ledger, loop detection, and checkpoint/resume;
- GitHub/Vercel identity resolution and deploy-target existence/ownership proof;
- deterministic semantic-action policy, intent-boundary mapping, fail-closed Codex hooks, exact-hash single-use approvals, and negative security coverage;
- governed `codex exec --json` Builder runs and fresh read-only independent Verifier sessions;
- verification planning over acceptance criteria, native target test/build execution, PatchPilot CLI parsing, secret scanning, governed remediation, and stale-evidence invalidation;
- criterion verdicts, permission quads, explicit waivers, completion gating, hash-chained Build Receipts, and offline tamper verification;
- the `axiomgate` CLI, MCP stdio server, Codex skill, custom verifier agent, plugin marketplace artifact, local dashboard, landing page, synthetic demo fixture, and three-scenario Replay Lab;
- bundled npm distribution with a tarball-install verification harness.

The core implementation lives under `packages/axiomgate-core/src/`; public surfaces live under `apps/cli`, `apps/web`, `.agents`, `demo`, and `scripts`.

## Codex evidence

The real headline mission used seven governed GPT-5.6 sessions and 3,159,955 input-plus-output tokens. Model, effort, role, purpose, session identifier, and outcome are recorded in [CODEX_COLLABORATION.md](CODEX_COLLABORATION.md); the sanitized live proof is [evidence/public/headline-run-verification.md](evidence/public/headline-run-verification.md).

## Reproducible comparison

```powershell
git diff --stat 58c1a0a..HEAD
git log --oneline 58c1a0a..HEAD
```

These commands are the authoritative Build Week change range. Claims remain bounded by [docs/21-IMPLEMENTATION-STATUS.md](docs/21-IMPLEMENTATION-STATUS.md) and the linked evidence.
