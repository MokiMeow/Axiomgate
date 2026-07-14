# AGENTS.md — Engineering Instructions for All Coding Agents

## Scope

These instructions apply to the entire repository.

## First action

Read `START_HERE.md` and complete its mandatory pre-implementation assessment. Do not begin implementation first.

## Work style

Act as a senior engineer responsible for correctness, maintainability, security, performance, and product truth.

Do not optimize for the appearance of progress. Optimize for verified outcomes.

## Non-negotiable prohibitions

Never:

- claim a feature is complete without evidence;
- create placeholder methods that return successful fake data;
- mark a task done because code compiles;
- hide failing tests;
- weaken tests merely to make them pass;
- replace real integration tests with mocks while preserving the same claim;
- invent benchmark, quota, token, security, or usage values;
- expose secrets to the model, logs, screenshots, fixtures, or commits;
- perform production deployments in the demo;
- run destructive commands without explicit authority and backup;
- silently broaden filesystem, network, account, or cloud permissions;
- rewrite the existing PatchPilot architecture without an evidence-based reason;
- add duplicated utilities when suitable code already exists;
- leave commented-out experiments, abandoned files, untracked generated output, or debug logging;
- bypass formatting, lint, type checks, security checks, or test gates;
- use a new dependency without checking existing alternatives;
- say “all tests pass” without running the relevant commands during the current work.

## Mandatory task loop

### Before editing

1. Read the task and acceptance criteria.
2. Inspect relevant source and tests.
3. Check `docs/18-DECISION-LOG.md`.
4. Check `docs/19-IDEAS-INBOX.md` for accepted ideas only.
5. Inspect available execution mechanisms and required semantic actions.
6. Select the smallest relevant capability set.
7. Confirm the current intent boundary.
8. Confirm repository, branch, account, and environment.
9. Define required tests and evidence.
10. Create a checkpoint for risky work.

### While editing

- Keep changes narrow.
- Prefer small, composable functions.
- Preserve existing behavior unless the task explicitly changes it.
- Add tests alongside behavior.
- Record assumptions.
- Update task notes when a discovered dependency changes sequence.
- Put raw logs, recordings, temporary databases, downloads, and private fixtures under `.local/`.
- Put only sanitized, reproducible judge-facing evidence under `evidence/public/`.

### Before claiming completion

1. Format.
2. Lint.
3. Type-check.
4. Run targeted tests.
5. Run required integration/e2e tests.
6. Run the security checks and scoped code-quality checks required by the current task.
7. Inspect the final diff.
8. Verify there is no secret or private artifact.
9. Update docs and task status.
10. Create or update evidence.
11. Commit atomically.
12. State remaining limitations honestly.

## Capability use

Before implementing a task, discover the commands, native Codex tools, CLIs, APIs, browser automation, PatchPilot functions, MCP tools, skills, and other mechanisms already available. Treat them as interchangeable implementation mechanisms behind semantic actions; do not use one merely because it is installed.

Record in the task work log:

- semantic action required;
- mechanism selected;
- why it was selected over alternatives;
- identity and permissions required;
- data and state it can access or change;
- whether user approval is required;
- evidence it produced.

Do not install, relocate, duplicate, convert, or centrally reconfigure skills or MCP servers as ordinary task setup. Prefer native Codex functionality or deterministic CLIs where they are safer and easier to verify. Use independent model review for high-risk logic, not as a substitute for tests.

## PatchPilot

PatchPilot is the Verification Engine foundation.

- Audit its existing code first: a pnpm monorepo with `apps/web` (Next.js 15 dashboard), `apps/worker`, `apps/cli` (published npm CLI), `apps/mcp` (MCP server), and `packages/core` (~40 modules: scanners, Codex remediation, audit hash chains, Telegram approvals, redaction, prompt-injection guard). It is a web product, not a desktop app.
- Preserve working functionality.
- Integrate through explicit contracts.
- Move only when the existing boundary prevents correctness.
- Add migration and regression tests.
- Distinguish pre-existing behavior from Build Week additions.
- Show PatchPilot findings, remediation, and rerun evidence inside the AxiomGate web dashboard and CLI experience.

## Documentation

Documentation is part of the implementation.

Update documentation in the same change when:

- a schema changes;
- a command changes;
- a policy changes;
- a UI workflow changes;
- a limitation is discovered;
- a test strategy changes;
- an architectural decision is made.

## Ideas discovered during work

Do not silently expand scope.

Write the idea to `docs/19-IDEAS-INBOX.md` with:

- problem;
- evidence;
- proposed change;
- benefit;
- complexity;
- risk;
- effect on demo;
- recommendation.

Only accepted ideas enter `tasks/TASKS.md`.

## Failure handling

When blocked:

1. preserve current state;
2. capture the exact failure;
3. identify whether it is code, environment, dependency, permission, provider, or test-data related;
4. try bounded, evidence-driven alternatives;
5. do not loop;
6. record the blocker and recommended next action.

## Output language

Use precise, direct engineering language. Avoid exaggerated adjectives and unsupported success claims.
