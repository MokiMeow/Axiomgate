# Pre-Implementation Assessments

This append-only record preserves the verified scope, authority, and repository reality observed before each major implementation or validation session. Later entries do not rewrite earlier facts.

## F3/F4

**Date:** 2026-07-14
**Verdict:** Feasible as scoped to F3/F4.

### Understanding and boundaries

AxiomGate turns a Codex objective into a versioned Mission Contract, plans capacity, enforces identity and action authority, runs Codex, verifies through PatchPilot, and permits completion only from admissible evidence.
The six layers are Mission Compiler, Runway, Environment Guard, Codex Runtime, Verification Engine, and Evidence Gate. The Build Week path ends at a pull request and preview deployment; production deploys and every item under `docs/design/MASTER_BUILD_CONTRACT.md` “Post-hackathon scope” are excluded.
Genuine completion requires current code, automated checks, runtime evidence, documentation, and task status to agree. Model prose is not evidence.
PatchPilot is pre-existing May 2026 work: a pnpm monorepo with Next.js web, worker, CLI, MCP server, and `packages/core` scanners, validation, remediation, audit, approvals, redaction, and injection guards. F3/F4 will not copy or modify it.

### Verified repository reality

- AxiomGate started as a documentation-only repository at baseline commit `58c1a0a`; current branch is `main`, with no remote, package manifest, TypeScript source, test suite, persistence layer, web app, or CI workflow.
- Current HEAD before this assessment is `2e17304`; the worktree was clean and Git commit identity is configured.
- `docs/engineering/17-COMPATIBILITY-ADAPTERS.md` records F2 on `codex-cli 0.144.0`: JSON hook denial is enforced; bare exit code 2 fails open under `approval_policy="never"`. PermissionRequest and usage-field checks remain later work.
- Local tools: Node `v24.11.1`, pnpm `10.33.0`, Codex CLI `0.144.0`, Git `2.55.0.windows.2`, and `rg`. PowerShell script shims are blocked, so verification uses the equivalent `.cmd` launchers on Windows.
- A separate pre-existing PatchPilot checkout was inspected read-only. Its `packages/core/src` exports the documented validation, scanner, Codex, audit, approval, redaction, prompt-injection, and MCP-tool-guard modules. Its unrelated working-tree state was not touched.
- Relevant sources read: `docs/build-log/START_HERE.md`, `README.md`, the build contract, architecture/domain/security/test/quality/DoD/hygiene docs, ADRs, ideas inbox, status board, task board, Phase 0 file, `docs/engineering/17-COMPATIBILITY-ADAPTERS.md`, PatchPilot `FEATURE_MATRIX.md`, package manifests, core index, and relevant core exports.
- Discovery commands: `git status/log/show/remote`, `rg --files`, `Get-Content`, tool version/presence checks, and read-only PatchPilot tree/Git inspection using a per-command safe-directory override.

### Architecture assessment

One process and one `@axiomgate/core` package with layer modules matches ADR-008 and avoids premature services. F3 should map PatchPilot reuse contracts but defer integration to V1-V4. No migration or persistence change is needed for F3/F4.
The canonical sketches need deterministic validation choices: strict objects, ISO-8601 timestamps, and `sha256:<64 lowercase hex>` hashes. Contract hashing must omit the existing `hash` field to avoid self-reference; version bumping increments `version`, accepts the new timestamp, then re-hashes.

### Implementation and verification plan

1. Create a strict NodeNext pnpm workspace, `@axiomgate/core` layer barrels, a factual PatchPilot reuse map, and `@axiomgate/cli doctor` using standard Node process APIs.
2. Pin TypeScript, Vitest, Zod, and required Node typings; add no runtime parser dependency for the CLI.
3. Implement the five Zod schemas exactly from `docs/design/02-DOMAIN-MODEL.md`, the ordered intent-boundary helper, stable key-sorted serialization, SHA-256 contract hashing, and version bump/re-hash.
4. Add happy and rejection tests for all schemas plus hash order independence, version bumping, boundary ordering, and model-evidence rejection.
5. Run install, build/typecheck/test as applicable, inspect diffs and ignored/untracked files, scan dependency metadata and source for obvious secret material, then make atomic assessment/scaffold/schema commits.
6. Rollback is commit-level revert; no database, provider, credential, PatchPilot, or production state changes are authorized.

