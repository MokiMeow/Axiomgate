# Master Task Board (v3 — consolidated, ADR-008)

This board is authoritative. Where a phase file conflicts, this board wins. Deadline: **submit by 2026-07-20 evening IST** (official deadline 2026-07-21 17:00 PT; ≥1 day buffer). Credits form before **2026-07-17 12:00 PT**.

26 core tasks. Each is a single-owner workstream sized for parallel agent execution. A checked task requires evidence.

## Status key

- `[ ]` Not started · `[-]` In progress · `[x]` Verified (evidence required) · `[!]` Blocked · `[~]` Deferred

## Foundation (target: Jul 14–15)

- [-] F1 `git init` ✓, baseline `58c1a0a` ✓, `HACKATHON_DELTA.md` ✓, primary thread designated ✓, `CODEX_COLLABORATION.md` ✓ — **remaining: credits form (user, before Jul 17 12:00 PT)**.
- [x] F2 **Hook gate** passed on codex-cli 0.144.0: JSON `permissionDecision:"deny"` enforces (even under bypass); bare exit-2 fails open — never rely on it. Evidence: `docs/17` "F2 gate results". `PermissionRequest`/`exec --json` fields verified in G3/R1.
- [x] F3 Scaffold `packages/axiomgate-core` (modules: `mission/`, `runway/`, `guard/`, `runtime/`, `evidence/`) inside the PatchPilot-style monorepo + PatchPilot `packages/core` reuse map. Evidence: [`evidence/public/f3-f4-verification.md`](../evidence/public/f3-f4-verification.md).
- [x] F4 Canonical schemas from `docs/02` (contract, action request, approval, evidence, receipt) with validation and hashing. Evidence: [`evidence/public/f3-f4-verification.md`](../evidence/public/f3-f4-verification.md).
- [x] F5 Demo fixture repo: sanitized synthetic login target, five canonical mission criteria, isolated live-copy preparation, real wrong-target/out-of-scope staging, and a copy-paste headline runbook. Evidence: [`evidence/public/f5-demo-fixture-verification.md`](../evidence/public/f5-demo-fixture-verification.md).
- [x] F6 Mission contract creation: one-line objective → contract with 3–6 criteria, evidence types, intent boundary → sandbox mapping, GPT-5.6 model plan (Sol/Terra/Luna + effort) with recorded rationale; editable; versioned; hashed. Evidence: [`evidence/public/f6-r1-verification.md`](../evidence/public/f6-r1-verification.md).

## Environment Guard (target: Jul 15–17)

- [x] G1 Identity resolution (gh identity, git remote, Vercel project/team) + deploy-target existence/ownership proof with evidence capture. Evidence: [`evidence/public/g1-g2-verification.md`](../evidence/public/g1-g2-verification.md).
- [x] G2 Semantic-action policy engine: ALLOW/DENY/REQUIRE_APPROVAL over the demo action set, target/identity restrictions. Evidence: [`evidence/public/g1-g2-verification.md`](../evidence/public/g1-g2-verification.md).
- [x] G3 Hook integration: `PreToolUse`/`PermissionRequest` → policy engine; deny-wins; fail-closed config-hash check at mission start; every decision persisted as evidence. Evidence: [`evidence/public/g3-g4-verification.md`](../evidence/public/g3-g4-verification.md).
- [-] G4 Approval flow: exact command-hash binding, expiry, single-use file store, CLI list/approve/deny, and external-reviewer defer routing are verified. Dashboard and Telegram surfaces remain. Evidence: [`evidence/public/g3-g4-verification.md`](../evidence/public/g3-g4-verification.md), [`evidence/public/guard-closeout-verification.md`](../evidence/public/guard-closeout-verification.md).
- [x] G5 Negative test suite: wrong identity/target, approval substitution/mutation/expiry/reuse, boundary escalation, production and unknown-action denial, fail-closed snapshot/input handling, secret non-persistence, and permission mismatch. Evidence: [`evidence/public/guard-closeout-verification.md`](../evidence/public/guard-closeout-verification.md).

