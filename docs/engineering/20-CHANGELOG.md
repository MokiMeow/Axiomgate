# Changelog

## 2026-07-20 - 0.1.2

- Hard-denied model-visible writes into governed `.axiomgate` state before mission policy evaluation.
- Changed unrecognized shell commands from guessed repository reads to state-changing `UNKNOWN` with deny-by-default.
- Added 23 authority-hardening regressions and a live Codex 0.144.6 `.axiomgate` write-denial proof.
- Replaced unsupported motivation figures, labelled the wrong-target scene REPLAY, qualified PermissionRequest behavior, and documented receipt and Telegram limits.
- Prepared the bundled public CLI release with 309 passing tests and one optional live identity smoke skipped.

## 2026-07-20 - 0.1.1

- Bundled the verified source updates that postdate npm 0.1.0, including individual replay dispatch, Telegram lifecycle cards, current effort labels, and security hardening.
- Curated the repository into design, engineering, submission, and build-log documentation groups with deterministic link and punctuation gates.
- Strengthened and synchronized the native Codex skill against the shipped CLI help surface.
- Added a clean-tarball smoke for the individual wrong-target replay and retained offline receipt PASS/tamper-FAIL verification.
- Published the curated source to GitHub `main` and the bundled CLI as public npm package `axiomgate@0.1.1`.
- Normalized the package bin path to `dist/index.js` so the final npm publish does not need manifest auto-correction.
- Removed unreferenced build-log templates and tracked `.local` scaffolding, then added a Markdown quality gate for private paths, sparse files, heading structure, and encoding corruption.
- Reconciled active architecture, schema, runtime, dashboard, PatchPilot, and CLI documents with the shipped implementation while preserving dated evidence as historical fact.

## 2026-07-19 - Publication preparation

- Prepared the unscoped `axiomgate@0.1.0` npm package as a single Node 20 ESM bundle with no runtime workspace dependency.
- Added the MIT repository license and a compact npm README.
- Added repeatable fresh-tarball verification for doctor/help, offline receipt integrity and tamper rejection, and MCP stdio.
- Added a post-publication registry/npx verifier and a repository-root Codex plugin marketplace descriptor.
- Kept npm publication and Git push as explicit user actions.

## Unreleased

### Added

- Initial AxiomGate documentation-first implementation blueprint.
- Six-layer architecture.
- Mandatory pre-implementation assessment.
- Engineering truth, testing, security, and repository hygiene contracts.
- Detailed phased task plan.
- PatchPilot integration plan.
- Local/private and public evidence separation.

No production functionality is claimed in this entry.
## 2026-07-14 - Independent-review revision (ADR-007..ADR-012)

- Completed an independent blueprint review (verdict: reduce scope before building; idea 7/10).
- Specified hook-native enforcement (Codex hooks, sandbox mapping, App Server/SDK, fail-closed) across architecture, Environment Guard, Codex Runtime, and compatibility docs.
- Corrected the PatchPilot factual model everywhere: web/worker/CLI/MCP monorepo, not a desktop app; rewrote `docs/design/09-PATCHPILOT-INTEGRATION.md`.
- Re-scoped browser verification (stretch) and maintainability (deferred) - they do not exist in PatchPilot.
- Replaced the desktop app with the local web dashboard (ADR-009).
- Cut `docs/build-log/TASKS.md` to the vertical slice; deferred items retained and labelled.
- Added canonical JSON schema sketches to `docs/design/02-DOMAIN-MODEL.md`.
- Added deploy-target ownership proof, post-limit resume plan, and `axiomgate receipt verify` (ADR-011/012).
- Rewrote the demo storyboard around the wrong-target block and evidence-gated completion.
- Added ship-during-week distribution (npm publish Jul 18, real-usage evidence, ADR-013), protected polish pass, and "proof-carrying missions" positioning language.
- Consistency pass (third GPT audit): Codex Runtime doc split into core recovery vs post-hackathon supervision/transition machinery, Scout marked stretch-X3; maintainability guard moved under an explicit post-hackathon design label (X2 diff-warning only); browser inputs made conditional on X1 in plan/domain docs; Build Week integration-test list fixed; Phase 2 split into core G1-G5 vs stretch X4-X5; Master Contract compiler/guard wording narrowed; Runway estimate defined as a confidence-labelled four-input heuristic ("planned vs actual"); receipts JSON+Markdown core / HTML post-hackathon; non-Codex support scoped to review-only; real-usage evidence made conditional; v2→v3 references corrected; Settings label scoped to Codex/runtime.
- Consistency pass (second GPT audit): Master Contract reduced to Build Week core with an explicit post-hackathon section; task board consolidated to 26 tasks (v3); Phases 1/3/4 rewritten and all phase files aligned; Replay Lab cut to 3 scenarios; architecture services trimmed (web dashboard flow, no worktree/continuity/maintainability ownership); Runway and Mission Compiler split into Build Week vs future scope; test strategy split into Build Week vs future matrices; `docs/design/13-UX-WEB-CLI.md` and `PHASE-6` renamed to WEB-CLI; single `axiomgate-core` package structure; provider-local settings git-ignored; historical review banner added.

## 2026-07-14 - Capability-policy scope revision

- Removed universal skill installation, shared-folder migration, MCP registry, config-generation, and gateway work from Build Week scope.
- Reframed Environment Guard around semantic actions, identity, authority, trust, and effective permissions.
- Updated architecture, domain model, task plan, tests, UX, compatibility, security, and demo scenarios for consistency.
