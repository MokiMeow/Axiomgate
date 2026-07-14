# Master Task Board (v3 — consolidated, ADR-008)

This board is authoritative. Where a phase file conflicts, this board wins. Deadline: **submit by 2026-07-20 evening IST** (official deadline 2026-07-21 17:00 PT; ≥1 day buffer). Credits form before **2026-07-17 12:00 PT**.

26 core tasks. Each is a single-owner workstream sized for parallel agent execution. A checked task requires evidence.

## Status key

- `[ ]` Not started · `[-]` In progress · `[x]` Verified (evidence required) · `[!]` Blocked · `[~]` Deferred

## Foundation (target: Jul 14–15)

- [ ] F1 `git init`, baseline commit, `HACKATHON_DELTA.md` stub with baseline hash, credits form submitted, primary Codex thread designated, `CODEX_COLLABORATION.md` started.
- [ ] F2 **Hook gate:** empirically verify on the installed Codex version — `PermissionRequest` payload, deny semantics, fail-open/closed on hook error, `exec --json` usage fields. Record versions in `docs/17`. Blocks all enforcement work.
- [ ] F3 Scaffold `packages/axiomgate-core` (modules: `mission/`, `runway/`, `guard/`, `runtime/`, `evidence/`) inside the PatchPilot-style monorepo + PatchPilot `packages/core` reuse map.
- [ ] F4 Canonical schemas from `docs/02` (contract, action request, approval, evidence, receipt) with validation and hashing.
- [ ] F5 Demo fixture repo (sanitized security-feature target app) + staged wrong-target GitHub/Vercel profile for the block scene.
- [ ] F6 Mission contract creation: one-line objective → contract with 3–6 criteria, evidence types, intent boundary → sandbox mapping, GPT-5.6 model plan (Sol/Terra/Luna + effort) with recorded rationale; editable; versioned; hashed.

## Environment Guard (target: Jul 15–17)

- [ ] G1 Identity resolution (gh identity, git remote, Vercel project/team) + deploy-target existence/ownership proof with evidence capture.
- [ ] G2 Semantic-action policy engine: ALLOW/DENY/REQUIRE_APPROVAL over the demo action set, target/identity restrictions.
- [ ] G3 Hook integration: `PreToolUse`/`PermissionRequest` → policy engine; deny-wins; fail-closed config-hash check at mission start; every decision persisted as evidence.
- [ ] G4 Approval flow: binding to exact command hash, expiry, single-use; dashboard + CLI surfaces; Telegram extended from PatchPilot `telegram`/`approval` modules.
- [ ] G5 Negative test suite: wrong GitHub identity, wrong Vercel target, action substitution after approval, stale approval, boundary escalation, denied production action, secret-output redaction.

## Codex Runtime + Runway lite (target: Jul 16–17)

- [ ] R1 Session adapter: official SDK / `codex exec --json`; sandbox flags from intent boundary; event + token capture; primary session ID preserved.
- [ ] R2 Builder + independent Verifier role contracts (fresh session, no builder-context inheritance); canonical mission state with stop/resume.
- [ ] R3 Runway lite: token-actuals ledger, verification reserve, loop-signature detector (pause recommendation), source/confidence-labelled capacity snapshot + expiring-reset reminder, post-limit checkpoint + `mission resume`.

## Verification via PatchPilot (target: Jul 17–18)

- [ ] V1 Mission-level verification API over `packages/core` (typed runs, events, findings) with plan derived from criteria + diff.
- [ ] V2 Check execution: target repo's own test suite (validation runner) + OSV + Gitleaks + Semgrep (verify WSL on demo machine) + secret scan.
- [ ] V3 Finding → Codex remediation → rerun; stale-evidence invalidation on new commits.
- [ ] V4 Existing PatchPilot regression suite passes after integration.

## Evidence Gate + Product (target: Jul 18–19)

- [ ] E1 Criterion→evidence verdict engine; completion gate (UNKNOWN/BLOCKED block); visible waivers; permission quad (requested/approved/applied/observed).
- [ ] E2 Build Receipt JSON/Markdown from stored events on the audit hash chain + `axiomgate receipt verify <file>` (offline judge verification).
- [ ] E3 Mission timeline dashboard (Plan → Guard → Run → Verify → Prove), blocked-action recovery UX (every block shows a next step), risk-ranked review list, first-run defaults (≤3 approval prompts).
- [ ] E4 CLI (`doctor`, `mission create/run/resume/verify/receipt`, `receipt verify`, `replay`) + **npm publish by Jul 18 EOD** (`npx axiomgate` = doctor + replay, zero config) + protected polish pass (all states, microcopy, the block scene camera-ready).

## Submission (target: Jul 19–20)

- [ ] S1 Hardening: G5 suite green + receipt-tamper test + secret/redaction audit + Windows clean-machine one-command judge path + docs accuracy pass.
- [ ] S2 Replay Lab (3 scenarios, labelled REPLAY: wrong-target block; approved-command mutation denied; missing evidence blocks completion) + live vertical mission recorded end to end.
- [ ] S3 `HACKATHON_DELTA.md` + `CODEX_COLLABORATION.md` complete; `/feedback` run on primary thread, session ID captured; README (problem, setup, platforms, judge path, Codex + GPT-5.6 usage, limitations) + sample receipt + public evidence pack. Real-usage evidence (install counts, user quotes) is **conditional**: include only what is genuinely obtained, with permission and sanitized — never pad.
- [ ] S4 YouTube video <3:00 per `docs/14` (script first, zero dead seconds, accurate LIVE/REPLAY labels) + Devpost fields with "proof-carrying missions" framing + `docs/26` checklist verified in an independent browser session + **submit ≥1 day early**.

## Stretch — only if F–E are verified done by Jul 18 EOD

- [ ] X1 One scripted Playwright browser check on the fixture app (browser evidence type).
- [ ] X2 Diff-size/risky-path maintainability warning.
- [ ] X3 Scout phase (Luna repo-mapping pass feeding the contract).
- [ ] X4 Multi-mechanism equivalence test: the same semantic action via shell CLI and via MCP tool receives the identical policy verdict at the hook (mostly a test over G2/G3 — strong differentiator vs. native guardian).
- [ ] X5 Malicious capability-description scan: run MCP tool descriptions through the existing PatchPilot `promptInjection`/`mcpToolGuard` modules before a mechanism becomes eligible for a semantic action (reuse, not new build).

## Deferred beyond Build Week (ADR-008)

- [~] Desktop (Electron/Tauri) app · full quota-scenario normalization (weekly/rolling/promo/team/multi-provider) · context-pressure and compaction management · model/provider transition safety and handoff packs · custom worktree/branch/port/process leases · general browser/e2e orchestration · console/network capture · maintainability engine · capability-discovery generalization · instruction-compilation NLP · non-Codex provider adapters · Claude portability proof · remaining 9 replay scenarios · MCP registry/gateway (ADR-004) · production deploy paths.