### Capability-use log

| Semantic action | Mechanism and reason | Identity / access / approval | Evidence |
|---|---|---|---|
| Inspect repository and PatchPilot | `rg`, PowerShell reads, Git read-only commands | Local filesystem; PatchPilot read-only; pre-authorized | Trees, manifests, Git state |
| Create and validate files | `apply_patch`, TypeScript, Vitest | AxiomGate workspace write; pre-authorized | Diff, compiler and test output |
| Resolve dependencies | `pnpm install` | Anonymous npm network read and local workspace write; requested by task | Lockfile and successful install |
| Check CLI environment | Node child processes for Codex and Git | Local process state only; pre-authorized | `doctor` output |
| Record checkpoints | Local Git commits | Configured local Git identity; explicitly required | Three atomic commit hashes |

---

## G4 Telegram Relay and T3 Notifications

**Date:** 2026-07-20
**Starting checkpoint:** `4eb1e8b` on clean `main`
**Verdict:** Feasible with narrow adapter and persistence additions; no new runtime dependency is needed.

### Understanding and authority

This task completes the remote approval surface without changing AxiomGate's authority model. Telegram is a secondary presentation and input adapter over the canonical ActionRequest and approval store: it may render a redacted request, submit an exact request ID to the existing atomic `approve`/`deny` mutation, edit its own card, and publish read-only stage notifications. The hook remains the enforcement point, command-hash binding remains authoritative, and Telegram failure must never block a governed run or silently grant authority.

The maximum implementation boundary is `MODIFY_LOCAL`: source, tests, documentation, ignored local state, and local Git commits are authorized. The optional live proof may call the Telegram Bot API only because the task explicitly authorizes it when `.local/telegram.env` exists. No webhook, public listener, production deployment, npm publication, or Git push is authorized by this task.

### Verified repository reality

- `@axiomgate/core` is TypeScript/NodeNext with Zod as its sole production dependency; the published CLI bundles core with esbuild. No Telegram dependency exists or is required because Node 20 provides `fetch`, `AbortController`, and standard crypto/filesystem APIs.
- The canonical file approval store already provides strict schemas, exact-command binding, a 15-minute default TTL, per-record `wx` locks, CLI/dashboard/MCP surfaces, atomic first-decision wins, and single-use consumption. Telegram must call this store rather than create another approval format.
- Mission state is local under `.axiomgate/missions/<id>/`; approvals are one JSON file per ActionRequest and events are append-only JSONL. Existing run, verification, checkpoint, ledger, receipt, and hook records can feed T3 without a daemon or database.
- Central `redactSensitiveText`/`redactSensitiveValue` functions already cover common token and credential shapes before persistence. Telegram adds the Bot API token shape and applies redaction before rendering, errors, events, or evidence.
- The CLI is a zero-dependency command router. `doctor`, mission run summaries, and approval commands are direct integration points for the new surface.
- `.local/telegram.env` exists and is ignored by `.gitignore`; its contents were not displayed or inspected during discovery. Telegram variables are not present in the current process environment.
- The separate PatchPilot checkout was inspected read-only. Its adapter validates the 64-byte callback limit, masks chat IDs, checks an allowlist, calls `answerCallbackQuery`, and edits messages. It is not imported: ADR-014 keeps AxiomGate self-contained and the normative task requires a different local lookup/canonical-store contract.
- Telegram's official Bot API confirms that `getUpdates` long polling and webhooks are mutually exclusive, offsets must advance to highest `update_id + 1`, `callback_data` is limited to 1-64 bytes, callback queries must be answered to stop the client spinner, HTML parse mode supports `<b>` and `<code>`, and `editMessageText` edits bot messages.
- Baseline `pnpm test` passed 27 files with 258 tests and one explicitly opt-in live identity smoke skipped.

### Architecture critique and decisions

