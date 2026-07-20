# Phase 6 - Web Dashboard and CLI

> Historical phase plan. Use [TASKS.md](TASKS.md) and the [implementation status](../engineering/21-IMPLEMENTATION-STATUS.md) for current completion claims.

Historical note: "desktop" in early planning meant the local web dashboard. The shipped dashboard is the zero-dependency loopback server under `apps/web`; no Electron, Tauri, or PatchPilot web code is included.

## Outcome

A coherent, polished product experience around the one mission lifecycle.

## Subtasks

- Dashboard.
- Mission creation/review.
- Mission timeline.
- Runway capacity/model view.
- Environment identity and semantic-action policy view.
- PatchPilot verification view.
- Evidence/approval/receipt view.
- Settings and privacy.
- CLI commands using the same services.
- Loading/error/cancelled/recovery states.
- Keyboard and screen-reader checks.
- Performance profiling.

## Design rule

Do not create a separate dashboard for every internal function. Present the five user-facing stages (Plan → Guard → Run → Verify → Prove) in one mission timeline.

## Exit criteria

A new user can understand the mission, current risk, needed action, and evidence without reading raw logs.
