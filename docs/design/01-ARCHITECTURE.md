# Architecture

## High-level flow

```text
User / Web Dashboard / CLI / Telegram
              |
        Mission Compiler
              |
            Runway
              |
      Environment Guard
              |
        Codex Runtime
              |
    Verification Engine
              |
        Evidence Gate
              |
 GitHub PR / Preview Deployment / Receipt
```

## Architectural style

- Local-first orchestration.
- Event-driven mission state.
- Explicit adapters at provider and external-service boundaries.
- Policy evaluation before side effects.
- Evidence capture after observable actions.
- Append-only mission events with derived current state.
- File-backed JSON/JSONL persistence with strict schemas and deterministic projections.
- UI driven by domain state, not ad hoc process output.
- Semantic actions separated from the mechanism used to execute them.

## Core services

### Mission service

Owns mission contracts, versions, acceptance criteria, constraints, action authority, and state transitions.

### Runway service

Owns the token-actuals ledger, verification reserve, loop detection, model plans, the labelled capacity snapshot, and post-limit checkpoint/resume. (Full quota normalization and continuity management: post-hackathon.)

### Environment service

Owns project profiles, identity resolution, credential handles, intent boundaries, capability-policy decisions, semantic action requests, and effective-permission reconciliation.

It does not become a package manager. It discovers existing execution mechanisms and maps them to semantic actions.

### Execution service

Owns `codex exec --json` sessions, sandbox mapping, and canonical mission state with stop/resume. Process-supervision breadth, worktree leases, and a TypeScript SDK integration remain post-hackathon.

### Verification service

Owns the published PatchPilot CLI adapter, native check plans, findings, remediation cycles, freshness invalidation, and evidence capture. Maintainability analysis is post-hackathon.

### Evidence service

Owns proof links, approval events, review maps, receipt generation, redaction, and export.

## Semantic action abstraction

Environment Guard reasons about stable actions rather than protocol-specific tool names.

Examples:

```text
repository.read
branch.create
pull_request.create
preview.deploy
production.deploy
database.query_readonly
database.migrate
browser.verify
verification.run
```

An action may be implemented by a native Codex tool, CLI, API adapter, browser workflow, MCP tool, skill-provided script, or PatchPilot function. The policy applies to the semantic action regardless of mechanism.

## Enforcement mechanism

Policy is enforced at official Codex extension points, not through prompt instructions:

- **Codex hooks** - `PreToolUse` calls the local AxiomGate policy engine before matching tool calls execute; its machine-JSON deny is live-proven on `codex exec` 0.144.6. `PermissionRequest` is configured and fixture-tested through the same policy entry, but did not fire in the recorded non-interactive on-request probe under effective `Never`. AxiomGate records each decision it receives; `PostToolUse`, `PreCompact`, and `PostCompact` are not part of the shipped hook configuration.
- **Sandbox and permission profiles** - the mission intent boundary maps to concrete Codex sandbox flags and permission-profile settings at session launch (for example, `MODIFY_LOCAL` → `--sandbox workspace-write`, network off).
- **Codex execution and App Server** - `codex exec --json` launches and observes governed sessions and supplies ledger events and token usage. A separate short-lived App Server process supplies `account/rateLimits/read` capacity data. No TypeScript SDK dependency is shipped.
- **Fail closed** - a mission refuses to start if the hook configuration hash does not match the mission policy, if the installed Codex version does not support the required hooks, or if hook failure semantics cannot be verified.

Every hook decision (allow, deny, escalate) is persisted as a mission evidence event.

## Required boundaries

- UI must not call provider CLIs directly.
- Models must not read raw credential stores.
- Approval UI must display semantic intent derived from a typed action request.
- Verification must not accept a model-generated “passed” string as evidence.
- External actions must pass policy and identity checks.
- Receipt generation must consume stored evidence events, not agent prose.
- Discovery of a capability must never imply authorization to use it.
- A protocol-specific adapter must not silently widen the semantic action that was approved.

## Canonical mission state

The mission state is not the raw chat history. It includes:

- contract version;
- current phase;
- acceptance criterion states;
- decisions and rejected approaches;
- repository/branch/commit;
- changed files;
- active processes;
- selected model and effort;
- capacity snapshot;
- permissions;
- capability-policy snapshot;
- requested and executed semantic actions;
- findings;
- evidence;
- pending approvals;
- next safe action.

## Persistence

The shipped store is local and file-backed under `.axiomgate/`: versioned contract/snapshot JSON, one JSON file per approval, session/checkpoint/run records, and append-only event and ledger JSONL. Strict schemas, atomic approval locks, canonical hashes, deterministic receipt projections, and centralized redaction protect the boundary. A database, general migration framework, and automated backup service are not shipped.

## Failure model

Every operation must return a typed outcome:

- succeeded;
- failed;
- blocked by policy;
- awaiting approval;
- unavailable;
- timed out;
- cancelled;
- partially completed with recovery checkpoint.

Do not collapse all failures into generic exceptions or success booleans.

## Deployment model

For the hackathon:

- local web dashboard and CLI (no desktop app - ADR-009);
- file-backed local engine with no daemon;
- GitHub and Vercel preview integrations;
- no required cloud control plane;
- no production deployment in the judge path.

## Architecture acceptance

Phase 0 mapping is complete. ADR-014 records the implemented published-CLI PatchPilot boundary, and `docs/engineering/21-IMPLEMENTATION-STATUS.md` is the current evidence-linked status authority.