## Codex Runtime + Runway lite (target: Jul 16–17)

- [x] R1 Session adapter: official SDK / `codex exec --json`; sandbox flags from intent boundary; event + token capture; primary session ID preserved. Evidence: [`evidence/public/f6-r1-verification.md`](../evidence/public/f6-r1-verification.md).
- [x] R2 Builder + independent Verifier role contracts (fresh session, no builder-context inheritance); canonical mission state with stop/resume. Evidence: [`evidence/public/r2-r3-verification.md`](../evidence/public/r2-r3-verification.md).
- [x] R3 Runway lite: token-actuals ledger, verification reserve, loop-signature detector (pause recommendation), source/confidence-labelled capacity snapshot + expiring-reset reminder, post-limit checkpoint + `mission resume`. Evidence: [`evidence/public/r2-r3-verification.md`](../evidence/public/r2-r3-verification.md).
- [x] Q1 Real Codex capacity source: defensive `account/rateLimits/read` app-server probe, all reported windows, short cache, and honest UNAVAILABLE fallback. Evidence: [`evidence/public/q1-q4-verification.md`](../evidence/public/q1-q4-verification.md).
- [x] Q2 Runway live wiring: app-server-first capacity, manual fallback, real-window reserve math, real banked-reset reminder, and post-limit details. Evidence: [`evidence/public/q1-q4-verification.md`](../evidence/public/q1-q4-verification.md).
- [x] Q3 Model Director `max` tier: full reasoning-effort domain and risk-selected `gpt-5.6-sol/max` recommendation with recorded rationale. Evidence: [`evidence/public/q1-q4-verification.md`](../evidence/public/q1-q4-verification.md).
- [x] Q4 CLI surfaces: live `runway status` table and doctor account-capacity signal with source/confidence labels. Evidence: [`evidence/public/q1-q4-verification.md`](../evidence/public/q1-q4-verification.md).
- [x] Q5 Model Director effort labels: app vocabulary (`Light`, `Medium`, `High`, `Xhigh`, `Max`), empirically verified CLI wire mapping (`Light` -> `low`), legacy-contract migration, and an honest non-orchestrated Ultra capability note. Evidence: [`evidence/public/effort-labels-verification.md`](../evidence/public/effort-labels-verification.md).
- [x] N1 Native AxiomGate skill: repo-discovered governed workflow plus validated global installer artifact. Evidence: [`evidence/public/skill-subagent-verification.md`](../evidence/public/skill-subagent-verification.md).
- [x] N2 Native verifier artifact: versioned read-only Terra/high custom agent, idempotent `install-codex`, doctor presence checks, and honest fresh-session fallback because 0.144.4 lacks deterministic named-agent selection. Evidence: [`evidence/public/skill-subagent-verification.md`](../evidence/public/skill-subagent-verification.md).

## Verification via PatchPilot (target: Jul 17–18)

- [x] V1 Mission-level verification API (typed runs, events, findings) with plan derived from criteria + diff. Evidence: [`evidence/public/v1-v4-verification.md`](../evidence/public/v1-v4-verification.md).
- [x] V2 Check execution: target repo test/build, published PatchPilot OSV scan, and gitleaks-preferred secret scan with labelled heuristic fallback. Semgrep is outside ADR-014's published-CLI boundary. Evidence: [`evidence/public/v1-v4-verification.md`](../evidence/public/v1-v4-verification.md).
- [x] V3 Validated finding → governed Codex remediation → affected-check rerun; stale evidence excluded when its revision marker differs. Evidence: [`evidence/public/v1-v4-verification.md`](../evidence/public/v1-v4-verification.md).
- [x] V4 Published PatchPilot CLI integration verified end to end against a real vulnerable fixture, per ADR-014's reframing (PatchPilot remains unmodified). Evidence: [`evidence/public/v1-v4-verification.md`](../evidence/public/v1-v4-verification.md).

