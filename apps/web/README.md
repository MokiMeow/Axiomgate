# AxiomGate Dashboard

A local dashboard for AxiomGate missions. It uses Node's HTTP server plus the workspace's canonical `@axiomgate/core` approval store, reads mission state directly from a governed workspace's `.axiomgate/` directory, and falls back to a bundled sample mission on a clean clone.

## Run

```bash
# against a governed workspace
node apps/web/server.mjs --workspace /path/to/governed/project

# or via env var
AXIOMGATE_WORKSPACE=/path/to/project node apps/web/server.mjs

# default: current directory, port 4319
node apps/web/server.mjs
```

Open `http://localhost:4319`.

## What it shows

- **Mission spine** - the five governed stages: Plan → Guard → Run → Verify → Prove.
- **The block moment** - actions denied at the Codex hook, with the exact command and reason (identity / ownership / policy).
- **Model plan** - per-phase GPT-5.6 tier and reasoning effort.
- **Token ledger** - real Codex usage from the mission ledger; Builder / Verifier sessions.
- **Proof table** - each acceptance criterion → verdict → the machine evidence backing it. Model-sourced "evidence" is flagged inadmissible.
- **Completion gate** - COMPLETE only when every required criterion is PASS or WAIVED.
- **Build Receipt** - contract hash, commit, evidence chain head, and an in-page verify readout (the authoritative check is the CLI `axiomgate receipt verify`).
- **Web approval** - approve/deny a pending action from any device's browser (the phone channel for a headless runtime).
- **Live capacity** - real weekly usage and plan from the Codex app-server, top-right.

## Design

Same visual family as PatchPilot Watch Commander (dark editorial theme): warm near-black canvas, hairline-only depth, editorial display type (weight 400, negative tracking), Inter for interface, JetBrains Mono on every data surface, and a single Cursor-Orange accent used sparingly. Verdict color system: green = verified/allow, red = deny/blocked, amber = pending/unknown.

## Notes

- The dashboard is read-only over mission state except the web-approval endpoint, which mutates the same exact-hash, expiring, single-use approval record used by the CLI; the hook remains the enforcement point.
- `LIVE` / `REPLAY` / `SAMPLE` labels are always shown so replayed or sample data is never presented as a live run.
