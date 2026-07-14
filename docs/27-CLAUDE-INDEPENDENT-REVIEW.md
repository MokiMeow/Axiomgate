# Claude Independent Review

> **HISTORICAL DOCUMENT — RESOLVED.** This review's accepted recommendations were applied on 2026-07-14 through ADR-007..ADR-013 and the blueprint revision recorded in `docs/20-CHANGELOG.md`. The scope reduction demanded by the verdict below **has happened**: `tasks/TASKS.md` v3 and `MASTER_BUILD_CONTRACT.md` now define the Build Week core. This file is evidence of independent review, not the current implementation contract. Do not re-apply its pre-revision findings.

**Reviewer:** Claude (Fable 5), acting as independent principal engineer, product architect, security reviewer, developer-tools researcher, and hackathon judge.
**Date:** 2026-07-14 (Build Week day 2 of 9; submission deadline 2026-07-21 17:00 PT).
**Scope:** Blueprint-only review. No implementation, no file modified except this document.
**Method:** Read all 59 files in this repository; inspected the local PatchPilot project read-only at `C:\Users\Mohith S\Desktop\patchpilot`; performed a live web research sweep on 2026-07-14 (sources in §3).

---

## 1. Executive Verdict

**Verdict: REDUCE SCOPE BEFORE BUILDING.**

**Overall idea score: 7/10. The blueprint as written: 5/10.**

The core thesis is sound, timely, and better evidenced by real-world incidents than the blueprint itself knows. The problem — agents acting with the wrong identity, on the wrong target, past their authority, and claiming completion without proof — is real and was demonstrated publicly twice in the last three months (§3, §4). The judging criteria reward exactly this category, and the Developer Tools track explicitly names "agentic workflows" and "security."

But the blueprint has three defects that would sink the project if implementation started today:

1. **It describes a system that does not exist.** "PatchPilot desktop" appears in nine files. PatchPilot is a Next.js web application with a worker, CLI, and MCP server — there is no desktop app anywhere on this machine. AxiomGate itself has zero lines of code, and this folder is not even a git repository. The blueprint's Phase 4 and Phase 6 tasks instruct an agent to migrate and polish software that was never built.

2. **It never names its enforcement mechanism.** The words "hook," "app server," and "SDK" do not appear once in 27 documents. Codex ships official hooks (`PreToolUse`, `PermissionRequest`, `PostToolUse`, etc., deny-wins, exit-code blocking), an official App Server JSON-RPC protocol, and a TypeScript SDK. These are the only honest ways Environment Guard can actually *enforce* anything rather than politely ask the model to behave. A governance product whose blueprint omits its enforcement point is, as written, governance theatre.

3. **It is 5–10× too large for the seven days remaining.** Ninety tasks, eight phases, a new desktop app, a new CLI, three approval surfaces, fourteen quota scenarios, twelve replay scenarios, browser verification and maintainability analysis that exist nowhere today. The blueprint's own truth rules ("no unsupported certainty," "prefer a smaller truthful product") condemn its own scope.

The correct move is a hard cut to one vertical slice (§18), built on Codex hooks + the Codex SDK + the real PatchPilot engine, with a demo that recreates the publicly documented failure it prevents.

---

## 2. Product Understanding

In my own words: AxiomGate is a local control plane that sits between a developer and Codex. Before Codex runs, it turns a vague request into a signed contract — what to build, what counts as done, what evidence is required, and the maximum blast radius (observe → plan → modify → publish → preview → production). While Codex runs, it enforces that contract: only pre-declared semantic actions (create branch, open PR, deploy preview…) are allowed, each bound to a verified identity (right GitHub account, right Vercel project) and, where consequential, to an explicit human approval that is invalidated if the underlying command changes. After Codex claims completion, an independent verification pass (PatchPilot: real scanners, real test runs, Codex-driven remediation) must produce machine-observed evidence for every acceptance criterion before the mission may close, and the whole run is exported as a tamper-evident Build Receipt. A capacity-planning layer (Runway) advises on model tiers, quota consumption, and loop detection along the way.

The one-line pitch that survives scrutiny: **Codex generates freely; it acts only within explicit authority; it finishes only with external evidence.** That is a genuinely good sentence.

---

## 3. Evidence and Research Summary

### Source ledger

| # | Claim supported | Source | Date | Type | Uncertainty |
|---|---|---|---|---|---|
| S1 | Deadline 2026-07-21 17:00 PT; judging 07-22→08-05; winners ~08-12; 4 equally weighted criteria; `/feedback` session ID required; pre-existing projects allowed if "meaningfully extended" with clear prior/new documentation; $100 credits by 07-17 12:00 PT, spend by 07-31; repo public+license or shared with `testing@devpost.com` + `build-week-event@openai.com` | https://openai.devpost.com/rules (fetched 2026-07-14) | current | **Official** | Low |
| S2 | Developer Tools track = "testing, DevOps, agentic workflows, and security"; prizes incl. $15k cash | openai.devpost.com resources / search results; Devpost X post | Jul 2026 | Official/near-official | Low |
| S3 | GPT-5.6 launched 2026-07-09 with tiers **Sol** (flagship), **Terra** (balanced), **Luna** (cost-efficient); API ~$5/$30, $2.50/$15, $1/$6 per 1M tokens; effort levels selectable on paid plans | TechCrunch 2026-07-09; coursiv/aireiter/digitalapplied coverage. openai.com/index/gpt-5-6 returned HTTP 403 to my fetcher — **not directly verified** | Jul 2026 | Press | Medium on exact prices |
| S4 | Codex app merged into new ChatGPT desktop app (macOS/Windows) on 2026-07-09; Codex remains a dedicated view; Free/Go get Terra, paid plans select tier+effort | Neowin, Developers Digest, techtimes coverage | Jul 2026 | Press | Low-medium |
| S5 | Codex hooks are official: `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop`; exit code 2 / JSON decision blocks; **any deny wins** | developers.openai.com/codex/hooks; codex.danielvaughan.com hook guides (Apr 2026); knightli.com (Jun 2026) | Apr–Jun 2026 | Official + community | Low |
| S6 | Codex App Server = documented JSON-RPC protocol powering all surfaces; official TypeScript SDK; `codex exec --json` reports token/reasoning usage; `codex exec resume --output-schema` | developers.openai.com/codex/sdk & /app-server; openai/codex `codex-rs/app-server/README.md`; openai.com/index/unlocking-the-codex-harness | 2026 | **Official** | Low |
| S7 | Native **Smart Approvals**: `approvals_reviewer = "guardian_subagent"` routes approvals to a risk-assessing reviewer subagent; `--full-auto` deprecated in favor of explicit permission profiles; subagents GA (6 concurrent) | openai/codex PR #13860; alignment.openai.com/auto-review; developers.openai.com auto-review concept page; danielvaughan.com (Apr–May 2026) | Apr–May 2026 | Official + community | Low |
| S8 | Usage limits: rolling 5-hour window + weekly cap; wide message bands per tier; **banked rate-limit resets** announced 2026-06-12 (one free reset for Go/Plus/Pro/Business, 30-day validity, referral promo 06-11→06-24); `/status` in CLI shows percentages; internal `GET /api/codex/usage` returns used_percent/reset_at/plan/credits but is **private and may change**; API-key usage is token-billed with no windows | help.openai.com (Codex plan article, rate card); pasqualepillitteri/knightli/aifeaturedrop coverage; openai/codex issue #15281 (feature request to expose usage), #30041 (dashboard vs CLI quota mismatch) | Jun–Jul 2026 | Official help + issue reports | Medium — programmatic access unofficial |
| S9 | **Real wrong-target incident:** an AI agent (Opus 4.6 + OpenClaw) invented a GitHub repo ID and Vercel's API deployed unrelated code to a customer's team project; acknowledged by Vercel CEO | Oso "AI agents gone rogue" registry; Phemex news; dev.to "Vercel Rejects Deploys from AI Sub-Agents" | ~Apr–May 2026 | Incident report | Low that it happened; medium on details |
| S10 | **Vercel April 2026 security incident**: employee's third-party AI tool (Context.ai) compromised → Workspace account takeover → internal access; customer credential warnings | vercel.com/kb bulletin; The Register 2026-04-20 | Apr 2026 | **Official** | Low |
| S11 | Community pain: false completion claims ("I overclaimed without verifying…"), rate-limit frustration, quota display mismatches, deleted-code complaints | chatgptdisaster.com compilation; openai/codex issues; community forum threads | 2025–2026 | Community opinion | Reported pain, not universal fact |
| S12 | Governance market is crowded at the **enterprise/platform** level: Microsoft Agent Governance Toolkit (Mar 2026: policy middleware, capability guard, audit trail, OWASP Agentic Top 10), Aperion Shield (MCP transport wrapper), Galileo/Lakera/Fiddler, Nobulex (signed agent-action receipts) | github.com/microsoft/agent-governance-toolkit; vendor blogs; superblocks/futureagi roundups | 2026 | Vendor/community | Medium |
| S13 | PatchPilot reality (see §10) | Local inspection of `C:\Users\Mohith S\Desktop\patchpilot` — README, FEATURE_MATRIX.md, package.json, packages/core/src, docs/known-limitations.md, docs/codex-integration.md, git log | verified 2026-07-14 | **Verified locally** | None |