## Evidence Gate + Product (target: Jul 18–19)

- [x] E1 Criterion→evidence verdict engine; completion gate (UNKNOWN/BLOCKED/FAIL/UNVERIFIED block); visible attributed waivers; permission quad mismatches flagged. Evidence: [`evidence/public/e1-e2-verification.md`](../evidence/public/e1-e2-verification.md).
- [x] E2 Build Receipt JSON/Markdown projected from stored records with a 25-record evidence hash chain + offline `axiomgate receipt verify <file>` and live tamper rejection. Evidence: [`evidence/public/e1-e2-verification.md`](../evidence/public/e1-e2-verification.md).
- [ ] E3 Mission timeline dashboard (Plan → Guard → Run → Verify → Prove), blocked-action recovery UX (every block shows a next step), risk-ranked review list, first-run defaults (≤3 approval prompts).
- [-] E4 CLI (`doctor`, `mission create/run/resume/verify/receipt`, `receipt verify`, `replay`) + npm distribution. The bundled `axiomgate@0.1.0` tarball, fresh install, doctor/help, offline receipt tamper rejection, and MCP stdio path are verified; `npm publish` is a user action and replay remains. Evidence: [`evidence/public/publish-prep-verification.md`](../evidence/public/publish-prep-verification.md).

## Submission (target: Jul 19–20)

- [ ] S1 Hardening: G5 suite green + receipt-tamper test + secret/redaction audit + Windows clean-machine one-command judge path + docs accuracy pass.
- [ ] S2 Replay Lab (3 scenarios, labelled REPLAY: wrong-target block; approved-command mutation denied; missing evidence blocks completion) + live vertical mission recorded end to end.
- [ ] S3 `HACKATHON_DELTA.md` + `CODEX_COLLABORATION.md` complete; `/feedback` run on primary thread, session ID captured; README (problem, setup, platforms, judge path, Codex + GPT-5.6 usage, limitations) + sample receipt + public evidence pack. Real-usage evidence (install counts, user quotes) is **conditional**: include only what is genuinely obtained, with permission and sanitized — never pad.
- [ ] S4 YouTube video <3:00 per `docs/14` (script first, zero dead seconds, accurate LIVE/REPLAY labels) + Devpost fields with "proof-carrying missions" framing + `docs/26` checklist verified in an independent browser session + **submit ≥1 day early**.

## Stretch — only if F–E are verified done by Jul 18 EOD

- [ ] X1 One scripted Playwright browser check on the fixture app (browser evidence type).
- [ ] X2 Diff-size/risky-path maintainability warning.
- [ ] X3 Scout phase (Luna repo-mapping pass feeding the contract).
- [x] X4 Multi-mechanism equivalence test: shell `gh pr create` and MCP `github_create_pull_request` classify as `pull_request.create`, receive identical policy reasons/verdicts, and persist separate hook evidence. Exact MCP tool matchers extend the generated hook configuration without a wildcard. Evidence: [`evidence/public/cli-mcp-plugin-verification.md`](../evidence/public/cli-mcp-plugin-verification.md).
- [ ] X5 Malicious capability-description scan: run MCP tool descriptions through the existing PatchPilot `promptInjection`/`mcpToolGuard` modules before a mechanism becomes eligible for a semantic action (reuse, not new build).

## Deferred beyond Build Week (ADR-008)

- [~] Desktop (Electron/Tauri) app · full quota-scenario normalization (weekly/rolling/promo/team/multi-provider) · context-pressure and compaction management · model/provider transition safety and handoff packs · custom worktree/branch/port/process leases · general browser/e2e orchestration · console/network capture · maintainability engine · capability-discovery generalization · instruction-compilation NLP · non-Codex provider adapters · Claude portability proof · remaining 9 replay scenarios · MCP registry/gateway (ADR-004) · production deploy paths.
