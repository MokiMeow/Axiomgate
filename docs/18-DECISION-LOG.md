# Decision Log

Use this file for concise decisions. Create individual ADR files if the repository grows.

## Decision format

```text
ID:
Date:
Status: Proposed | Accepted | Superseded
Context:
Decision:
Alternatives:
Consequences:
Evidence:
```

## Initial decisions

### ADR-001 — Six product layers

**Status:** Accepted

Use Mission Compiler, Runway, Environment Guard, Codex Runtime, Verification Engine, and Evidence Gate. Earlier feature names become internal functions or views.

### ADR-002 — Codex-first

**Status:** Accepted

Codex receives full implementation. Other tools may support planning or independent review. Do not claim equal support for every provider.

### ADR-003 — PatchPilot integration

**Status:** Accepted

PatchPilot becomes the Verification Engine foundation inside the product flow. Preserve and identify pre-existing work. (Surface clarified by ADR-009: local web dashboard, not a desktop app.)

### ADR-004 — Capability policy, not capability management

**Date:** 2026-07-14

**Status:** Accepted

AxiomGate will not build a universal skill installer, shared-folder migration system, MCP registry, MCP gateway, plugin converter, or cross-agent configuration synchronizer for Build Week.

Environment Guard discovers mechanisms already available, maps them to semantic actions, evaluates trust and authority, compiles mission allow/deny/approval policy, verifies target and identity, and records actual use.

**Consequences:**

- stronger product coherence;
- less duplicate work with native ecosystems;
- lower implementation risk;
- protocol-independent governance;
- no skill/MCP management UI or migration tasks in the core scope.

### ADR-005 — Evidence-derived receipts

**Status:** Accepted

Build Receipts are generated from runtime and verification records, never from model prose.

### ADR-006 — No production demo mutation

**Status:** Accepted

The hackathon flow stops at PR and preview deployment.

### ADR-007 — Hook-native enforcement

**Date:** 2026-07-14 · **Status:** Accepted

Environment Guard enforces policy through official Codex hooks (`PreToolUse`/`PermissionRequest`, deny-wins), sandbox/permission-profile mapping, and the App Server/SDK for session control. Prompt-level instructions are never the enforcement mechanism. Missions fail closed when hook configuration cannot be verified.

**Evidence:** official Codex hooks and SDK/App Server documentation; independent pre-implementation review.

### ADR-008 — Vertical-slice scope for Build Week

**Date:** 2026-07-14 · **Status:** Accepted

Build the one governed mission end to end (contract → hook-enforced guard → Codex build → PatchPilot verify → receipt). Deferred: desktop app, general browser/e2e orchestration, maintainability engine, capability-discovery generalization, worktree/port coordination, continuity/model-transition machinery, instruction-compilation NLP, multi-provider adapters, cross-provider portability proof, 11 of 14 quota scenarios, 9 of 12 replay scenarios. `tasks/TASKS.md` v3 is the authoritative board; where a phase file lists deferred work, TASKS.md wins.

**Consequences:** a finished, demonstrable product; deferred items remain documented for post-hackathon.

### ADR-009 — Local web dashboard, not a desktop app

**Date:** 2026-07-14 · **Status:** Accepted

The product surface is the CLI plus a local web dashboard extending the existing PatchPilot Next.js app. No Electron/Tauri work during Build Week. Rationale: zero pre-existing desktop code, judge-runnable in one command, PatchPilot views already exist in the web stack.

### ADR-010 — PatchPilot factual model corrected

**Date:** 2026-07-14 · **Status:** Accepted

PatchPilot is a pnpm monorepo web product (`apps/web` Next.js 15, `apps/worker`, `apps/cli`, `apps/mcp`, `packages/core`) built 2026-05-26→31; it has never been a desktop app. All blueprint references corrected. Browser verification and maintainability analysis do **not** exist in PatchPilot and must not be claimed as integration.

**Evidence:** local audit 2026-07-14 (`FEATURE_MATRIX.md`, `packages/core/src`, git log); independent pre-implementation review.

### ADR-011 — Judge-verifiable receipts

**Date:** 2026-07-14 · **Status:** Accepted