- Keep provider HTTP, rendering, local state, and orchestration separate. Rendering and event-to-notification mapping remain pure; the watcher receives an injectable Telegram client and clock for deterministic tests.
- Use a compact callback `{short local reference, verb}` only. The reference resolves through ignored `.axiomgate/telegram-state.json`; no command, target, identity, chat ID, signature, or token enters `callback_data`.
- Persist a SHA-256 chat key, never the full chat ID. At runtime it is matched against the configured allowlist; user-facing and evidence output uses only `***<last4>`.
- Reuse the canonical record lock for CLI-versus-Telegram races. A rejected Telegram mutation re-reads the canonical outcome and reports the winning surface without retrying or re-granting.
- Expiration is a presentation state derived from the canonical expiry. The existing approval schema need not gain a fourth storage status. Expired cards are edited and later taps are rejected.
- Use bounded HTTPS retries with abort timeouts and redacted typed results. Telegram availability never changes the governed run result; the CLI approval path remains the recovery path.
- Stage notifications are projections of stored events/records, not new authority. Remote model switching is deliberately absent.
- A consumed approval is associated with the run record whose time window contains `consumedAt`; the card is edited only after such a stored run ID exists.

### Planned implementation and tests

1. Add `src/guard/telegram/` modules for config, API client, schemas/state, HTML-safe rendering, approval callbacks, mission scanning, and watcher orchestration; export them through the guard barrel.
2. Extend centralized redaction for fabricated Telegram bot-token shapes and add a regression proving the token cannot reach rendered cards, API errors, event logs, or state.
3. Add table-driven/snapshot tests for all normative card fields, all seven demo actions, HTML/emoji hostility, truncation, hash integrity, details, outcomes, and callback byte limits.
4. Cover the ten case-matrix entries: approve, deny/evidence, both expiry timings, multiple approvals, CLI race, non-allowlisted/forwarded callbacks, bounded send failure, hostile/long text, and restart offset persistence. Assert canonical CLI/Telegram record equivalence and single-use consumption.
5. Add T3 event/record projections, dedupe cursor, 20-message suppression guard, usage-threshold handling, approvals-only/off modes, and fixture coverage for every notification family.
6. Add `telegram watch` and `telegram test`, masked doctor status, optional non-blocking run-summary send, README/Judge notes, task/status/changelog updates, public evidence, and an ignored detailed report.
7. If local configuration validates, run a real getMe/card/details/approve/re-tap proof without printing configuration values. If interaction cannot be completed safely and deterministically, record the exact honest `PENDING` boundary.
8. Run targeted and full tests, typecheck, build, dependency/secret scans, inspect all persisted fixtures and diffs, then commit approval relay and notification/CLI/docs changes atomically.

Rollback is commit-level revert plus deletion of ignored `.axiomgate/telegram-state.json`; Telegram messages may remain externally visible but carry no secret or unredacted path. No schema migration, new dependency, webhook, or cloud resource is introduced.

### Capability-use log

| Semantic action | Mechanism selected | Identity, permissions, data, approval | Evidence |
|---|---|---|---|
| Inspect product and prior adapter | `rg`, PowerShell reads, Git, read-only PatchPilot checkout | Local filesystem read; no account mutation | Source inventory and baseline test output |
| Validate protocol contract | Official Telegram Bot API documentation | Anonymous HTTPS read | Confirmed polling, offset, callback, HTML, and edit contracts |
| Implement and test | `apply_patch`, TypeScript, Vitest | Workspace write under `MODIFY_LOCAL`; explicitly authorized | Diff, fixtures, test output |
| Telegram live smoke | Direct Bot API HTTPS adapter using ignored env config | Configured bot plus allowlisted chats; explicitly conditional; no token output | Masked CLI transcript and sanitized public evidence |
| Record work | Local Git commits | Existing Git identity; explicitly required | Atomic commit hashes |

### Open decisions with defaults

- **Multiple allowlisted chats:** send one independently tracked card per approval per allowlisted chat; the canonical store makes the first decision win.
- **Missing configuration:** doctor reports `UNAVAILABLE`; watcher/test exits with a safe instruction; governed runs continue and retain CLI approval.
- **Live interaction timing:** use a bounded proof window. If no allowlisted Details/Approve callbacks arrive, leave the live proof `PENDING` rather than fabricating a tap.
- **Future npm release:** source/package versioning and publication are outside this task unless separately authorized; public docs will distinguish source availability from the already-published `0.1.0` when necessary.

