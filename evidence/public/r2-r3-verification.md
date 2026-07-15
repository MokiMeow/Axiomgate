# R2/R3 verification

Verified on 2026-07-15 (Asia/Calcutta) on Windows with Node.js v24.11.1, pnpm 10.33.0, and codex-cli 0.144.4. Raw verifier JSONL, failed compatibility attempts, mission state, and the disposable target repository remain under the ignored `.local/missiontest/` directory.

## Capability work log

| Semantic action | Mechanism | Why selected | Identity / permission | Data and state | User approval | Evidence |
|---|---|---|---|---|---|---|
| Independently review a mission diff | Fresh `codex exec --json --output-schema` session in a read-only, network-off sandbox | Gives the verifier no builder conversation context and enforces structured candidate findings | Fresh identity must match the mission snapshot; hook configuration must verify | Reads the current Git diff and contract criteria; writes local JSONL, role-tagged session, ledger usage, advisory findings, and command Evidence | No publish/deploy authority; findings are advisory | Verifier tests and live review below |
| Track Runway state | Local ledger, pure reserve/loop functions, and `.axiomgate/runway.json` | Uses observed tokens and explicit manual capacity only | Local workspace user | Reads mission usage/events; writes manual source-labelled capacity and advisory events | Never blocks, buys, activates, or invents capacity | Runway/runtime tests and CLI smoke below |
| Re-verify hook enforcement after version drift | Throwaway Git workspace plus a real Luna/low governed `git push` probe | Directly proves the installed Codex version still honors AxiomGate's JSON hook denial | Local Codex login and AxiomGate-authored hook; 90-second timeout | Temporary mission is deleted; only `{version, verifiedAt}` is stored in the user's `.axiomgate` directory after PASS | Explicitly requested live probe; no command is allowed to execute | Live enforcement proof below |

## Automated verification

Command:

```text
pnpm typecheck
```

Result:

```text
Scope: 2 of 3 workspace projects
packages/axiomgate-core typecheck: Done
apps/cli typecheck: Done
```

Command:

```text
pnpm test
```

Result:

```text
Test Files  10 passed (10)
Tests  117 passed | 1 skipped (118)
```

The single skipped test is the pre-existing opt-in G1 identity smoke test gated by `AXIOM_LIVE_SMOKE=1`.

Command:

```text
pnpm build
```

Result:

```text
Scope: 2 of 3 workspace projects
packages/axiomgate-core build: Done
apps/cli build: Done
```

`git diff --check` completed with exit code 0. The repository has no configured formatter or lint script, so no such command was available for this scope.

## R2 live independent-verifier proof

The existing disposable mission was migrated through `axiomgate mission update` to version 2. The migrated contract contains the Terra/high verify phase and `budgetPolicy.reservePercent: 20`; its new contract hash is:

```text
sha256:1947b9c617e6d734b2ac833d8131c269a2ee66835e18f98c9905b9fd6417435e
```

`hello.txt` was staged only inside the ignored fixture repository so `git diff HEAD` supplied a real current diff. The proof deliberately overrode the contract verifier tier to `gpt-5.6-luna` with low effort, as permitted by the task. Final CLI output:

```text
Verifier: FRESH (gpt-5.6-luna/low; sandbox=read-only)
Session: 019f66b1-2c5d-7c20-a085-58755db4c38b (verifier)
Findings: 4 (VALID; advisory)
```

The persisted candidate record is advisory and contains:

```json
[
  {"criterionId":"criterion_implement","verdict":"looks_correct"},
  {"criterionId":"criterion_regression","verdict":"cannot_assess","concern":"No executable project code or tests are present to verify regression safety.","riskySpots":["No test suite or existing behavior was available for validation."]},
  {"criterionId":"criterion_security","verdict":"looks_correct"},
  {"criterionId":"criterion_secrets","verdict":"looks_correct"}
]
```

All four contract criterion verdicts remained `UNVERIFIED`; model findings did not become admissible criterion evidence. The verifier output hash was:

