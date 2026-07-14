# AxiomGate Master Build Contract

## Purpose

This is the authoritative implementation contract. It consolidates product scope, engineering standards, task governance, testing, security, documentation, and hackathon requirements.

If another document conflicts with this file, stop, record the conflict in `docs/18-DECISION-LOG.md`, and resolve it explicitly. Do not silently choose whichever instruction is easier.

## Product thesis

Coding agents can generate code, but developers still lack a reliable layer that controls:

- what the agent is trying to accomplish;
- what evidence defines completion;
- which model and reasoning effort should be used;
- how quota, API cost, temporary resets, and context are managed;
- which instructions, commands, tools, APIs, credentials, repositories, and environments the agent may access;
- whether the agent may observe, modify, publish, or deploy;
- whether the implementation is secure, maintainable, tested, and truly complete;
- how a human reviews and approves consequential actions.

AxiomGate is that layer.

## Product boundary

AxiomGate is not:

- another general-purpose IDE;
- another chat interface;
- a replacement coding model;
- a universal marketplace;
- a promise of perfect token prediction;
- a claim of full production support for every provider;
- a universal skill installer, plugin marketplace, MCP manager, or configuration synchronizer;
- a replacement for native capability discovery or lazy loading;
- a wrapper that merely launches several agents;
- a dashboard that trusts model self-reporting.

## Primary user

A developer or small team who:

- works across several repositories and deployment accounts;
- uses Codex for long-running tasks;
- cares about usage, credits, and expiring capacity;
- wants safe approvals away from the laptop;
- needs trustworthy verification;
- may use Claude or another agent as a secondary reviewer;
- wants local-first control and clear auditability.

## Required vertical mission

The complete product must demonstrate one real mission:

> Add or materially improve a security-sensitive feature in an existing application, preserve existing behavior, verify unit/integration/security requirements, open a pull request, deploy a preview to the correct account, and produce a verifiable Build Receipt.

The exact feature may change after repository audit. The mission must remain understandable, non-trivial, and reproducible.

Browser verification is a stretch goal (one scripted Playwright check against the demo fixture app), attempted only after the core mission passes end to end. It is never silently claimed: if it is not built, the receipt marks browser evidence `UNKNOWN`.

## Six product layers

### 1. Mission Compiler

Responsibilities:

- parse the user objective;
- bind the target repository and environment;
- read only the explicitly configured project policy and detect one direct conflict relevant to the mission (full instruction compilation: post-hackathon);
- define acceptance criteria;
- define constraints and non-goals;
- define required evidence;
- define the initial intent boundary;
- detect instruction conflicts;
- freeze a mission contract version and hash.

### 2. Runway

Build Week responsibilities:

- record per-mission token/reasoning actuals from `codex exec --json` in an actual-versus-estimated ledger;
- reserve capacity for verification and emergency repair;
- recommend phase-specific GPT-5.6 tiers and reasoning effort with recorded rationale;
- detect loops (repeated failure signatures) and recommend pause;
- maintain one source/confidence-labelled capacity snapshot with expiring-reset reminders;
- checkpoint and resume a mission interrupted by a rate limit;
- never activate paid capacity, resets, model switches, or waits without user authorization.

Post-hackathon (see "Post-hackathon scope"): full multi-source quota normalization, context-pressure management, and model/provider/session transition management.

### 3. Environment Guard

Responsibilities:

- enforce policy through official Codex extension points — hooks (`PreToolUse`, `PermissionRequest`, `PostToolUse`; deny-wins; exit-code and JSON-decision blocking) plus sandbox and permission-profile configuration — never through prompt-level requests alone;
- refuse to start a mission when the enforcement configuration cannot be verified (fail closed);
- inspect only the execution mechanisms required by the demo action set (general capability discovery: post-hackathon);
- verify that every publish or deploy target exists and is owned by the profile's account before the action executes (GitHub/Vercel API resolution);
- normalize those mechanisms into semantic actions such as read repository, create branch, open pull request, deploy preview, or access a database;
- evaluate mission relevance, trust, required identity, data access, side effects, rollback, and risk;
- create a mission-specific allow, deny, and approval-required policy without relocating or reinstalling capability packages;
- reuse PatchPilot's existing prompt-injection checks on untrusted content where applicable (full trust/risk static analysis: post-hackathon; MCP tool-description scanning: stretch X5);
- resolve local path, Git remote, GitHub identity, Vercel target, environment, and branch;
- hold credentials outside model-visible context;
- enforce intent boundaries, semantic approvals, and effective-permission reconciliation;
- record which capability mechanism performed each consequential action.

### 4. Codex Runtime

Responsibilities:

- make Codex the primary implementation engine;
- integrate through official Codex interfaces: the App Server JSON-RPC protocol / TypeScript SDK for session control, `codex exec --json` for event and token capture, and `--output-schema` for structured results;
- map the mission intent boundary to concrete sandbox and permission-profile flags;
- use a Builder for implementation and an independent Verifier (fresh session, no builder-context inheritance) for challenge and review; Scout is stretch-only;
- maintain canonical mission state outside the raw chat transcript, with stop/resume;
- avoid agent multiplication without measurable value.

Post-hackathon: custom worktree/branch/port/process leasing (native Codex worktrees suffice for one mission) and pre-compaction/provider-transition checkpoint machinery.

### 5. Verification Engine

Responsibilities:

