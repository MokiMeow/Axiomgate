# Phase 0 - Audit and Foundation

## Outcome

A verified map of the existing codebase and a low-risk implementation foundation.

## Work

- Complete `docs/engineering/22-PRE-IMPLEMENTATION-ASSESSMENT.md`.
- Locate all repositories involved, including the PatchPilot monorepo (web/worker/CLI/MCP/core - no desktop app exists).
- Empirically verify Codex hooks, SDK/App Server, and `exec --json` behavior on the installed version; record in `docs/17` (gate for all enforcement claims).
- Record package boundaries, language, framework, build tools, persistence, IPC/API, CI, release, and test commands.
- Identify pre-existing implementation and baseline commit.
- Run existing format/lint/type/test/build/security commands.
- Record failures without hiding them.
- Inventory currently available capability mechanisms, provider integrations, GitHub/Vercel logic, Telegram, and credential handling.
- Map relevant mechanisms to semantic actions; do not install or reorganize them.
- Inspect Git status, large files, dead code, duplicated docs, and secret risk.
- Propose architecture mapping onto the real codebase.
- Create migration/rollback and branch plans.
- Establish public fixture and `.local` directories.

## Required evidence

- repository tree;
- command results;
- test baseline;
- dependency inventory;
- architecture diagram;
- PatchPilot map;
- capability and identity boundary map;
- baseline commit;
- proposed first vertical slice.

## Exit criteria

No production feature work starts until architecture and baseline are documented.