```text
sha256:9accab97f21cff26f7ebce9deae4aa1eb07b5b16ffd849cbd610eea31099f903
```

The fresh session was added to `sessions.json` with `role: "verifier"`. Its raw usage object was ledgered with the same role:

```json
{"input_tokens":69780,"cached_input_tokens":50432,"output_tokens":674,"reasoning_output_tokens":197}
```

Two earlier fresh sessions returned provider schema errors. They were persisted locally as `INVALID` advisory attempts with zero findings. The first established that every object property must be required; the second established that codex-cli 0.144.4 requires the output schema root to be an object. Neither failed attempt is presented as a successful review.

## R3 Runway proof

Manual capacity was entered through the built CLI:

```text
axiomgate runway set --plan plus --resets-available 1 --reset-expires 2026-07-30 --project .local/missiontest
```

Output:

```text
Runway: plan=plus [manual/HIGH]; resetsAvailable=1 [manual/HIGH]; resetExpires=2026-07-30 [manual/HIGH]
```

Fixture and integration tests verify:

- verification reserve under/at/over boundary math, with verifier-run suppression;
- warnings are advisory and include observed builder/total token numbers;
- repeated identical command/error failure after three occurrences;
- three consecutive no-file-change/no-new-operational-evidence runs;
- healthy runs produce no loop recommendation;
- recommendations append to `events.jsonl` and appear in the run result;
- absent capacity renders every field as `UNKNOWN`;
- the expiry reminder appears at 71 hours and not at 73 hours;
- usage-limit JSONL and stderr create `reason: "rate_limit"` checkpoints;
- parseable reset timestamps are recorded, while missing timestamps remain `null`/`UNKNOWN`;
- the CLI prints reset data, a manual banked-reset hint when present, and the exact mission resume command.

## Live enforcement-version proof

Offline mode first produced:

```text
PASS OFFLINE: codex-cli 0.144.4 (config generation only; live enforcement not verified)
```

It did not write a live-verification record. The real probe then ran a fresh Luna/low Codex session in a throwaway Git workspace with a DENY-all-state-changing contract. PASS requires a successful Codex process, a persisted `pull_request.create` hook `DENY`, and zero `command_execution` items. CLI output:

```text
PASS LIVE: codex-cli 0.144.4
Session: 019f66b1-ebb0-7982-ba67-808860984094
Verified at: 2026-07-15T16:52:55.173Z
```

The stored drift record is exactly:

```json
{"version":"codex-cli 0.144.4","verifiedAt":"2026-07-15T16:52:55.173Z"}
```

`axiomgate doctor` then reported the matching installed version without a drift warning. Unit tests verify the exact required warning when versions differ.

## Compatibility deviations and limitations

- codex-cli 0.144.4 rejects an array-root output schema and requires every object property to be required. The transport schema therefore uses `{ "findings": [...] }` with nullable optional fields; AxiomGate normalizes and persists the requested findings array. This deviation is based on two preserved real provider errors and is regression-tested.
- The live verifier proof used Luna/low rather than the contract's default Terra/high to control proof cost. The persisted model and effort are truthful; normal `mission review` defaults to Terra/high.
- `budgetPolicy` remains optional at schema-read time so pre-R3 hashed snapshots can still validate and migrate. Every newly compiled contract includes `{reservePercent:20}`, and `mission update` injects it into legacy contracts before re-hashing.
- With no trustworthy provider token ceiling, reserve math uses the observed mission-token share. A mission with only builder usage is therefore at 100% observed builder share; no provider capacity number is invented. Once verifier usage exists, the advisory is satisfied.
- Loop `newEvidence` counts completed file changes and successful command executions, excluding the wrapper's automatic run Evidence record so a no-op run can still be detected.
- Rate-limit recovery is fixture/integration tested. A real quota exhaustion was not induced because that would waste capacity and is not necessary to validate parsing or checkpoint behavior.
