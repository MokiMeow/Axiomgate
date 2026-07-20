# AxiomGate Dashboard

A local dashboard for AxiomGate missions. It uses Node's HTTP server plus the workspace's canonical `@axiomgate/core` approval store and reads mission state directly from a governed workspace's `.axiomgate/` directory. A fresh clone remains empty unless demo mode is explicitly enabled.

## Run

```bash
# against a governed workspace
node apps/web/server.mjs --workspace /path/to/governed/project

# or via env var
AXIOMGATE_WORKSPACE=/path/to/project node apps/web/server.mjs

# default: current directory, port 4319
node apps/web/server.mjs

# explicit curated SAMPLE data, never a live-account claim
AXIOMGATE_DEMO=true node apps/web/server.mjs
```

Open `http://localhost:4319`.

## What it shows

- **Mission spine** - the five governed stages: Plan to Guard to Run to Verify to Prove.
- **The block moment** - actions denied at the Codex hook, with the exact command and reason (identity / ownership / policy).
- **Model plan** - per-phase GPT-5.6 tier and reasoning effort.
- **Token ledger** - real Codex usage from the mission ledger; Builder / Verifier sessions.
- **Proof table** - each acceptance criterion, verdict, and the machine evidence backing it. Model-sourced "evidence" is flagged inadmissible.
- **Completion gate** - COMPLETE only when every required criterion is PASS or WAIVED.
- **Build Receipt** - contract hash, commit, evidence chain head, and an in-page verify readout (the authoritative check is the CLI `axiomgate receipt verify`).
- **Web approval** - approve or deny a pending action from the same machine through the loopback-only dashboard. Telegram is the supported remote phone channel.
- **Live capacity** - real weekly usage and plan from the Codex app-server, top-right.
- **Workspace views** - Mission Control, Approval Queue, Blast Radius, Audit Receipts, Runway, and Settings share the same canonical API records.
- **Live refresh** - local mission and approval state refreshes without flicker; capacity refreshes separately at a lower rate.

## Design

Same visual family as PatchPilot Watch Commander (dark editorial theme): warm near-black canvas, hairline-only depth, editorial display type (weight 400, negative tracking), Inter for interface, JetBrains Mono on every data surface, and a single Cursor-Orange accent used sparingly. Verdict color system: green = verified/allow, red = deny/blocked, amber = pending/unknown.

## Notes

- The dashboard is read-only over mission state except the web-approval endpoint, which mutates the same exact-hash, expiring, single-use approval record used by the CLI; the hook remains the enforcement point.
- `LIVE` / `REPLAY` / `SAMPLE` labels are always shown so replayed or sample data is never presented as a live run.

## Vercel hosted demo

The root `vercel.json` publishes `apps/web/public` and the read-only functions in `api/`. The hosted API returns eight curated synthetic missions spanning complete, blocked, denied, remediated, waived, and awaiting-approval states, plus SAMPLE capacity. It does not read a Vercel account, a Codex account, or a governed workspace. Hosted approval requests return a friendly local-only response and never write serverless state.

Public demo: [axiomgate-eta.vercel.app](https://axiomgate-eta.vercel.app/)

From the repository root, the user deploys with their own Vercel account:

```powershell
vercel env add AXIOMGATE_DEMO production
# Enter true when prompted.
vercel --prod
```

For a one-command deployment with the same runtime environment value:

```powershell
vercel --prod -e AXIOMGATE_DEMO=true
```

Node.js is pinned to `24.x` through the root package manifest. The local hosting harness is credential-free:

```powershell
node apps/web/hosting/verify.mjs
```
