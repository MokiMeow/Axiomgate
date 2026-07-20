# CLI, MCP, plugin, and X4 verification

Captured on 2026-07-19 on Windows with Node 24.11.1 and `codex-cli 0.144.6`. Local absolute paths below are shortened to `<repo>` and `<profile>`; no credentials or tokens are present.

## Part A — polished CLI

The capture was made through a non-TTY pipe, so ANSI was correctly disabled while layout and status glyph fallbacks remained readable.

```text
> node apps/cli/dist/index.js doctor
AXIOMGATE / doctor · environment & trust
------------------------------------------------------
Node             [OK] v24.11.1
Model Director   Model Director efforts: Light, Medium, High, Xhigh, Max (Light uses CLI wire value low). Ultra: native Codex multi-agent mode; not orchestrated by AxiomGate during Build Week.
Codex CLI        [OK] codex-cli 0.144.6
Git repository   [!] main; changes present
Codex capacity   [OK] plan=pro; weekly used=8%; resets=2026-07-25T03:25:05.000Z [codex-app-server/high]
AxiomGate skill  [X] ABSENT (<profile>/.codex/skills/axiomgate/SKILL.md)
Verifier agent   [OK] PRESENT (<profile>/.codex/agents/axiomgate-verifier.toml)

> node apps/cli/dist/index.js runway status
AXIOMGATE / runway status · live capacity
------------------------------------------------------
CAPACITY ---------------------------------------------
Runway capacity (real Codex app-server data)
Limit | Window | Used | Resets at | Plan | Source/confidence
codex | weekly | 8% | 2026-07-25T03:25:05.000Z | pro | codex-app-server/high
codex_bengalfox | weekly | 0% | 2026-07-25T19:26:40.000Z | pro | codex-app-server/high
Banked resets | 0 | codex-app-server/high
```

The standalone skill path is absent because this proof used the plugin installation path described below. The enabled plugin contains the skill. The verifier agent is also copied to Codex's global agent location for compatibility.

Receipt hero states preserved the command exit contract:

```text
> axiomgate receipt verify <valid-receipt.md>
+----------------------------------------+
| [OK] PASS · RECEIPT INTEGRITY          |
| contract hash                          |
| 25 chained evidence records            |
| criterion evidence citations           |
| criterion verdicts and completion gate |
+----------------------------------------+
GOOD_EXIT=0

> axiomgate receipt verify <tampered-receipt.md>
+---------------------------------------------------------------------+
| [X] FAIL · RECEIPT INTEGRITY                                        |
| Evidence chain hash mismatch at record 1 (evd_aa6a4dd43b0245d89d50) |
+---------------------------------------------------------------------+
TAMPERED_EXIT=1
```

## Part B — zero-dependency stdio MCP

Direct stdio proof used the built CLI and the shared timeout runner. Initialization negotiated MCP `2025-06-18`; `tools/list` returned all six tools. Read-only tools advertised `readOnlyHint: true`; the approval mutation did not.

```text
STATUS SUCCESS EXIT 0
initialize: serverInfo={name:"axiomgate",version:"0.0.0"}
tools/list:
  axiomgate_mission_list
  axiomgate_mission_status
  axiomgate_receipt_verify
  axiomgate_runway_status
  axiomgate_approvals_list
  axiomgate_approve
axiomgate_mission_status:
  mission=msn_1af4f266df33453f8f7d
  criteria=PASS,PASS,PASS,PASS
  gate.outcome=COMPLETE
axiomgate_receipt_verify:
  valid=true
  checks=[contract hash, 25 chained evidence records,
          criterion evidence citations,
          criterion verdicts and completion gate]
```

Malformed-request and approve/deny auditing, including MCP approval surface persistence, are covered by the integration suite.

The server was registered using the empirically supported command:

```text
codex mcp add axiomgate -- node <repo>/apps/cli/dist/index.js mcp
codex mcp get axiomgate
  enabled: true
  transport: stdio
```

A real read-only Luna `codex exec` then called both registered tools (fresh thread `019f7ac6-7759-78d1-aeeb-cdb554f6ff77`) and completed with:

```text
Gate outcome: COMPLETE
Receipt valid: true
```

An initial live attempt without MCP annotations was cancelled by Codex as approval-requiring even under `--ask-for-approval never`. After adding truthful `readOnlyHint: true` annotations to read paths, the same calls completed. This observed compatibility requirement is recorded in `docs/engineering/17-COMPATIBILITY-ADAPTERS.md`.

## Part C — Codex plugin packaging

Observed `codex plugin` contract on 0.144.6:

- `codex plugin` exposes `add`, `list`, `marketplace`, and `remove`.
- `plugin add` accepts `PLUGIN@MARKETPLACE`, not a local directory.
- a local marketplace is added with `codex plugin marketplace add <source>`;
- the marketplace manifest must be `.agents/plugins/marketplace.json`;
- no marketplace publication command is exposed, so no publication claim is made.

The local package and skill validators both passed. Live installation selected the plugin strategy; the idempotency run reported:

```text
AXIOMGATE / install-codex · plugin
Mode      INSTALL
Strategy  PLUGIN
ARTIFACTS --------------------------------------------
[OK] UNCHANGED  <repo>/plugin/.agents/plugins/marketplace.json -> codex plugin marketplace add <repo>/plugin
[OK] UNCHANGED  <repo>/plugin/plugins/axiomgate/.codex-plugin/plugin.json -> codex plugin add axiomgate@axiomgate-build-week
[OK] UNCHANGED  <repo>/apps/cli/dist/index.js -> codex MCP server axiomgate
[OK] UNCHANGED  <repo>/.agents/agents/axiomgate-verifier.toml -> <profile>/.codex/agents/axiomgate-verifier.toml
```

`codex plugin list --json` contained the following real installed entry (unrelated plugins omitted):

```json
{
  "pluginId": "axiomgate@axiomgate-build-week",
  "name": "axiomgate",
  "marketplaceName": "axiomgate-build-week",
  "version": "0.1.0",
  "installed": true,
  "enabled": true,
  "source": { "source": "local", "path": "<repo>/plugin/plugins/axiomgate" }
}
```

## Part D — X4 mechanism equivalence

The fixture drives equivalent pull-request creation through shell and MCP inputs. Both classify to `pull_request.create`, both receive `DENY` with identical reasons, and each persists its own hook decision event. Unknown explicitly matched MCP tools classify as state-changing `UNKNOWN` and deny by default. Generated configs sort and enumerate exact MCP matcher names in both hook events; wildcards are rejected.

```text
> pnpm exec vitest run packages/axiomgate-core/test/mechanism-equivalence.test.ts
✓ packages/axiomgate-core/test/mechanism-equivalence.test.ts (2 tests)
Test Files  1 passed (1)
Tests       2 passed (2)
```

## Full repository gates

```text
> pnpm typecheck
Scope: 3 of 4 workspace projects
apps/web typecheck: Done
packages/axiomgate-core typecheck: Done
apps/cli typecheck: Done

> pnpm test
Test Files  23 passed (23)
Tests       231 passed | 1 skipped (232)
Duration    1.92s

> pnpm build
Scope: 3 of 4 workspace projects
packages/axiomgate-core build: Done
apps/cli build: Done
```

The single skipped test is the pre-existing opt-in live identity smoke test; it requires `AXIOM_LIVE_SMOKE=1`. No test failure was hidden.