- integrate the existing PatchPilot engine (a pnpm monorepo: Next.js web dashboard, worker, published CLI, MCP server, and `packages/core` scanners/remediation/receipts — there is no PatchPilot desktop app);
- run the target repository's own test suite (targeted and full) via the validation runner;
- scan dependencies and secrets (OSV, Trivy, Gitleaks) and run SAST (Semgrep);
- perform authorization negative tests from the mission policy;
- flag risky diffs (size/path heuristic);
- remediate validated failures via Codex and rerun affected checks;
- record evidence from systems, not model claims.

Stretch-only: one scripted Playwright browser check on the demo fixture. Post-hackathon: general browser/e2e orchestration, console/network capture, and maintainability/duplication/complexity analysis. None of these may be silently claimed; absent evidence is marked `UNKNOWN`.

### 6. Evidence Gate

Responsibilities:

- map every acceptance criterion to evidence;
- distinguish verified, failed, blocked, waived, and unknown;
- generate a risk-based Human Review Map;
- request semantic approval for consequential actions;
- support GUI, CLI, and Telegram approval surfaces;
- verify requested, approved, applied, and observed permissions;
- prevent false completion;
- emit JSON and Markdown Build Receipts (HTML: post-hackathon).

## Post-hackathon scope

The following are documented intent, **not** Build Week requirements. An implementation agent must not build them during Build Week (ADR-008): full multi-source quota normalization (weekly/rolling/promotional/team-pool/multi-provider matrices), context-pressure and compaction management, model/provider transition safety and handoff packs, custom worktree/branch/port/process leasing, general browser/e2e orchestration, console/network failure capture, maintainability/duplication/complexity engines, instruction-compilation NLP breadth, capability-discovery generalization, non-Codex provider adapters, and Claude portability proofs.

## System-wide invariants

1. **No invisible authority escalation.**
2. **No raw credential exposure to models.**
3. **No unlabelled mock behavior.**
4. **No unsupported certainty.**
5. **No completion without fresh evidence.**
6. **No external mutation without the proper intent boundary.**
7. **No direct production action in the hackathon demo.**
8. **No destructive migration without backup and rollback.**
9. **No feature status based only on a model statement.**
10. **No committed private test data.**
11. **No broad cleanup mixed into unrelated feature commits.**
12. **No duplicate architecture when existing PatchPilot or native provider functionality can be reused cleanly.**
13. **No capability installation, relocation, or configuration mutation merely to make the architecture look universal.**

## Intent boundary

Every mission is assigned one maximum action mode:

1. `OBSERVE`
2. `PLAN`
3. `MODIFY_LOCAL`
4. `PUBLISH`
5. `DEPLOY_PREVIEW`
6. `DEPLOY_PRODUCTION`

The runtime may operate below this level but may never cross it without a new explicit authorization event.

## Data truth hierarchy

Prefer evidence in this order:

1. provider/runtime API;
2. local process and filesystem state;
3. Git state;
4. test runner output;
5. deployment API;
6. signed approval record;
7. official CLI output;
8. user-authorized dashboard observation;
9. user-entered data;
10. historical estimate;
11. model inference.

Every derived claim must retain its source and confidence.

## Engineering quality contract

All production code must be:

- typed;
- formatted;
- linted;
- documented where behavior is non-obvious;
- modular without unnecessary abstraction;
- tested at the correct level;
- performance-conscious;
- secure by default;
- deterministic where possible;
- compatible with the existing repository style;
- free from placeholder implementations and dead branches.

Never add a dependency for functionality available reliably in the standard library or existing stack without a written reason.

## Testing contract

A feature requires, as applicable:

- unit tests;
- contract/schema tests;
- integration tests;
- end-to-end tests;
- negative and permission tests;
- migration tests;
- recovery tests;
- deterministic replay tests;
- performance benchmarks;
- security tests;
- manual exploratory evidence for UI behavior.

A passing test is not enough if it tests a mock rather than the real boundary under claim.

## Documentation contract

For every behavior change:

- update architecture if boundaries changed;
- update the relevant subsystem document;
- update task status;
- update tests and evidence;
- update README only for verified user-facing behavior;
- add an ADR for irreversible or cross-cutting decisions;
- update changelog;
- document known limitations.

## Commit contract

Commits must be:

- atomic;
- scoped;
- truthful;
- tested before commit;
- free of generated junk and secrets;
- reversible where practical.

Recommended format:

```text
type(scope): concise outcome

Why:
- reason

Verified:
- command and result
```

Do not create “final”, “misc”, “fix stuff”, “complete everything”, or misleading commits.

## Hackathon truth contract

- Clearly identify pre-existing PatchPilot work.
- Record the Build Week commit range.
- Preserve the primary Codex `/feedback` session ID.
- Explain how Codex and GPT-5.6 were used.
- Never imply a replay fixture is a live model execution.
- Provide a judge-ready deterministic demo.
- Provide setup, supported platform, and test instructions.
- Publish the demo publicly on YouTube, keep it less than three minutes, and include accurate audio covering the project, Codex, and GPT-5.6.
- Preserve private data locally and publish only sanitized evidence.
- Complete `docs/26-OFFICIAL-RULES-COMPLIANCE.md`; when sources conflict, the Official Rules and current Devpost website prevail.
- Use a relevant license for a public repository, or share a private repository with both official judging addresses.

## Completion

AxiomGate is submission-ready only when the final acceptance checklist in `tasks/PHASE-8-HACKATHON.md` and `docs/23-DEFINITION-OF-DONE.md` passes with linked evidence.