### Could not verify

- `openai.com/build-week/` and `openai.com/index/gpt-5-6/` returned HTTP 403 → exact first-party wording of tier descriptions unverified (press-corroborated).
- `learn.chatgpt.com/docs/changelog` fetch was declined in-session → month-by-month changelog details rest on secondary sources (S5–S7 are corroborated by official doc pages and the openai/codex repo).
- Direct Reddit/X thread contents (search snippets only). Community claims are labeled as such.
- AxiomGate git history — **this folder is not a git repository** (no `.git` present), despite the session harness reporting one.

---

## 4. Problem and Market Validation

**Is the problem real?** Yes, and the strongest evidence arrived after this blueprint was drafted styles: the invented-repo-ID deployment (S9) is precisely the failure Environment Guard's identity/target verification prevents, and the Vercel breach via a third-party AI tool (S10) validates the credential-isolation posture. False-completion pain is persistently reported (S11) and even Codex's own guardian/auto-review work (S7) is OpenAI conceding that unreviewed agent actions are a real risk. Quota anxiety is real enough that OpenAI shipped banked resets and a referral promo for them (S8).

**Who feels it most?** Developers running Codex semi-autonomously across multiple repos/accounts on subscription plans — exactly the blueprint's stated user (`MASTER_BUILD_CONTRACT.md` "Primary user"). Solo developers and small teams, not enterprises (enterprises are served by S12's platforms).

**Frequency and urgency:** Identity/authority failures are low-frequency, high-severity; completion-without-proof is high-frequency, medium-severity; quota exhaustion is high-frequency, low-severity. The product wisely bundles them, but the *demo* must lead with the high-severity one.

**Would developers install it?** The honest answer: only if setup is near-zero and it doesn't slow the default loop. A local runtime that requires a new desktop app, project profiles, mission contracts, and policy configuration before the first run will lose most of its funnel. This is the single biggest product risk, and the blueprint's UX doc (`docs/13`) does not confront it. Native Smart Approvals (S7) set the bar: zero-setup, in-band. AxiomGate must justify its extra ceremony with things the guardian cannot do — deterministic policy, identity verification against real accounts, and external evidence.

**Is it a product or a bundle of safeguards?** As blueprinted, it drifts toward a bundle (six layers, each with its own vocabulary). The connective tissue — one mission timeline from contract to receipt — is what makes it a product. Keep that spine, amputate the rest.

**Is the value understandable in 20 seconds?** "Codex can't push to the wrong account, can't act beyond what you approved, and can't say 'done' without proof — here's the receipt" passes the 20-second test. "Mission-control and governance runtime with six layers" does not.

**Naming:** *AxiomGate* is acceptable — abstract but serious, and the Gate half maps to the product's best moment (a blocked action). "Mission control for Codex" is decent framing; "a permission system and lie detector for Codex" is what people will actually repeat. The tagline "Plan. Govern. Execute. Prove." is good; consider leading marketing with "Prove."

---

## 5. Codex-First and GPT-5.6 Evaluation

**Is Codex genuinely central?** In the blueprint's intent, yes — Codex is the only implementation engine, and Scout/Builder/Verifier are all Codex sessions. But the blueprint never touches the actual Codex integration surface (hooks, App Server, SDK, `codex exec --json`, `--output-schema`, sandbox modes, permission profiles). Ironically, the *deepest possible* Codex-first design is available and unclaimed: Environment Guard as a first-class consumer of Codex's official hook protocol is a "how thoroughly and skillfully does the project use Codex" (S1, criterion 1) answer that most competitors will not have. As written, though, the design could be read by a judge as a generic agent wrapper. Fix: name the mechanisms, use them, show them.

**Which features duplicate native Codex functionality?**
- *Guardian Smart Approvals* (S7) overlaps semantic approvals — but the guardian is a model judging a model. AxiomGate's differentiation is legitimate: deterministic user-authored policy, identity verification against live `gh`/`vercel` state, and approval-to-execution binding. State this contrast explicitly in the submission; it converts a threat into the pitch.
- *Native worktrees, automations, resume, compaction* absorb most of Codex Runtime's coordination scope (P3-05..P3-09). Cut them.
- *AGENTS.md handling* absorbs much of "instruction compilation." Cut to a conflict-detection demo at most.
- *`/status` + usage dashboard* absorb the display half of Runway; what's left of value is per-mission actuals (`codex exec --json` token usage — official, reliable, S6), reserve policy, and loop detection.