---

## Full-System Matrix Validation

**Date:** 2026-07-20

**Starting checkpoint:** `9c0746b` on clean `main`

**Verdict:** Feasible as a mixed LIVE/REPLAY/fixture audit. Published `axiomgate@0.1.0` necessarily tests the released snapshot, while current-source-only improvements must be labelled separately until a user-authorized release.

### Authority and scope

This session validates Plan, Guard, Run, Verify, Prove, Runway, CLI, npm, plugin, MCP, dashboard, and Telegram surfaces. Read-only registry/GitHub/Codex queries, disposable state under `.local/`, bounded Luna runs, local dashboard processes, Telegram messages to the configured allowlist, and canonical scratch approvals are authorized by the matrix. Production deploys, Git pushes, npm publication, real remote repository mutation, permission broadening, and invented provider state are not authorized.

The smallest capability set is the existing CLI, `npx` against registry.npmjs.org, Codex CLI/plugin commands with an isolated `CODEX_HOME`, direct MCP stdio JSON-RPC, the loopback dashboard, the configured Telegram long-polling adapter, repository test fixtures, and official/read-only web pages. No dependency installation or architecture expansion is planned.

### Verified prerequisites and risks

- The worktree is clean on `main`; origin is the public GitHub repository.
- Local source has 28 green test files and 279 passing tests plus one opt-in identity skip as of the preceding Telegram gate.
- The public npm version remains `0.1.0`; later source commits are not assumed present in it.
- Six MCP tools exist; five are read-only and `axiomgate_approve` is the only mutating tool.
- Telegram is configured through ignored local state and has a completed live approval proof; this matrix requires additional real interactions and will mask all identifiers.
- Provider quota, plugin behavior, GitHub/npm rendering, and Codex model execution are live mutable dependencies and can become honestly PENDING/FAIL.
- The matrix is intentionally broader than one automated test run. Existing public evidence may satisfy explicitly linked rows, but every row still receives a result and proof pointer.

### Execution and evidence plan

1. Create one complete coverage table with no empty cells and explicit N/A reasoning.
2. Test published npm and plugin paths from fresh directories/homes; check public pages through read-only network access.
3. Run only the bounded model/effort cases allowed by the live weekly-usage threshold, then inspect ledger/run records rather than trusting stdout.
4. Execute uncovered layer paths with scratch missions; link existing headline/replay evidence for already-proven destructive or expensive cases.
5. Exercise all MCP tools directly and use Codex for two read-only calls if the installed plugin route supports it.
6. Execute Telegram approval, denial, expiry, race, security, notification, dedupe, and suppression paths; distinguish live callbacks from fixture-only adversarial cases.
7. Fix only small defects with regression tests and atomic commits. Record larger or published-artifact gaps without republishing.
8. Finish with typecheck, test, build, secret/path/identity review, public evidence, and an ignored detailed report.

Rollback is deletion of disposable `.local/matrix*` state and commit-level revert for any fixes. External Telegram messages and isolated plugin downloads may remain, but no production or remote repository state will be changed.

---

## Telegram Real-Workspace UX Validation

**Date:** 2026-07-20

**Starting checkpoint:** `b9c6b93` on clean `main`

**Verdict:** Feasible as a presentation-layer correction plus a bounded live lifecycle on the existing ignored demo workspace. No authority or approval schema change is required.

### Product truth and authority

The current Telegram stage notifications compress multiple facts onto one em-dash-separated line, display only the random mission ID, and expose hashes that are valuable to the enforcement store but not to a human approver. That makes real events hard to interpret even though the underlying records are correct.

The human mission label is the contract objective supplied by `axiomgate mission create --objective`; the workspace label is the governed folder/profile name. Internal mission, request, event, receipt-chain, and command hashes remain necessary for offline integrity and exact approval binding, but they should not dominate the Telegram surface. The approval card will show the redacted exact command and explain that the grant is command-bound; internal references remain available only in Details.

