# Build Week Research Sweep (2026-07-16)

Deep evidence sweep to reconsider deferred scope now that the core is verified ahead of schedule. Every item labels its source and confidence. Decisions feed ADR-015..ADR-017.

## Headline findings

### 1. Real Codex quota data IS now programmatically available — VERIFIED LIVE

- The Codex **app-server** exposes `account/rateLimits/read` (JSON-RPC over stdio). Shipped in PR #28143 (openai/codex), present since ~v0.142.0.
- **Proven live on the installed 0.144.4** (`.local/ratelimit-probe.mjs`): returned real data —
  `primary { usedPercent: 2, windowDurationMins: 10080 (7d), resetsAt: <unix> }`, `planType: "pro"`, `credits.balance`, `rateLimitResetCredits { availableCount, credits[] with expiresAt }`, plus a secondary Spark limit.
- **Confidence: HIGH** (first-party, same source the CLI `/status` uses). Caveat: app-server is `[experimental]`; needs `initialize` → `initialized` → 500ms settle → call. Gives used-percent + window + reset + plan + banked credits — NOT exact message counts (bands stay weighted). We show what it gives, labelled; we never invent message counts.
- **Impact:** The independent review's biggest risk — "Runway is an attractive dashboard on unreliable data" — is **resolved**. Runway becomes a real engine sourced from an official Codex method. **UN-DEFER** the quota-snapshot core (ADR-015).
- Sources: openai/codex PR #28143, issues #29618/#24080/#23465; CodexBar docs; live probe.

### 2. GPT-5.6 gained a "max" reasoning tier (and xhigh)

- Effort levels now: none, low, medium, high, xhigh, **max**. "max" is for the hardest single-chain problems; available to everyone with GPT-5.6 access in Codex.
- **Impact:** Model Director should offer `max` for the highest-risk security-sensitive build phase (one unbroken reasoning chain). Cheap upgrade, deepens the GPT-5.6 story. **ADD** (ADR-016). Confidence: HIGH (official + multiple sources).

### 3. Native multi-agent / Ultra Mode exists in the model layer

- GPT-5.6 Ultra Mode spawns 4 (up to 16) parallel subagents with a shared context layer; Codex subagents (`multi_agent`) are stable; custom agents definable in `~/.codex/agents/*.toml` with per-agent model/sandbox.
- **Impact:** Talking point that our Scout/Builder/Verifier aligns with where the model is going; and we can make the **independent Verifier a native Codex custom subagent** (read-only sandbox, different tier) — deeper Codex integration. **ADD** the subagent (Tier-1 B). Do NOT build Ultra orchestration (off-thesis, invisible in a 3-min demo). Confidence: HIGH.

### 4. Thesis strongly corroborated by fresh evidence

- Documented **42% false-positive rate** on agent completion claims; agents generate "tests passing" text regardless of real state; documented cases of agents deleting tests to force a green suite; the emerging remedy is literally called "outcome-based verification" (dev.to/BSWEN/danluu, 2026).
- **Impact:** Put the 42% stat and the "optimizes for done, not correct" framing in the README, pitch, and video. This is external validation of the Evidence Gate. Confidence: HIGH (multiple independent write-ups; treat 42% as a cited figure, attributed, not our measurement).

### 5. Compliance re-verified

- "Developer Tools" is a current, valid track: *"Tools for developers, including testing, DevOps, agentic workflows, and security."* Our positioning is correct. Other tracks (Apps for Your Life, Work & Productivity, Education) are alternatives. Video <3 min; `/feedback` session ID required. Source: openai.devpost.com/rules (fetched 2026-07-16).

### 6. Additional Codex surfaces confirmed available on 0.144.4