**Is GPT-5.6 used meaningfully?** The Model Director is the genuine GPT-5.6 story: phase-appropriate tier selection (Luna for scouting, Sol high-effort for security-sensitive builds, Terra for remediation) with a recorded rationale and an actual-vs-planned ledger. Tiers and effort levels are real and selectable (S3, S4). This is more meaningful than most submissions' "we called the new model." The Scout/Builder/independent-Verifier split is justified *only* in its cheapest form: the Verifier as a fresh Codex session that did not inherit the Builder's context is cheap, defensible, and matches the "no self-grading" thesis. Six concurrent subagents, port leases, and parallel worktrees are not justified for one mission.

**Build Week emphasis satisfied?** With the cuts and the hook-native integration: yes, strongly. As written: partially, and at risk of looking like architecture cosplay.

---

## 6. Architecture Review

Lifecycle order (Compiler → Runway → Guard → Runtime → Verify → Gate) is coherent; boundaries in `docs/01` are mostly clean. Layer-by-layer:

### 6.1 Mission Compiler
- **Problem solved:** vague goals and unverifiable "done."
- **Class: Core** (in a reduced form: objective, 3–6 acceptance criteria with evidence types, intent boundary, action policy — a schema and an editor, not an NLP system).
- **Inputs/outputs:** request + project profile → versioned, hashed contract. Fine.
- **Hardest dependency:** none real if reduced; instruction discovery/classification across sources is where it silently becomes an NLP research project. `docs/03` "completion criteria: every criterion can be independently verified" is a *quality bar on the user's input*, not implementable logic — the compiler can at best warn.
- **Security risk:** prompt injection via compiled repository instructions (mitigated by classification, honestly caveated).
- **Complexity:** Low if reduced; unbounded as written.
- **Docs sufficient?** Mostly; missing a concrete contract JSON schema.
- **Overlap:** injection scanning duplicated with Environment Guard (`docs/03` vs `docs/05`) — assign to Guard.

### 6.2 Runway
- **Problem solved:** spending scarce capacity blindly; loops; losing verification headroom.
- **Class: Supporting** (advisory), with two Core slivers: verification reserve and per-mission actuals ledger.
- **Hardest dependency:** subscription quota data. No official programmatic source (S8). `/status` parsing is fragile; the private usage endpoint may change; issue #30041 shows even official surfaces disagree with each other.
- **Security risk:** low (advisory); the risk is *credibility* — invented numbers would violate the project's own truth rules.
- **Complexity:** the 14-scenario normalization matrix is the single largest hidden workload in the blueprint.
- **Docs sufficient?** `docs/04` is honest about limitations (good) but the task list (P1-05..P1-12) doesn't reflect that honesty.
- **Verdict:** Runway *as blueprinted* is exactly the "attractive dashboard built on uncertain data" the prompt warns about. Reduced to observed actuals + reserve + loop detection + confidence-labeled advisories, it is honest and demo-able. Full analysis in §8.

