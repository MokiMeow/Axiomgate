# Web Dashboard and CLI Experience

The shipped product surface is the bundled CLI/MCP server plus a **zero-dependency local web dashboard** served by `apps/web/server.mjs`. The dashboard is AxiomGate code, binds to loopback, and reads one governed workspace. A fresh clone has an empty state; the curated synthetic SAMPLE mission is loaded only with `AXIOMGATE_DEMO=true`. Real mission data always wins and is shown without a demo banner. It does not embed PatchPilot's Next.js application. There is no desktop Electron/Tauri app.

The Vercel-hosted surface serves the same static landing page and dashboard with read-only serverless endpoints. It always returns the curated SAMPLE mission and SAMPLE capacity, never a live-account claim. Hosted approvals are disabled because canonical approval mutation requires the loopback local server and governed workspace.

## Product experience

The UI should make the mission lifecycle obvious. User-facing stage names are plain verbs; internal layer names stay in code and docs:

```text
Plan → Guard → Run → Verify → Prove
(Draft → Planned → Authorized → Running → Verifying → Awaiting Approval → Completed)
```

Do not surface the internal vocabulary (Mission Compiler, Runway, Environment Guard, Evidence Gate, Proof Graph, Human Review Map, Model Director) as primary UI labels - eleven proper nouns is a comprehension tax. One mission timeline, five stages.

## First-run rule

`axiomgate mission create` must work with a one-line objective and safe defaults: auto-detected identity, standard policy template, `MODIFY_LOCAL` boundary. The full contract editor is optional. Target: first governed mission in under 3 minutes from install. A normal mission must generate **at most 3 approval prompts**; if policy defaults produce more, fix the defaults, not the user.

## Shipped dashboard panels

### Mission view

- timeline;
- contract;
- Runway;
- environment and action policy;
- Codex execution;
- PatchPilot verification;
- proof graph;
- approvals;
- receipt.

Mission creation and execution remain CLI workflows. The dashboard is a focused inspection and loopback approval surface, not a general project manager.

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

No settings screen is shipped. Codex/runtime options, Runway manual fallback, Telegram environment configuration, and privacy controls are explicit CLI/environment inputs. A generic provider settings UI is post-hackathon.

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
axiomgate install-codex [--dry-run]
axiomgate mcp
axiomgate verify-enforcement [--offline]
axiomgate runway status
axiomgate runway set
axiomgate mission create|update|run|resume|review|verify|remediate|status|waive|receipt
axiomgate approvals list
axiomgate approve <id>
axiomgate deny <id>
axiomgate receipt verify <file>
axiomgate replay <scenario>
axiomgate telegram test|watch
```

Not shipped as separate commands: `mission plan`, `environment inspect`, `policy explain`, and `project link`. Their relevant state appears in mission creation, run, status, doctor, or dashboard output.

CLI and dashboard must call the same application services.

`axiomgate receipt verify` is deliberately public-facing: a judge can paste a Build Receipt JSON and verify its evidence hash chain in one command without any account or setup. Evidence you can check beats evidence you must trust.

## Telegram

Use for concise, evidence-aware approvals and alerts. Do not attempt to reproduce the full dashboard. Chat IDs are always allowlisted. When `TELEGRAM_USER_ID` is absent, approval callbacks are accepted only from an allowlisted private one-to-one chat. Group and supergroup use requires an explicit matching user-ID allowlist, so seeing a card does not grant decision authority. Approval records retain only a masked actor ID and chat type. Stage notifications send the mission objective, workspace label, action, target, and a best-effort redacted command to Telegram, so this project metadata leaves the local machine.