The active intent boundary is `MODIFY_LOCAL`. Source, tests, local docs/evidence, ignored demo mission state, bounded Codex/verification calls, and Telegram messages to the configured allowlist are authorized. Git push, npm publish, preview/production deploy, webhook setup, remote model switching, and fabricated quota/reset values are not authorized.

### Planned change and proof

1. Replace compact stage lines with HTML-safe sections for Mission, Workspace, result-specific facts, model/effort where relevant, and time.
2. Remove static em/en dashes from every Telegram renderer and normalize user/event text so those glyphs cannot re-enter the cards.
3. Remove SHA-256 values from pending/outcome/stage messages and from approval Details; preserve exact hashes unchanged in canonical records and evidence.
4. Enrich real Runway events with observed remaining percentage, reset time, plan, banked-reset count, and source/confidence. Render these only when the event actually contains them; otherwise show `UNKNOWN` rather than inventing values.
5. Use the contract model plan to label verification and remediation notifications, and use actual run model/effort for governed-run notifications. No Telegram action will change models.
6. Add regression tests for mission objective/workspace provenance, structured layouts, no dashes/hashes/private paths, model labels, verification/proof meaning, guard reasons, and full Runway fields.
7. Build the CLI and run a real lifecycle against the existing ignored desktop demo workspace: create a new read-only validation mission, run it, verify target tests/build/security/secret checks, inspect proof status, generate a receipt if the gate legitimately passes, and run the Telegram watcher. Existing events are not rewritten merely to resend cards.
8. Run targeted/full tests, typecheck, build, privacy scans, inspect the diff, write sanitized evidence plus an ignored report, and commit atomically.

### Capability-use log

| Semantic action | Mechanism selected | Identity, access, approval | Evidence |
|---|---|---|---|
| Inspect message pipeline | `rg`, PowerShell reads, Git | Local read-only access | Source and event-shape inventory |
| Change presentation and event projection | `apply_patch`, TypeScript, Vitest | Repository write under `MODIFY_LOCAL` | Diff and regression tests |
| Governed demo validation | Existing AxiomGate CLI and timeout runner | Local demo workspace plus configured Codex account; no publish/deploy | Run, ledger, verification, status, receipt records |
| Telegram live validation | Existing Bot API long-poll adapter | Configured bot and allowlisted chat; no credential output | Sanitized card/state counts and live transcript |
| Security/privacy verification | Repository tests and token/path scans | Local read-only | No secret, full chat ID, or private path in committed proof |

Rollback is commit-level revert. Ignored test missions and Telegram state can be deleted locally; already-sent Telegram messages may remain but contain only redacted project data.
## Repository Curation and 0.1.1 Preflight

Date: 2026-07-20

### 1. Understanding

AxiomGate is a six-layer governance system: Mission Compiler, Runway, Environment Guard, Codex Runtime, Verification Engine, and Evidence Gate. A mission moves from an objective and bounded contract through hook-enforced action policy, governed Codex execution, independent machine verification, and an evidence-derived completion gate. Genuine completion requires fresh admissible command, API, or hook evidence and a COMPLETE proof gate. Model prose is never evidence. PatchPilot contributes the published dependency-scanning integration without becoming copied AxiomGate source.

This task is repository and release curation. It reorganizes design, engineering, submission, and build-history documents; makes README the one-hop discovery surface; removes em and en dash punctuation from every tracked file; strengthens the native skill; records an honest platform matrix; and prepares a locally verified 0.1.1 package. It does not authorize GitHub push, npm publish, deployment, credential search, or any external mutation.

### 2. Repository reality

- Branch: `main`, ahead of `origin/main`; working tree clean at assessment time.
- Identity: local Git identity `mokimeow`; remote is the public AxiomGate GitHub repository.
- Stack: pnpm 10 TypeScript monorepo, bundled Node CLI, Vitest, and a zero-dependency local web surface.
- Persistence: local `.axiomgate` mission directories with JSON/JSONL state and ignored `.local` private artifacts.
- Published package source: `apps/cli`, currently version 0.1.0 with bundled core and a three-file whitelist.
- Native artifacts: repo skill under `.agents/skills/axiomgate`, plugin skill copy under `plugins/axiomgate`, and read-only verifier agent.
- Documentation is flat under `docs/`; build-history task files are under root `docs/build-log/`; several root guidance files need relocation.
- Existing scripts cover packed and published verification but no full Markdown relative-link checker exists.
- CLI help confirms the commands requested for the strengthened skill exist, including mission create/run/verify/status/receipt, receipt verify, replay, telegram watch, verify-enforcement, and runway status.
- WSL2 Ubuntu is registered but cannot start because its VHDX path is missing. No Linux command was executed. Windows remains verified; Linux and macOS remain unverified.

