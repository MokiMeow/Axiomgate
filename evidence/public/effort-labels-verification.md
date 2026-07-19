# Model Director effort-label verification

Date: 2026-07-16

Codex: `codex-cli 0.144.4`

Model: `gpt-5.6-luna`

Workspace boundary: `MODIFY_LOCAL` / `workspace-write`

## Execution mechanism

Each candidate was executed exactly once through AxiomGate's shared timeout runner with a 30-second hard timeout. The probe launched `codex exec --json --model gpt-5.6-luna -c model_reasoning_effort=<candidate> --sandbox workspace-write --skip-git-repo-check -` and supplied `reply OK` on stdin.

- Semantic action: runtime compatibility verification.
- Mechanism: local Codex CLI via the shared `runCommand` timeout runner.
- Identity/permissions: the current local Codex session; workspace-write sandbox; no publish/deploy authority.
- Data/state: trivial prompt and JSONL response only; no repository mutation requested or observed.
- Approval: not required inside the active `MODIFY_LOCAL` boundary.
- Evidence: exit status, duration, JSONL completion/error event, and the sanitized fixture at `packages/axiomgate-core/test/fixtures/codex-effort-wire-0.144.4.json`.

## Empirical wire results

| Candidate | Result | Exit | Duration | Observation |
|---|---|---:|---:|---|
| `light` | REJECTED | 1 | 7,230 ms | HTTP 400 `invalid_enum_value`; server listed `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` |
| `low` | ACCEPTED | 0 | 8,297 ms | `turn.completed`; agent response `OK` |
| `medium` | ACCEPTED | 0 | 7,399 ms | `turn.completed`; agent response `OK` |
| `high` | ACCEPTED | 0 | 7,060 ms | `turn.completed`; agent response `OK` |
| `xhigh` | ACCEPTED | 0 | 10,487 ms | `turn.completed`; agent response `OK` |
| `max` | ACCEPTED | 0 | 8,964 ms | `turn.completed`; agent response `OK` |

Resulting boundary rule: AxiomGate stores and displays `light | medium | high | xhigh | max`; at `codex exec`, `light` maps to the accepted historical wire value `low`. The remaining display values pass through unchanged. Ultra is not sent as an effort value: it is documented as native Codex multi-agent mode and is not orchestrated by AxiomGate during Build Week.

## Live display proof

`node apps/cli/dist/index.js runway status` (exit 0):

```text
Model Director efforts: Light, Medium, High, Xhigh, Max (Light uses CLI wire value low). Ultra: native Codex multi-agent mode; not orchestrated by AxiomGate during Build Week.
Runway capacity (real Codex app-server data)
Limit | Window | Used | Resets at | Plan | Source/confidence
codex | weekly | 1% | 2026-07-23T12:12:00.000Z | pro | codex-app-server/high
codex_bengalfox | weekly | 0% | 2026-07-23T14:24:38.000Z | pro | codex-app-server/high
Banked resets | 0 | codex-app-server/high
```

`node apps/cli/dist/index.js doctor` (exit 0):

Local installation paths in this captured output are redacted to `<CODEX_HOME>`.

```text
node: v24.11.1
Model Director efforts: Light, Medium, High, Xhigh, Max (Light uses CLI wire value low). Ultra: native Codex multi-agent mode; not orchestrated by AxiomGate during Build Week.
codex CLI: codex-cli 0.144.4
git repository: yes (main; changes present)
Codex capacity: plan=pro; weekly used=1%; resets=2026-07-23T12:12:00.000Z [codex-app-server/high]
AxiomGate skill: absent (<CODEX_HOME>/skills/axiomgate/SKILL.md)
AxiomGate verifier agent: absent (<CODEX_HOME>/agents/axiomgate-verifier.toml)
```

The capacity fields are official app-server observations. No credentials, tokens, or private prompt content are present in this evidence.

## Final gates

```text
pnpm typecheck
Scope: 3 of 4 workspace projects
apps/web typecheck: Done
packages/axiomgate-core typecheck: Done
apps/cli typecheck: Done

pnpm test
Test Files  20 passed (20)
Tests  220 passed | 1 skipped (221)

pnpm build
packages/axiomgate-core build: Done
apps/cli build: Done
```

The single skipped test is the pre-existing optional live identity smoke test, gated behind `AXIOM_LIVE_SMOKE=1`. `pnpm audit --prod` could not produce a vulnerability verdict because the npm audit endpoints returned HTTP 410; this environmental limitation is not represented as a passing security audit.