Add `axiomgate receipt verify <file>`: verifies the Build Receipt evidence hash chain offline, no account required. Evidence records must carry `source: command|api|hook` — model-originated text is not admissible evidence (schema-enforced).

### ADR-012 — Two review-sourced feature additions

**Date:** 2026-07-14 · **Status:** Accepted

(a) Deploy-target existence/ownership proof before any publish/deploy action (replaces deferred static-analysis ambitions in capability trust checks). (b) Post-limit resume plan: checkpoint + reset visibility + one-command resume (replaces multi-provider capacity normalization). Both fit existing layers and the single demo mission.

### ADR-015 — Runway sources real quota from the Codex app-server

**Date:** 2026-07-16 · **Status:** Accepted

`account/rateLimits/read` (Codex app-server JSON-RPC) is verified live on 0.144.4 and returns real `usedPercent`, window duration, `resetsAt`, `planType`, and banked `rateLimitResetCredits`. Runway's capacity snapshot is upgraded from advisory/manual to this first-party source (labelled `source: "codex-app-server"`, confidence high), feeding the verification reserve and expiring-reset reminder. Un-defers the quota-snapshot core the independent review had parked for "no reliable source." Honest bounds preserved: we surface used-percent/window/reset/credits, never invented message counts; app-server is experimental so the version is recorded and failures degrade to UNKNOWN. Evidence: mid-build research sweep and local app-server probe output.

### ADR-016 — Codex-native depth: max tier, skill, subagent, approval reviewer

**Date:** 2026-07-16 · **Status:** Accepted

Deepen genuine Codex usage across official surfaces: (a) Model Director offers GPT-5.6 `max` reasoning for the highest-risk single-chain build phase; (b) AxiomGate ships as a Codex **skill** (`.agents/skills/`) so governance is a workflow Codex loads natively; (c) the independent Verifier is a native Codex **custom subagent** (`~/.codex/agents/`, read-only sandbox, different tier); (d) complete the live **PermissionRequest** proof with AxiomGate acting as the external approval reviewer Codex defers to. No off-thesis surface added; Ultra-Mode orchestration remains roadmap-only. Evidence: mid-build research sweep.

### ADR-014 — Verification integrates via the published PatchPilot CLI

**Date:** 2026-07-15 · **Status:** Accepted

PatchPilot is a separate pre-existing repository with heavy dependencies (pg, bullmq, openai). Judges clone only AxiomGate, so the Verification Engine integrates by invoking the **published `patchpilot-cli`** (npm, v0.1.3, bin `patchpilot`) via the timeout runner — plus running the target repo's own test/build commands directly. This supersedes the `docs/09` assumption of an in-process typed API over a co-located `packages/core`.

**Consequences:** self-contained for judges (npm resolves the dependency); honest reuse of pre-existing published work (no copy, rewrite, or submodule); clean pre-existing/Build-Week separation for `HACKATHON_DELTA.md`. AxiomGate parses the CLI's JSON output into typed findings; if a needed capability is CLI-only-partial, the target repo's native commands cover the gap. Board task V4 ("PatchPilot regression suite passes") is reinterpreted: PatchPilot is unmodified, so its suite is unaffected; V4 becomes "the published-CLI integration is verified against a real fixture."

### ADR-017 — AxiomGate ships as an MCP server and a Codex plugin

**Date:** 2026-07-16 · **Status:** Accepted

Distribution surfaces, not capability management (no conflict with ADR-004 — we ship OUR tool, we do not manage others'): (a) `axiomgate mcp` — a zero-dependency stdio MCP server exposing governance tools (mission status, receipt verify, runway status, approvals) so any MCP-aware agent can consume governance state; (b) a Codex plugin package bundling the skill, verifier agent, and MCP config, installable via whatever `codex plugin` actually supports on the installed version (verified empirically; no marketplace claim unless the mechanism exists). Also enables the X4 multi-mechanism equivalence test (same semantic action via CLI or MCP → same policy verdict).

### ADR-013 — Ship-during-week distribution

**Date:** 2026-07-14 · **Status:** Accepted

Publish the CLI to npm by Jul 18 and recruit real users during Build Week. Real installs and permissioned user quotes convert projected impact into demonstrated impact for judging. Constraint: `npx axiomgate` must work with zero config (doctor + replay), and reported numbers must be exact, never inflated.