Inspected commands and files include `git status`, `git remote -v`, root/docs/tasks inventories, `README.md`, `docs/design/MASTER_BUILD_CONTRACT.md`, `AGENTS.md`, required architecture/security/test/quality/Done/hygiene documents, `docs/engineering/18-DECISION-LOG.md`, `docs/engineering/19-IDEAS-INBOX.md`, package manifests, CLI help, skill copies, validation scripts, and `wsl --status`/distribution startup.

### 3. Architecture critique

The six-layer architecture and evidence hierarchy remain appropriate. The flat documentation layout is no longer appropriate for judging because design intent, implementation history, and submission material compete at the same level. Moving task history into `docs/build-log` improves discovery without deleting provenance. README should replace the stale hand-maintained root file index as the primary map; a generated link checker should enforce integrity instead of another manually synchronized index.

The skill is accurate but too small to guide a full governed lifecycle. It should remain concise while naming real commands and hard safety rules. The package preflight currently hard-codes 0.1.0 and must migrate with the version. WSL repair would be environment administration outside the time-boxed verification task and should not be attempted.

### 4. Proposed implementation

1. Use `git mv` to create `docs/design`, `docs/engineering`, `docs/submission`, and `docs/build-log`; relocate root strays; update AGENTS and all relative references; replace `FILE_INDEX.md` with the README repository map; add a deterministic Markdown link checker.
2. Sweep tracked files for Unicode em/en dashes and rewrite punctuation without changing meaning.
3. Restructure README as the AI and human entry point with one-hop repository map, shipped Telegram surface, honest roadmap, platform matrix, and evidence-linked claims.
4. Strengthen and synchronize both skill copies; assert every referenced command against shipped CLI help.
5. Record WSL as unavailable with the exact environment failure and retain unverified Linux/macOS labels.
6. Bump the publishable package to 0.1.1, update README/changelog pins, update packed verification, inspect the pack list, and install/test the tarball locally.
7. Run link integrity, Unicode punctuation gate, typecheck, tests, build, pack verification, secret/path inspection, and final diff review. Commit each curation part atomically.

Rollback is per atomic commit. Document moves preserve history and can be reverted without data migration. No application schema or external state changes are planned.

### 5. Open decisions

- File index: fold it into README and delete `FILE_INDEX.md`; this avoids two maps drifting.
- WSL: record unavailable and stop platform work; do not repair the user's WSL installation.
- En dash: use plain hyphens even for ranges so the tracked Unicode gate has one unambiguous zero-hit rule.
- Release: prepare 0.1.1 locally, then request explicit authorization for push and publish.

### 6. Capability-use plan

- `git mv` and `apply_patch`: local documentation/source organization and link repair; local repository write only; allowed.
- `rg`, `git ls-files`, and a Node Markdown-link checker: local discovery and deterministic integrity evidence; read-only except the committed checker; allowed.
- Shipped CLI help: confirm skill command truth; local process, no account; allowed.
- `wsl.exe`: platform discovery only; local environment read/start attempt, no install or repair; allowed and now concluded unavailable.
- pnpm typecheck/test/build: local verification; no account; allowed.
- `npm pack` and temporary tarball installation: local release verification with registry use only if dependencies are already resolved; no publish credential; allowed.
- GitHub push and npm publish: external state changes requiring account authority; denied until the user explicitly confirms after preflight.

### 7. Feasibility verdict

Feasible with one verified limitation: Linux cannot be claimed because the installed WSL2 Ubuntu instance cannot attach its missing virtual disk. C1-C4 and C6 local preparation are feasible. C5 will record the honest unavailable result. Push and publish remain blocked pending explicit user confirmation.