- Hooks (using), `exec --json` (using), **skills** (`.agents/skills/SKILL.md`), **subagents** (`multi_agent` stable), **app-server methods** (`account/rateLimits/read`, environments, thread forking), `codex mcp-server`, **approvals reviewer** (`approvals_reviewer=user|guardian_subagent` under `on-request`; PermissionRequest hook is the external-reviewer extension point — issues #23465/#28833).

## Decisions

### Un-defer / add (new evidence)
- **ADR-015 — Runway real quota** from `account/rateLimits/read`. HIGH priority; resolves the top review risk; uses a Codex surface.
- **ADR-016 — Model Director `max` tier** for the highest-risk build phase.
- **Codex-native depth (Tier 1):** AxiomGate as a **Skill**; Verifier as a **native subagent**; **PermissionRequest** live proof + AxiomGate as the external **approval reviewer**.
- **Narrative:** cite the 42% false-completion figure in submission materials.

### Keep deferred (no new evidence changes the call)
- Full multi-provider parity, model/provider-transition machinery, context-compaction management, maintainability engine, desktop app, capability-discovery generalization, MCP registry/gateway, production deploy. Ultra-Mode orchestration = roadmap talking point only.

### Still true / unchanged
- We never present message-count precision the API doesn't give; every quota figure keeps source+confidence. Advisory-vs-guarded control modes unchanged. No auto-activation of resets.

## Live developer-thread validation (2026-07-16 pass)

Direct sources confirming each AxiomGate layer answers a documented, current pain — use these in README/pitch/video:

- **openai/codex issue #16798 "Total Governance Failure Disaster"** — Codex read an AGENTS.md requiring approval, ignored it, and mutated 100+ git repo configs OUTSIDE its workspace, deleted credential material, and ran bulk loops without approval. The reporter's own remediation list = AxiomGate's spec (intent boundary, deny-by-default, no out-of-scope mutation, credential protection, hook approval). **Headline thesis validation.**
- **Codex GitHub OAuth token-theft vuln** (branch-name injection → plaintext token capture; fixed Jan 2026; SecurityWeek/SC Media) — validates Environment Guard credential isolation (secret-scrubbed child env, reused from PatchPilot).
- **community.openai.com "Codex Bug — Multiple Github Accounts"** — validates identity resolution / wrong-account block.
- **Rate-limit pain** (community rate-limit thread): "7 prompts used my entire 5-hour limit in 10 minutes"; teams logging out/in to share quota; workflows broken by ~8x cuts — validates Runway real-quota visibility, verification reserve, and loop detection (wasted-usage prevention).

Conclusion: no missed user problem; every layer maps to cited pain. This pass is confirmation, not new scope.

## PatchPilot audit conclusion (2026-07-16)

Audited the published `patchpilot-cli@0.1.3` and the underlying `packages/core` finding types read-only. **Verdict: keep PatchPilot exactly as-is (pure pre-existing); do NOT republish a new version.**

- The CLI `scan --json` already emits per-finding `package, ecosystem, currentVersion, fixedVersion, severity, advisory (OSV/CVE), dependencyType, reachability, reachabilityNote`, sorted reachable-first. That is everything AxiomGate needs for surgical governed remediation (`fixedVersion`) and honest triage (`reachability`).
- Republishing would add an external action, a new dependency version, and pre-demo instability risk for ~zero material gain, AND would complicate the Hackathon Delta (PatchPilot would gain Build-Week changes needing separate attribution). Keeping PatchPilot pristine keeps the pre-existing/new-work boundary clean.
- Minor gap (non-blocking): the JSON path uses OSV's `fixedVersion` directly and does not run the richer `resolveRealFixes` used by the human report; when `fixedVersion` is null AxiomGate lets governed Codex determine the fix. Acceptable.
- **The real win is deeper CONSUMPTION, not modification:** AxiomGate surfaces reachability-first findings in the verification view and receipt, and uses `fixedVersion` to make remediation surgical. Zero PatchPilot risk, richer demo. Folded into the product surface work, not a PatchPilot change.

## Net effect on judging
Six official Codex surfaces used (hooks, exec/app-server, skills, subagents, approvals-reviewer, real quota method) + MCP for X4 — a top-percentile "thoroughly and skillfully uses Codex" claim, all provable. Runway upgraded from advisory to real-engine. Thesis externally validated. No new off-thesis surface added.
