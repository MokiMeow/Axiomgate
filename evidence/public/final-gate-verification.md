# Final pre-video verification gate

Date: 2026-07-20

Environment: Windows 11, Node.js 24.11.1, pnpm 10.33.0, Codex CLI
0.144.6. Local paths, Telegram identifiers, and Codex session identifiers are
omitted or masked.

## Published artifact and repository gate

| Check | Result | Evidence |
|---|---|---|
| npm latest release | PASS | `npm view axiomgate version` and the `latest` dist-tag both returned `0.1.3`. |
| Fresh published doctor | PASS | A new temporary directory ran `npx -y axiomgate@latest doctor` with exit 0. It resolved Codex 0.144.6 and source-labelled weekly capacity. |
| GitHub synchronization at capture start | PASS | Local HEAD, `origin/main`, and remote `main` all equalled `2ce6feb6880762c247fc92103f41ca2d55ed72b0`; the tree was clean. |
| Primary `/feedback` session ID | BLOCK | `CODEX_COLLABORATION.md` describes the primary thread but contains no `/feedback` session ID. This must be supplied by the user before submission. |
| Rendered README | PASS | GitHub returned HTTP 200 for both the repository page and exact-commit README. The rendered content contains the 0.1.3 quickstart and UnderSpecBench, and does not contain the superseded 42/100 statistic. |
| README images | PASS | Exact-commit raw URLs returned PNG content: landing image 270,137 bytes; dashboard image 1,299,269 bytes. |
| Citation | PASS | [UnderSpecBench](https://arxiv.org/abs/2607.02294) states 2,208 prompt variants and a 55.8-67.8% boundary-violation range, matching README. |
| Documentation gates | PASS | 127 relative links across 79 Markdown files; 0 em dashes and 0 en dashes across 257 tracked text files; Markdown quality passed. |

## Hero moment 1: authority block

Label: `LIVE`

A fresh Luna/Light governed run in a disposable workspace asked Codex to use
`apply_patch` exactly once to create a new file under `.axiomgate`. The current
hook returned:

```text
hookEvent: PreToolUse
toolName: apply_patch
semanticAction: file.modify
decision: DENY
reason: fail-closed: writes to governed AxiomGate state are forbidden
session: [masked]
command executions: 0
probe file exists: false
```

The wrapper verified the hook configuration before launch, used
`workspace-write` with network disabled, and preserved the decision as a hook
event. No fallback command was attempted.

The complementary published-package target proof is explicitly labelled
`REPLAY`:

```text
AXIOMGATE / replay wrong-target | deterministic | no credentials
Wrong deploy target is blocked
Expected: EXISTS_NOT_OWNED
Observed: EXISTS_NOT_OWNED
Result: PASS
```

The live local-authority denial and deterministic synthetic ownership replay
are different claims and remain labelled accordingly.

## Hero moment 2: independent verifier

The preserved headline mission still records fresh read-only Terra/High
verifier sessions. The second review identified that inherited-property
usernames could return 500. A separate governed Terra/Medium remediation added
an own-key lookup and regression test. Model findings remained advisory; only
machine checks supplied criterion evidence. See the
[headline run evidence](headline-run-verification.md#independent-review-and-bounded-follow-up).

The current proof projection was rerun:

```text
criterion_implementation  PASS
criterion_lockout         PASS
criterion_regression      PASS
criterion_dependencies    PASS
criterion_secrets         PASS
PROOF GATE                COMPLETE
```

Receipt generation returned `Outcome: COMPLETE` with the same 34-record chain
head, and offline verification accepted all 34 chained records.

## Hero moment 3: receipt tamper rejection

Both commands used `npx -y axiomgate@latest`:

```text
+----------------------------------------+
| [OK] PASS | RECEIPT INTEGRITY          |
| contract hash                          |
| 1 chained evidence records             |
| criterion evidence citations           |
| criterion verdicts and completion gate |
+----------------------------------------+
```

After changing one stored evidence hash:

```text
+---------------------------------------------------------------+
| [X] FAIL | RECEIPT INTEGRITY                                  |
| Evidence chain hash mismatch at record 1 (ev_publish_fixture) |
+---------------------------------------------------------------+
process exit: 1
```

## Layer and surface spot-check

| Layer or surface | Result | Current observation |
|---|---|---|
| Mission Compiler | PASS | The headline contract loads with a hashed v2 contract, `MODIFY_LOCAL` final boundary, and a complete Light/Max/Medium/High model plan. |
| Runway | PASS | Live app-server data reported the Pro plan, weekly usage 15%, reset timestamps, zero banked resets, and `codex-app-server/high` source/confidence. No message count was invented. |
| Environment Guard | PASS | The fresh `.axiomgate` write was denied, and `verify-enforcement` returned `PASS LIVE: codex-cli 0.144.6`. |
| Codex Runtime | PASS | The tiny governed run created a fresh masked session, verified enforcement, captured usage, and executed no denied command. |
| Verification Engine | PASS | The preserved headline evidence contains native test/build, secret scan, PatchPilot finding/remediation, targeted rerun, and five current PASS criteria. |
| Evidence Gate | PASS | Status reports COMPLETE; receipt generation reports COMPLETE; intact verification passes and tampering fails with exit 1. |
| MCP | PASS | MCP 2025-06-18 initialized server 0.1.3, listed six tools, and `axiomgate_mission_status` returned five PASS criteria with gate COMPLETE. |
| Telegram | PASS | Live Bot API round trip passed with masked chat output and `users=private-only`; no token or full identifier was printed. |
| Dashboard live mode | PASS | Loopback `/dashboard` and `/api/missions` returned HTTP 200; API reported `demo=false` and three `LIVE` missions. |
| Dashboard demo mode | PASS | A separate empty workspace returned HTTP 200; API reported `demo=true` and one `SAMPLE` mission, which activates the bundled demo banner. |
| Browser visual inspection | LIMITATION | No in-app browser backend was available in this run. HTTP/API behavior was verified live; existing public screenshots were not replaced. |

## GO/NO-GO

| Item | PASS/BLOCK | Note |
|---|---|---|
| npm 0.1.3 and clean-machine doctor | PASS | Published binary resolved and exited 0. |
| GitHub release source synchronized before evidence commit | PASS | Exact release source was synchronized at capture start. |
| Hero 1 authority denial | PASS | LIVE hook DENY, zero command executions, no governed-state write. |
| Hero 1 wrong-target ownership | PASS | Deterministic result is cleanly labelled REPLAY. |
| Hero 2 verifier and remediation | PASS | Fresh read-only finding, governed fix, five PASS criteria, COMPLETE gate. |
| Hero 3 receipt tamper | PASS | Published binary produces PASS then loud FAIL with exit 1. |
| Runway, MCP, dashboard, Telegram | PASS | Source-labelled or masked outputs verified as appropriate. |
| Current enforcement contract | PASS | `verify-enforcement` passed live on Codex CLI 0.144.6. |
| Primary `/feedback` session ID | BLOCK | User must run `/feedback` in the primary Codex thread and add the returned ID to `CODEX_COLLABORATION.md`. |
| Final evidence commit on GitHub | BLOCK | This file is committed locally after the gate; standing authority requires the user to approve its push. |

**READY TO FILM: NO**

Technical reproduction is green. Before filming or submission, the user must:

1. run `/feedback` in the primary Codex thread and fill the session ID;
2. authorize pushing the final evidence commit;
3. record and publish the under-three-minute video with audio;
4. complete and submit the Devpost form.

No code changed during this gate, so typecheck, test, and build were not rerun.
The latest code-changing release gate remains 29 test files passed, 314 tests
passed, one optional live identity test skipped, with typecheck and build PASS.
