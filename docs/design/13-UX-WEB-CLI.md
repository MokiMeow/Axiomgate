# Web Dashboard and CLI Experience

For Build Week the product surface is a **local web dashboard** (extending the existing PatchPilot Next.js app) plus a CLI. There is no desktop (Electron/Tauri) app - ADR-009. "Desktop" below means the local web dashboard.

## Product experience

The UI should make the mission lifecycle obvious. User-facing stage names are plain verbs; internal layer names stay in code and docs:

```text
Plan → Guard → Run → Verify → Prove
(Draft → Planned → Authorized → Running → Verifying → Awaiting Approval → Completed)
```

Do not surface the internal vocabulary (Mission Compiler, Runway, Environment Guard, Evidence Gate, Proof Graph, Human Review Map, Model Director) as primary UI labels - eleven proper nouns is a comprehension tax. One mission timeline, five stages.

## First-run rule

`axiomgate mission create` must work with a one-line objective and safe defaults: auto-detected identity, standard policy template, `MODIFY_LOCAL` boundary. The full contract editor is optional. Target: first governed mission in under 3 minutes from install. A normal mission must generate **at most 3 approval prompts**; if policy defaults produce more, fix the defaults, not the user.

## Primary dashboard screens

### Dashboard

- active missions;
- blocked actions;
- expiring capacity;
- pending approvals;
- recent receipts.

### New mission

- project;
- objective;
- authority;
- budget policy;
- model preference;
- evidence level.

### Mission detail

- timeline;
- contract;
- Runway;
- environment and action policy;
- Codex execution;
- PatchPilot verification;
- proof graph;
- approvals;
- receipt.

### Environment Guard

Show the concrete safety state, not a tool marketplace:

- local project and Git remote;
- GitHub and Vercel identities;
- target environment and branch;
- credential handles without secret values;
- semantic actions allowed, denied, or approval-gated;
- mechanism selected for each action;
- capability trust warnings;
- requested, approved, applied, and observed permissions;
- blocked mismatches.

Do not add skill-installation, MCP-registry, deduplication, or plugin-management screens to the Build Week core.

### Settings

- Codex/runtime configuration (Build Week; generic multi-provider settings: post-hackathon);
- approval channels;
- privacy;
- local storage;
- limits;
- notification preferences.

## UX requirements

- clear distinction between fact, estimate, and recommendation;
- source/confidence for quota;
- no dark patterns encouraging credit use;
- no automatic reset activation;
- visible production danger state;
- keyboard-accessible controls;
- readable error recovery;
- no fake progress animations;
- direct evidence links;
- semantic approval summaries before raw commands;
- visible mission ownership for every background process.

## CLI

Core commands (Build Week):

```text
axiomgate doctor
axiomgate mission create
axiomgate mission run
axiomgate mission resume
axiomgate mission verify
axiomgate mission receipt
axiomgate receipt verify <file>    # judge-facing: verifies receipt hash chain integrity
axiomgate replay <scenario>
```

Deferred: `mission plan`, `runway status`, `environment inspect`, `policy explain`, `project link` as separate commands (their content appears inside `mission create/run` output).

CLI and dashboard must call the same application services.

`axiomgate receipt verify` is deliberately public-facing: a judge can paste a Build Receipt JSON and verify its evidence hash chain in one command without any account or setup. Evidence you can check beats evidence you must trust.

## Telegram

Use for concise, evidence-aware approvals and alerts. Do not attempt to reproduce the full dashboard.
