# Start Here - Mandatory Agent Preflight

This file defines the first interaction every implementation agent must complete.

## Absolute rule

**Do not edit production code, install dependencies, migrate data, modify credentials, alter CI, or create external resources until the pre-implementation assessment below is delivered.**

Reading documentation, inspecting the repository, running read-only discovery commands, and collecting baseline evidence are allowed.

## Required reading order

Read these files completely:

1. `README.md`
2. `docs/design/MASTER_BUILD_CONTRACT.md`
3. `AGENTS.md`
4. `docs/design/00-PRODUCT-VISION.md`
5. `docs/design/01-ARCHITECTURE.md`
6. `docs/design/02-DOMAIN-MODEL.md`
7. `docs/design/10-SECURITY-THREAT-MODEL.md`
8. `docs/design/11-TEST-STRATEGY.md`
9. `docs/engineering/15-CODE-QUALITY.md`
10. `docs/engineering/23-DEFINITION-OF-DONE.md`
11. `docs/engineering/24-REPO-HYGIENE.md`
12. `docs/build-log/TASKS.md`
13. The phase file for the first planned task

Inspect the current AxiomGate implementation under `apps/`, `packages/`, `scripts/`, and `tests/` before proposing changes. PatchPilot remains a separate pre-existing project; AxiomGate integrates only through the published `patchpilot-cli@0.1.3` boundary recorded in ADR-014 and [`packages/axiomgate-core/PATCHPILOT_REUSE.md`](../../packages/axiomgate-core/PATCHPILOT_REUSE.md). Do not assume a local PatchPilot checkout exists, import its source, add a submodule, or describe its internal modules as shipped AxiomGate code.

Historical baseline: AxiomGate was documentation-only at commit `58c1a0a` when Build Week began. That fact belongs in the pre-event assessment and hackathon delta; it is not the repository's current state and must not be used to skip inspection of the implemented product.

## Required pre-implementation response

Create or update `docs/engineering/22-PRE-IMPLEMENTATION-ASSESSMENT.md` and report the following to the user before implementation:

### 1. Your understanding

Explain in your own words:

- the product problem;
- the six product layers;
- the end-to-end mission lifecycle;
- the non-negotiable safety boundaries;
- what counts as genuine completion;
- what PatchPilot contributes;
- what existed before the hackathon versus what will be added.

### 2. Repository reality

Report only what you verified:

- current technology stack;
- web dashboard stack;
- CLI structure;
- persistence layer;
- existing PatchPilot architecture;
- existing tests and their real status;
- CI status;
- currently available capability mechanisms, integrations, and permission boundaries;
- relevant existing documentation;
- obvious dead code, duplication, or structural risk;
- exact files and commands inspected.

Do not invent unavailable information.

### 3. Architecture critique

State:

- what you agree with;
- what you would change;
- what appears over-engineered;
- what can reuse existing code;
- what should be deferred;
- likely bottlenecks;
- compatibility risks;
- data or API assumptions that require validation.

Be direct. The purpose is to improve the plan, not to approve it automatically.

### 4. Proposed implementation

Provide:

- the first vertical slice;
- exact modules and files expected to change;
- schema or API changes;
- migration approach;
- test plan;
- security checks;
- performance measurements;
- rollback plan;
- documentation updates;
- expected commits.

### 5. Open decisions

List only decisions that materially affect correctness, safety, or architecture. For each, give a recommended default so work can proceed without unnecessary delay.

### 6. Capability-use plan

List the commands, native Codex tools, CLIs, APIs, browser automation, PatchPilot functions, MCP tools, skills, or other mechanisms that may be used. For each, explain the semantic action it enables, why it is relevant, which identity and permissions it requires, and whether it should be allowed, denied, or approval-gated. Do not propose installing, relocating, deduplicating, or reconfiguring capabilities unless a verified implementation dependency requires it.

### 7. Honest feasibility verdict

Give a direct verdict:

- feasible as written;
- feasible with listed changes;
- or blocked by a specific verified limitation.

Distinguish verified facts from inference.

## Start authorization

After the assessment is reviewed, begin with Phase 0 unless the user explicitly selects another phase. Do not interpret enthusiasm or an earlier general request as authorization to perform production deployments, paid usage, destructive actions, or external mutations.

## During implementation

At the beginning of every task:

1. Read its task definition.
2. Confirm prerequisites.
3. Record the current action authority.
4. Record the current Git branch and working tree state.
5. Select the smallest relevant capability set and record its semantic actions.
6. Define the tests and evidence required before editing.
7. Create a safe checkpoint when changing models, sessions, or providers.

At the end of every task:

1. Run the required tests.
2. Inspect the diff.
3. Run formatting, linting, type checking, and applicable security checks.
4. Update the task status and evidence links.
5. Update affected documentation.
6. Remove temporary files and dead code.
7. Commit atomically with a truthful message.
8. Never say “done” when the Definition of Done is not met.