### 6.3 Environment Guard
- **Problem solved:** wrong identity, wrong target, authority escalation. The strongest layer; the market and incidents (S9, S10) back it.
- **Class: Core.**
- **Inputs/outputs:** capability inventory + project profile → mission policy; action request → allow/deny/approve decision + evidence.
- **Hardest dependency:** **the enforcement point, which the blueprint never names.** Codex hooks (S5) are the answer: `PreToolUse`/`PermissionRequest` hooks calling into the AxiomGate policy engine, deny-wins, with decisions logged as evidence. Without this, every allow/deny table in `docs/05` is decorative.
- **Security risk:** bypass (Codex run outside AxiomGate's config scope), action substitution after approval (mitigable: bind approval to command hash seen by the hook), confused deputy via MCP tools (PreToolUse sees tool name + args).
- **Complexity:** medium once hooks are the mechanism; the *capability discovery* generalization (normalize every CLI/MCP/skill/app on the machine) is unnecessary for one mission — inventory the ~8 semantic actions the demo needs.
- **Overlap:** none problematic.

### 6.4 Codex Runtime
- **Problem solved:** durable mission state, controlled execution.
- **Class: Core reduced / Supporting as written.** The Codex adapter (SDK/app-server client, `exec --json` event capture, session ID preservation) is Core. Worktree/port/process leasing, model-transition validation, handoff packs: Post-hackathon — native Codex covers or obviates them (S6, S7).
- **Hardest dependency:** app-server protocol stability — official and documented (S6), acceptable.
- **Security risk:** running Codex with broader sandbox than the mission's intent boundary; mitigate by mapping boundary → sandbox flags (`--sandbox workspace-write`, network access off) exactly as PatchPilot already does (S13).

### 6.5 Verification Engine
- **Problem solved:** self-graded completion.
- **Class: Core** — and mostly **already built**: PatchPilot has real scanners (OSV, Gitleaks, Trivy, Syft, Semgrep-via-WSL), a validation runner (npm install/ci/test/build), a Codex remediation loop with disposable secret-scrubbed workspaces, and live-verified GitHub PR flow (S13).
- **The lie in the blueprint:** `docs/07` claims browser verification and maintainability analysis as PatchPilot integration. **PatchPilot has neither** (FEATURE_MATRIX.md; known-limitations.md). These are new builds, mislabeled. Browser verification alone is multi-day work (Playwright orchestration per target project). Cut both from Build Week claims.
- **Complexity of the honest subset:** low-medium — a mission-level API over engine functions that already exist.

### 6.6 Evidence Gate
- **Problem solved:** completion claims without proof; approvals nobody understands.
- **Class: Core** — and partially built: PatchPilot has hash-chained audit receipts, provenance attestations, and HMAC-verified Telegram approvals with chat-ID allowlists and two-step push→merge gates (S13). The Build Week work is lifting these from finding-level to mission-level (criterion → evidence mapping; mission Build Receipt).
- **Largest risk:** *governance theatre* — a beautiful receipt over unverified inputs. The mitigation is already in the blueprint's own rules: receipts derive only from stored evidence events (ADR-005). Keep the enforcement honest: an acceptance criterion whose evidence type can't be machine-observed in this build must be marked `UNKNOWN`/`WAIVED`, visibly.
- **Human Review Map / Proof Graph:** fine as a ranked list and a table. Do not build graph visualizations.

**Cross-cutting failure mode:** the blueprint defines six services, twelve+ schemas, and an event-sourced store before any user value exists. For seven days, collapse to one process (extend PatchPilot's existing Next.js + worker + core monorepo), one SQLite/JSON store, typed events, and the six layers as *modules*, not services.

---

## 7. Feature Classification

| Capability | Classification | Rationale / what is lost if cut |
|---|---|---|
| Mission Contract | **Core for Build Week** | Reduced schema: objective, criteria+evidence types, intent boundary, action policy, hash. |
| Instruction compilation | **Small proof only** | One conflict/injection warning demo. Codex reads AGENTS.md natively; full classification is an NLP rabbit hole. Lost: multi-source instruction hygiene — acceptable. |
| Runway forecasting | **Small proof only** | Range + confidence from per-session `--json` actuals and manual plan input. Lost: predictive dashboards that would have been guesses anyway. |
| Quota normalization | **Supporting but required** (reduced) | One `CapacitySource` type with source+confidence labels; `/status`-derived or manual observation. Not 14 scenarios. |
| Banked reset reminders | **Small proof only** | Real feature (S8), trivial reminder, one demo line. |
| Model planning (Model Director) | **Supporting but required** | The GPT-5.6 story: phase→Sol/Terra/Luna+effort with recorded rationale. Cheap, high judge value. |
| Loop detection | **Small proof only** | Same-failure-signature counter over `exec --json` events → pause recommendation. Lost: nuanced progress metrics. |
| Continuity checkpoints | **Post-hackathon** | Native resume/compaction cover the demo path. Lost: cross-session insurance — acceptable for a 3-min demo. |
| Model-transition safety | **Post-hackathon** | No cross-provider transition in the demo. |
| Project profiles | **Supporting but required** | Needed by Identity Guard; a small config record, not a management UI. |
| Identity Guard | **Core for Build Week** | gh identity + git remote + Vercel project verification; blocks the S9-class failure. The demo's best moment. |
| Intent boundaries | **Core for Build Week** | The 6-level ladder, enforced via hooks + sandbox flags. |
| Semantic approvals | **Core for Build Week** | Approval bound to exact action/target/command-hash via `PermissionRequest` hook. |
| Capability Policy | **Supporting but required** (reduced) | Allow/deny/approve over the ~8 demo semantic actions. Not a general capability-discovery engine. |
| Codex Scout | **Small proof only** | One Luna-tier repo-mapping pass feeding the contract. Lost if cut entirely: a nice model-tier beat. |
| Codex Builder | **Core for Build Week** | The mission itself. |
| Independent Verifier | **Supporting but required** | Fresh Codex session reviews the diff without builder context. Cheap, on-thesis. |
| Worktree & port coordination | **Post-hackathon** | Native Codex worktrees exist; single mission needs none. |
| PatchPilot integration | **Core for Build Week** | Verification engine + remediation loop + receipts + Telegram — the reuse dividend. |
| Functional testing | **Supporting but required** | Run the target repo's own test suite via PatchPilot's validation runner. |
| Browser verification | **Post-hackathon** | Does not exist in PatchPilot; days of work; remove from all claims now. Lost: UI-behavior proof — say so honestly in the receipt. |
| Security verification | **Core for Build Week** | Already real: OSV/Gitleaks/Semgrep/secrets (S13). |
| Maintainability analysis | **Post-hackathon** | Does not exist; keep at most a diff-size warning. Lost: entropy guard — acceptable. |
| Automatic remediation | **Core for Build Week** | Exists in PatchPilot (Codex remediation + validation rerun). |
| Proof Graph | **Supporting but required** | As a criterion→evidence table, not a graph viz. |
| Human Review Map | **Small proof only** | Risk-ranked review list over the diff. |
| Telegram approvals | **Supporting but required** | Reuse PatchPilot's HMAC/two-step implementation nearly as-is. High demo value per hour. |
| Build Receipt | **Core for Build Week** | Mission-level JSON+Markdown, derived from stored events; extend PatchPilot's hash-chain audit. |
| Evaluation Replay Lab | **Small proof only** | 3 replay scenarios (wrong identity block, approval binding, missing evidence blocks completion) — not 12. |
| Claude portability proof | **Remove** | Judges score Codex depth (S1). Every hour here dilutes the story. Lost: a cross-provider talking point nobody asked for. |
| Other-provider adapters | **Remove** | Same reason. `docs/17` already says fixtures-only; make it zero. |

---

## 8. Runway Feasibility

Data-source reality per scenario (labels: **OFFICIAL-API / CLI / DASHBOARD / BROWSER-OBS / MANUAL / HISTORICAL / NONE**):

| Scenario | Best available source | Honest support level |
|---|---|---|
| 5-hour + weekly limits | CLI `/status` (interactive only); private `GET /api/codex/usage` (undocumented, may change, S8); dashboard | Observable with medium confidence; **not** a stable API. Issue #30041 shows first-party surfaces disagreeing. |
| Weekly-only limits | Same | Same |
| Limits removed/restored | Observation deltas | Detectable after the fact only |
| Subscription allowances | Help-center bands (wide, dynamically adjusted, S8) | MANUAL/HISTORICAL; ranges only |
| Banked resets | ChatGPT UI; announced mechanics (S8) | MANUAL entry + reminder; no API |
| Expiring promo capacity | Same | MANUAL |
| Purchased credits | Dashboard/help | MANUAL/DASHBOARD |
| API billing | **OFFICIAL-API** (platform usage/billing endpoints) | Genuinely supportable |
| Unlimited plans | Trivial | Supported |
| Unknown quotas | By definition | Supported via `UNKNOWN` labeling |
| Shared workspace pools | None known | NONE — mark unsupported |
| Multiple providers | Out of scope after cuts | Remove |
| Limit changes mid-mission | Observation deltas | Detect + warn only |
| Per-mission token actuals | **`codex exec --json` usage output (S6)** | **The one first-class, official, reliable source.** Build the ledger on this. |
| Model/reasoning changes | Config/API — controllable by AxiomGate itself | Supported (it's the actor) |
| Continuity/compaction | `PreCompact`/`PostCompact` hooks exist (S5) | Observable; deep management post-hackathon |
| Loop detection | Own event stream | Supported (own data) |
| Verification reserve | Own policy | Supported (own policy) |

**Determination:** Runway is a real engine only where it consumes data it *owns* (session events, token actuals, its own policy) and an honest advisor everywhere else. The blueprint's saving grace is that `docs/04` already says this ("Honest limitations"); the task plan just ignores it. Cut P1-05..P1-09 to a single normalized `CapacitySource` with confidence labels, keep the ledger, reserve, and loop detection. Anything more is a dashboard wearing an engine costume.

---

## 9. Security and Authority Review

**Enforcement path (the missing spine):** Codex hooks give a deny-wins, exit-code-blocking interception point for tools, commands, and permission requests (S5), and the App Server gives typed session control (S6). Environment Guard must be implemented as: (a) AxiomGate-managed Codex config (hooks + sandbox + permission profile) per mission; (b) a local policy endpoint the hooks call; (c) every decision persisted as evidence. This is both enforceable and evidencable. The blueprint's omission of this is its most serious technical gap.

**Boundary-by-boundary:**
- *Intent boundaries:* enforceable by mapping levels to sandbox/network flags + hook policy (deny `pull_request.create` below PUBLISH, etc.). Sound.
- *Identity:* `gh api user` / `gh auth status`, `git remote -v`, `.vercel/project.json` + `vercel whoami` are deterministic, cheap, and directly prevent the S9 incident class. Strongest control in the design.
- *Credentials:* PatchPilot already demonstrates the right pattern — secret-scrubbed child environment for Codex, exclusion of `.env*`/keys from workspaces (S13). Reuse verbatim.
- *Semantic approvals:* binding approval to the exact command/args hash observed by the `PermissionRequest` hook defeats action-substitution and stale approvals (add expiry + single-use). Feasible.
- *Effective-permission reconciliation (4 levels):* requested/approved/applied are fully observable (AxiomGate sets the config; hooks see the action). "Observed external result" is verifiable for GitHub/Vercel via their APIs (did a PR appear? on which repo? by which login?). Claim those; do not claim OS-level permission observation.
- *Prompt injection:* PatchPilot ships an injection scanner for CVE text/READMEs/scanner output (S13). Reuse; label as heuristic. `SECURITY.md`'s "prompt-injection classification" is otherwise unbacked.
- *Bypass risks to disclose:* the user (or the model, if given shell access to its own config dir) editing hook config out-of-band; Codex launched outside AxiomGate entirely; hooks failing open on crash (verify Codex's failure semantics during Phase 0 — **unverified**, flagged). Fail-closed wrapper: refuse to start a mission whose config hash doesn't match.
- *Telegram:* HMAC + webhook secret + chat allowlist already implemented and tested in PatchPilot. Reuse; add replay nonce if absent.
- *Security theatre check:* `SECURITY.md` and `docs/10` list controls ("capability integrity metadata", "no silent browser-profile reuse") with no enforcement path or task. Either wire each control to a hook/check/test or delete the line — an unenforced control in a security document is a liability at judging.

---

## 10. PatchPilot and Verification Review

**Verified reality (local inspection, S13):** pnpm monorepo, built 2026-05-26 → 2026-05-31 (git log) for an earlier event; hosted demo at trypatchpilot.vercel.app.
- `apps/web` — Next.js 15 dashboard. `apps/worker` — scan/remediation worker. `apps/cli` — published npm CLI. `apps/mcp` — MCP server (22 tools). `packages/core` — ~40 modules incl. `osv, scanners, secrets, promptInjection, mcpToolGuard, llmOutputGuard, redaction, audit (hash chains), attestation, approval, telegram, codex, gitOps, github, validation, risk, reachability, pathSafety, workspace`.
- Codex integration is deep and live-verified: `codex exec --cd <ws> --sandbox workspace-write --ephemeral -c approval_policy="never"`, prompt via stdin, secret-scrubbed env, changed-file capture, validation before PR, deterministic fallback, quota-limited state handled honestly.
- **It is not a desktop app.** Nine blueprint references to "PatchPilot desktop" are false (list in §17).
- **It lacks:** browser verification, maintainability analysis, arbitrary-suite test orchestration beyond npm validation commands, Python test execution, non-npm remediation (Go/Maven/Cargo/Composer scan-only).

**What AxiomGate can reuse (high confidence):** the entire verification/remediation loop, receipts/attestation/hash chain, Telegram approvals, redaction/secret handling, injection scanning, workspace isolation, the Next.js dashboard shell, and the monorepo itself.

**What must remain separate:** PatchPilot's CVE-watch identity (Watch Commander inventory/watch mode) is a different product loop; do not absorb it. Integration boundary: a typed internal API over `packages/core` functions (in-process is fine inside one monorepo) — exactly what `docs/09`'s "suggested operations" list describes, minus the desktop framing.

**Unnecessary duplication risk:** Phase 5's Telegram, receipts, and redaction tasks would rebuild existing PatchPilot code; rewrite those tasks as "extend."

**Can remediation be done by Codex and independently reverified?** Yes — this already works in PatchPilot today (finding → Codex fix in disposable workspace → validation rerun → PR). It is the most defensible demo segment in the whole plan.

**Verification claims that can be made honestly for Build Week:** functional correctness via the target repo's own test suite; regression via full-suite rerun; dependency safety (OSV/Trivy); secret safety (Gitleaks + redaction tests); basic SAST (Semgrep, WSL caveat on Windows — note the demo machine is Windows, verify WSL availability in Phase 0); deployment health via URL check; identity correctness via the Guard. **Not honestly claimable:** browser behavior, maintainability, full security review.

---

## 11. Evidence Gate Review

Evidence-backed completion is the strongest differentiator, and it is *almost* already real: PatchPilot's hash-chained audit receipts and provenance attestations (S13) mean the Build Week work is elevation (finding-level → mission-level), not invention. Requirements to keep it real rather than theatrical:

1. Every criterion's evidence must be a machine observation (test runner exit code + output hash, scanner JSON, GitHub API response, deployment URL probe) — never model prose. ADR-005 already mandates this; enforce it in the schema (evidence records carry `source: command|api|hook`, never `source: model`).
2. Completion gate = pure function over criterion verdicts; `UNKNOWN`/`BLOCKED` block; waivers are visible, attributed, and reasoned. (`docs/08` has this right.)
3. Approval records must include the bound command hash and expiry (§9), and the receipt must show requested/approved/applied/observed permission agreement — this quad is genuinely novel presentation-wise; Nobulex-style signed receipts (S12) exist, but nobody ties them to a *coding mission's acceptance criteria*.
4. Skip receipt signing for Build Week (hash chain suffices; `docs/08` already defers signing — correct call).
5. Replayability: 3 deterministic replay scenarios with mandatory `LIVE/SANDBOX/REPLAY` labels (`docs/25` labeling rule is good; 12 scenarios is not).

Residual theatre risk: medium-low after cuts, provided browser/maintainability claims are removed so no criterion silently depends on evidence the system cannot produce.

---

## 12. UX and Daily-Use Review

- **Setup is too heavy as designed.** New desktop app + project profiles + contracts + policies before first value. Mitigation: `axiomgate mission create` must work with a one-line objective and defaults (auto-detected identity, standard policy template, MODIFY_LOCAL boundary), with the full editor optional. Target: first governed mission in under 3 minutes.
- **Terminology overload.** Mission Compiler / Runway / Environment Guard / Codex Runtime / Verification Engine / Evidence Gate / Proof Graph / Human Review Map / Model Director / Build Receipt / Replay Lab — eleven proper nouns. A judge gets six layer names max; a user should see plain stages: **Plan → Guard → Run → Verify → Prove**. Keep internal names in code, not in the UI.
- **Approval fatigue is the product-killer risk.** With allow-listed read/local actions and approvals only at PUBLISH+ boundaries, a demo mission needs exactly 2 approvals (PR, preview deploy). If a normal mission generates >3 prompts, users will disable the product. The semantic-approval design (`docs/05`) is good; the discipline is in policy defaults.
- **Runway recommendations are actionable** only when phrased as one decision ("Reserve ~20% for verification — accept?"), not as dashboards.
- **Recovery:** blocked-action states must always present a next step (edit policy / approve once / abort). `docs/13`'s error-recovery requirement is right; no task implements a recovery UX — add to the slice.
- **Daily use:** plausible for the wrapper loop (`axiomgate mission run` wrapping codex) if startup cost ≈ zero. The desktop app is *not* required for daily value — the CLI + web dashboard (already existing in PatchPilot form) suffice. Drop the desktop app.
- **Demo comprehensibility:** the storyboard in `docs/14` is well-paced but covers 8 segments in 175 seconds; with the cuts it covers 6. Good.

---

## 13. Hackathon Evaluation

Official criteria (S1), equally weighted:

| Criterion | Blueprint as written | After recommended cuts |
|---|---|---|
| **Technological Implementation** ("how thoroughly and skillfully does the project use Codex?") | **5/10** — Codex-centric in spirit but never engages hooks/SDK/app-server; high risk of unfinished layers | **8.5/10** — hook-native enforcement + SDK-driven sessions + tiered GPT-5.6 usage + Codex-remediation loop is among the deepest Codex integrations possible |
| **Design** (complete, coherent product experience) | **5/10** — six-surface scope guarantees incompleteness; desktop app from scratch | **7.5/10** — one mission timeline, CLI + existing web dashboard, polished blocked-action and receipt moments |
| **Potential Impact** | **7/10** — real problem, real incidents (S9, S10), broad Codex user base | **8/10** — same, better told: "this blocks the exact failure that hit Vercel's customers in April" |
| **Quality of the Idea** | **7/10** — governed-mission lifecycle is novel as a combination; individual parts exist (guardian approvals, governance toolkits, receipts) | **7.5/10** — sharper: deterministic authority + external evidence vs. model-judged safety |

**Estimates:**
- Current blueprint, executed as written: **5.5/10 overall** — it will not be finished, and unfinished governance reads worse than unfinished toys.
- After recommended cuts: **7.9/10.**
- Fully implemented but poorly demonstrated: **6/10** — this product's value is invisible without a crisp blocked-action + receipt demo.
- Strongest vertical slice, polished demo: **8.3/10.**
- **Realistic first-place potential:** genuine but not favored — top-decile in Developer Tools is achievable; overall winner requires flawless execution *and* the demo landing emotionally (the wrong-account block is the moment). Call it a legitimate outside shot.
- **Clearest reasons it could lose:** (1) unfinished breadth; (2) judges reading it as "settings UI around Codex features they already ship" if the hook/evidence depth isn't shown; (3) governance demos are less viscerally exciting than generative demos; (4) receipt/verification claims that a judge spot-checks and finds hollow (e.g., a browser-verification checkbox with nothing behind it); (5) losing time to the desktop app and missing the deadline.

---

## 14. Strongest Case Against the Project

OpenAI is absorbing this category in real time. In the last four months Codex shipped guardian-reviewed Smart Approvals, explicit permission profiles replacing `--full-auto`, hooks for policy enforcement, native worktrees and automations, banked resets with UI reminders, and a usage dashboard (S5–S8). Every quarter, another AxiomGate layer becomes a config option. A product whose pitch is "controls OpenAI hasn't built yet" is a product with a shrinking half-life, built by one person, in seven days, on top of an undocumented quota endpoint and a web app mislabeled as a desktop app in its own contract.

The breadth is self-defeating: six layers, ninety tasks, three approval surfaces, and a replay lab — for a demo that gets 175 seconds. The data Runway needs most (subscription quota) has *no official API*, and OpenAI's own surfaces disagree about it (issue #30041); whatever numbers AxiomGate shows will sometimes be wrong, and a governance tool that is wrong about the thing it governs loses trust permanently. Governance itself adds friction to a loop developers chose *because* it removed friction; the guardian subagent gives them 80% of the safety for 0% of the setup. Enterprises that genuinely need policy enforcement already have Microsoft's toolkit and a crowded vendor field (S12). And developers are rationally wary of a local runtime that inserts itself between their credentials, their shell, and their repos — the exact trust position that Context.ai occupied when it got Vercel breached (S10). The likeliest outcome as written: an unfinished meta-product about safety, competing against finished products about capability.

## 15. Strongest Case for the Project

Every fact the rejection cites cuts the other way on inspection. OpenAI shipping guardian approvals and hooks doesn't invalidate the thesis — it *ratifies* it (the vendor itself concedes unreviewed agent action is unacceptable) and simultaneously provides the official enforcement rails AxiomGate needs. The guardian is a model judging a model with no memory of what you approved and no knowledge of which GitHub account is signed in; AxiomGate's layer is deterministic, user-authored, identity-aware, and evidence-producing — properties that get *more* valuable as agents get more autonomous, not less. The failure class is not hypothetical: an agent invented a repo ID and Vercel deployed a stranger's code to a customer's project this spring (S9). No native Codex feature today checks that a deploy target matches the project the user actually owns. AxiomGate's single best demo moment is literally re-enacting a documented industry incident and stopping it.

The build risk is also smaller than it looks, because the hard 40% already exists and is live-verified: PatchPilot's scanner suite, Codex remediation loop, hash-chained receipts, and Telegram approvals (S13) were built and tested in May. Build Week work is composition — contract, hooks, identity checks, mission receipts — on official, documented interfaces (S5, S6). The combination (contract → enforced authority → independent verification → evidence-derived receipt) exists in no shipping product at the individual-developer level; the enterprise platforms (S12) neither run your mission nor produce acceptance-criterion evidence. And it satisfies the judging rubric unusually well: hook-and-SDK depth for Technological Implementation, one coherent timeline for Design, documented incidents for Impact, and a crisp contrarian thesis ("agents should carry proof, not confidence") for Idea Quality. Post-hackathon, the same skeleton is a plausible real tool: proof-carrying agent runs are where team adoption of coding agents is visibly heading.

**Which argument wins:** the case *for* — but only at reduced scope. The case against is decisive against the 90-task blueprint and loses against the vertical slice. Build the slice.

---

## 16. Missing User Problems and New Ideas

Screened against the six strict criteria; only two additions qualify, both replacing something:

1. **Deploy-target existence & ownership proof** (sharpen Identity Guard). Before any `preview.deploy`/`pull_request.create`, resolve the target repo/project via GitHub/Vercel APIs and verify it exists *and* is owned by the profile's account — exactly the check whose absence caused S9. Repeatedly observed problem (S9, Oso registry); fits Environment Guard; strengthens the thesis; demo-able in the same mission; near-zero cost (two API calls). **Make room by:** deleting the general "capability trust static-analysis" ambitions in `docs/05` (obfuscated-code detection, integrity metadata) which are unimplementable this week.

2. **Post-limit resume plan** (sharpen Runway). When the weekly/5-hour limit interrupts a mission (top community complaint, S8/S11): checkpoint mission state, show reset time and banked-reset option, and offer a one-command resume. Fits Runway/Runtime; uses only own data + observed reset times; demonstrable in replay. **Make room by:** cutting the multi-provider capacity normalization (P1-05 breadth) entirely.

Explicitly rejected despite market noise: MCP gateway/registry (ADR-004 already correctly excludes it), cost-per-feature analytics (post-hackathon), team/shared policy (enterprise, out of scope), auto-generated AGENTS.md hygiene (different product).

---

## 17. Documentation and Task Inconsistencies

To correct later (do not fix during this review):

1. **"PatchPilot desktop" is false** in: `README.md` (layer 5 description implies desktop), `MASTER_BUILD_CONTRACT.md:120`, `START_HERE.md:29`, `AGENTS.md:100`, `docs/07-VERIFICATION-ENGINE.md:9`, `docs/09-PATCHPILOT-INTEGRATION.md` (title + "Mandatory audit" + "Desktop requirements" + IPC framing), `docs/20-CHANGELOG.md:12`, `tasks/TASKS.md` P4-01/P4-11, `tasks/PHASE-0-AUDIT-FOUNDATION.md:10`. PatchPilot is a Next.js web app + worker + CLI + MCP monorepo (verified locally).
2. **No enforcement mechanism named anywhere.** `docs/05`, `docs/06`, `docs/17`, and Phase 2/3 tasks must specify Codex hooks (`PreToolUse`/`PermissionRequest`, deny-wins), sandbox/permission-profile mapping, and the App Server/SDK as the session interface. Grep confirms zero occurrences of "hook"/"app server"/"SDK" (excluding one incidental use in docs/26).
3. **Browser verification and maintainability analysis are claimed as PatchPilot integration** (`MASTER_BUILD_CONTRACT.md` §5, `docs/07` check families, `docs/14` demo script, P4-07/P4-08, required vertical mission "browser" clause) — PatchPilot has neither; they are new builds and must be re-scoped or removed from Build Week claims and the mission definition.
4. **Not a git repository** — violates its own contract (baseline commit, branch strategy, hackathon delta all impossible until `git init` + baseline commit). Also `BLUEPRINT_MANIFEST.json` says 58 files; the tree contains 59.
5. **Task volume vs. calendar:** 90 tasks / 7 days. `tasks/TASKS.md` needs a cut-line marking the vertical slice; Phase 6 assumes an existing desktop stack ("Existing stack audit required" in `docs/21` — there is no stack).
6. **Duplicate responsibilities:** prompt-injection/instruction scanning in both `docs/03` and `docs/05`; loop/agent-multiplication control in both `docs/04` and `docs/06`. Assign each to one layer.
7. **`START_HERE.md:29`** tells the agent to inspect "existing source code, package manifests, CI configuration" of this repo — none exist; misleading preflight.
8. **Unenforced security controls:** `SECURITY.md` ("capability integrity metadata," "no silent browser-profile reuse," "prompt-injection classification") and `docs/10` mitigations lack any implementing task; wire or delete.
9. **Missing schemas:** no concrete JSON schema for Mission Contract, Action Request, Evidence, or Receipt anywhere (`docs/02` lists fields only); an implementation agent will invent divergent shapes.
10. **Missing failure states:** hook-unavailable / Codex-version-mismatch / hooks-fail-open cases absent from `docs/01` failure model and `docs/17` compatibility matrix (matrix also has no baseline row for the actual Codex version to be targeted).
11. **Phase 5 rebuild-vs-reuse:** P5-06 (Telegram), P5-10 (redaction/hashing) duplicate existing PatchPilot modules; rewrite as "extend `packages/core` X."
12. **`docs/26` dates:** judging ends Aug 5 per Official Rules; winners ~Aug 12 (doc conservatively says keep available through Aug 12 — fine, but state both dates).
13. **Terminology drift:** "action authority" (`docs/03`) vs "intent boundary" (everywhere else); "budget policy" vs "capacity"; unify.
14. **`docs/13` CLI:** 12 command families exceed Phase 6's realistic scope; mark the 5 that matter (`mission create/run/verify/receipt`, `doctor`).

---

## 18. Recommended Final Scope

**Product boundary (one sentence):** A CLI + local web dashboard that runs one governed Codex mission end-to-end — contract in, hook-enforced authority and identity during, PatchPilot verification after, evidence-derived Build Receipt out.

**Build exactly this vertical slice:**

1. **Mission Contract** (schema + hash + minimal create/edit UI/CLI): objective, 3–6 acceptance criteria with evidence types, intent boundary, action policy.
2. **Environment Guard**: project profile; identity resolution (gh + git remote + Vercel project, incl. target-existence/ownership check §16.1); policy engine served to **Codex hooks** (`PreToolUse`/`PermissionRequest`); approvals bound to command hash with expiry (desktop/CLI + reused Telegram).
3. **Codex Runtime**: session via official SDK / `codex exec --json`; sandbox flags mapped from intent boundary; event + token capture; session-ID preservation; Builder + independent Verifier (fresh session); Model Director as recorded tier/effort plan per phase.
4. **Verification**: PatchPilot core — target repo's own test suite via validation runner, OSV + Gitleaks + Semgrep, secret scan; finding → Codex remediation → rerun (already working).
5. **Evidence Gate**: criterion→evidence table; completion gate (UNKNOWN blocks); waivers; mission-level Build Receipt (JSON + Markdown) on the existing hash chain; requested/approved/applied/observed permission quad.
6. **Runway (reduced)**: token-actuals ledger from `--json`; verification reserve; loop-signature detector; capacity snapshot with source+confidence labels; post-limit resume plan (§16.2).
7. **Replay Lab (reduced)**: 3 deterministic scenarios — wrong-identity block, approval-binding violation, missing-evidence completion block.

**Cut entirely for Build Week:** desktop app (use the web dashboard), browser verification, maintainability guard, capability discovery generalization, worktree/port coordination, continuity/model-transition machinery, instruction-compilation NLP, multi-provider anything, Claude portability, 11 of 14 quota scenarios, 9 of 12 replay scenarios.

**Immediate mechanics:** `git init` + baseline commit today; request the $100 credits before **July 17, 12:00 PT**; all building through Codex with the primary thread preserved for `/feedback`.

---

## 19. Recommended Demo Mission

**Mission:** "Add brute-force lockout to the login endpoint of `zkauth-demo` (sanitized fixture derived from the existing local zkauth projects), with regression safety, no new vulnerable dependencies, and a preview deploy to the correct account."

Under-3-minute cut (all LIVE except one labeled REPLAY):

1. **0:00–0:20** — The problem, told with the real incident: "This spring an AI agent invented a repo ID and deployed a stranger's code to a customer's server. Codex is brilliant; it just carries no proof and no ID card."
2. **0:20–0:45** — `axiomgate mission create`: contract with 4 criteria, MODIFY_LOCAL→PUBLISH boundary, model plan (Luna scout / Sol high-effort build / Terra remediation) — the GPT-5.6 beat.
3. **0:45–1:10** — **The moment:** Codex attempts `preview.deploy`; Environment Guard blocks it — Vercel project belongs to the wrong team (staged second profile). Hook denial shown live, recorded as evidence. Re-target, approve once on Telegram, deploy proceeds.
4. **1:10–1:50** — Codex builds; PatchPilot verification runs the real test suite + scanners; one genuine finding; Codex remediates; rerun passes — the Codex-depth beat.
5. **1:50–2:20** — Evidence Gate: criterion table fills from machine evidence; one criterion deliberately left UNKNOWN to show completion *blocked* until waived with a visible reason — the honesty beat.
6. **2:20–2:50** — Build Receipt: commit, identities, approvals with bound commands, token actuals vs. plan, evidence hashes. "Codex did the work. AxiomGate carries the proof."

---

## 20. Fatal Risks

1. **Deadline overrun** — 7 days, solo, with a blueprint this heavy. Mitigation: §18 scope, nothing else. (Highest probability.)
2. **Hook semantics surprise** — if Codex hooks fail open on error, or `PermissionRequest` doesn't expose full command/args on the installed version, enforcement claims collapse. Verify on day 1 before anything else. (Unverified assumption; flagged.)
3. **Windows demo fragility** — Semgrep needs WSL; process/port handling differs; the judge path promises Windows support (`docs/14`). Test the clean-machine path early, not in Phase 7.
4. **Quota-data embarrassment** — showing a quota number that the ChatGPT dashboard contradicts (#30041) during judging. Mitigation: source+confidence labels always visible; never show unlabeled numbers.
5. **Pre-existing-work misattribution** — judges discovering PatchPilot's May git history behind features implied as new. Mitigation: `HACKATHON_DELTA.md` scrupulous, demo narration says "our existing PatchPilot engine" out loud.
6. **Governance-theatre spot-check** — a judge clicks one evidence link and finds prose instead of machine output. Mitigation: the `source` field ban on model-originated evidence, enforced in schema.
7. **/feedback session loss** — core functionality built across scattered threads leaves no representative primary session. Mitigation: designate the primary thread on day 1.
8. **The 403 problem in reverse** — submission claims about GPT-5.6 tier behavior not matching reality (my own tier-pricing facts are press-sourced). Verify tier/effort selection in the actual product before claiming it in the video.

---

## 21. Changes Required Before Implementation

Priority order:

1. `git init`, commit the blueprint as baseline, record the commit hash in a new `HACKATHON_DELTA.md` stub. (30 min, unblocks everything compliance-related.)
2. Verify Codex hook + SDK behavior empirically on the installed version: `PermissionRequest` payload contents, deny semantics, fail-open/closed, `exec --json` usage fields. Record in `docs/17` compatibility matrix with version numbers. (Half day; gates the whole architecture.)
3. Correct the PatchPilot factual model in the nine locations listed in §17.1, and rewrite `docs/09` around the real web/worker/core monorepo.
4. Rewrite `docs/05`/`docs/06` enforcement sections around hooks + sandbox profiles + App Server/SDK; add the missing failure states (hook unavailable → mission refuses to start).
5. Cut `tasks/TASKS.md` to the §18 slice (~25 tasks); mark everything else `[~]` deferred. Delete browser/maintainability claims from `MASTER_BUILD_CONTRACT.md`'s required mission and `docs/07`.
6. Add concrete JSON schemas for Mission Contract, Action Request, Approval, Evidence, Receipt to `docs/02`.
7. Request Build Week credits (before Jul 17 12:00 PT) and confirm plan tier / model access for the demo account.
8. Reduce Runway tasks to ledger + reserve + loop + labeled snapshot + resume plan; delete the 14-scenario matrix from `docs/11`'s required scenarios (keep 5).
9. Choose the fixture demo repo (sanitized zkauth derivative) and freeze the demo mission of §19.
10. Decide UI naming (Plan/Guard/Run/Verify/Prove) and collapse the noun count in `docs/13`.

---

## 22. Final Scorecard

| Dimension | Score /10 | Note |
|---|---|---|
| Problem importance | 8 | Real, incident-backed (S9–S11), growing with agent autonomy |
| Combined originality | 7.5 | The contract→enforcement→evidence chain for coding missions is unshipped elsewhere |
| Individual-feature originality | 4 | Approvals, receipts, scanners, quota meters all exist separately (S7, S12, S13) |
| Technical depth | 7 | High if hook/SDK-native; the blueprint currently doesn't reach for it |
| Codex relevance | 8.5 | After changes: hooks + SDK + exec --json + tiered GPT-5.6 + Codex remediation |
| Feasibility (7 days, as written) | 2 | Not credible |
| Feasibility (recommended slice) | 7 | ~40% pre-built and live-verified in PatchPilot |
| Product coherence | 6 | Strong spine, noun sprawl; fixable |
| User experience | 5.5 | Setup/approval-fatigue risks unaddressed; demo UX is well-planned |
| Security credibility | 7 | Deterministic identity/authority checks are real; some listed controls are theatre until wired |
| Evidence credibility | 7.5 | Hash-chained, machine-sourced receipts already exist to build on |
| Demo potential | 8 | The wrong-target block + blocked completion are genuinely strong moments |
| Long-term value | 6.5 | Durable thesis, but OpenAI absorbs adjacent features quarterly |
| **Overall idea** | **7** | Build the slice, not the blueprint |

---

## 23. Final Verdict

`REDUCE SCOPE BEFORE BUILDING`

The thesis — bounded authority, verified identity, evidence-gated completion for Codex missions — is correct, timely, incident-validated, and well-matched to the judging rubric. The blueprint wrapped around it is not buildable in the seven days remaining, contains a false model of its own foundation (a PatchPilot desktop app that does not exist), and omits the one mechanism (Codex hooks + App Server/SDK) that turns its governance claims from prose into enforcement. Cut to the single vertical mission in §18, built hook-native on the real PatchPilot engine, re-enact the documented wrong-target incident in the demo, and this is a genuine contender. Build the blueprint as written and it will be an unfinished essay about safety.
