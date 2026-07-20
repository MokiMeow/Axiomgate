# Phase 2 - Environment Guard

> Historical phase plan. Use [TASKS.md](TASKS.md) and the [implementation status](../engineering/21-IMPLEMENTATION-STATUS.md) for current completion claims.

Aligned to board tasks **G1-G5** (core) and **X4-X5** (stretch). Capability-discovery generalization is post-hackathon; the core supports only the execution mechanisms required by the demo mission.

## Outcome

Only correctly targeted and explicitly authorized semantic actions can be executed during a mission, enforced at the Codex hook boundary.

## Core subtasks (G1-G5)

- Resolve identity: gh identity, git remote, Vercel project/team; block ambiguity or mismatch (G1).
- Verify deploy-target existence and ownership via GitHub/Vercel API before any publish/deploy action; capture the proof as evidence (G1).
- Implement the mission allow/deny/approval policy over the demo action set: `repository.read`, `file.modify`, `branch.create`, `pull_request.create`, `preview.deploy`, `production.deploy`, `verification.run` (G2).
- Integrate the live-proven `PreToolUse` machine-JSON deny and the fixture-tested `PermissionRequest` entry with the policy engine: deny-wins, fail-closed config-hash check at mission start, every received decision persisted as evidence (G3). The non-interactive PermissionRequest limitation is recorded in the compatibility document.
- Implement approval binding: exact command/argument hash, expiry, single-use; dashboard + CLI surfaces; Telegram extended from PatchPilot `telegram`/`approval` modules (G4).
- Store and resolve credential handles outside model context; redact secret-bearing output (G4).
- Enforce intent boundaries: a proposed action above the current level becomes an approval request, never an automatic operation (G3).
- Negative test suite (G5) - see Tests.

## Stretch subtasks (X4-X5 - only after G1-G5 are verified)

- X4: equivalent semantic action through shell CLI and MCP tool fixture receives the identical policy verdict at the hook.
- X5: deferred malicious capability-description analysis. ADR-014 prevents importing PatchPilot source; any future implementation needs an explicit supported interface and its own verification evidence.

## Explicit non-work

Do not build: a skill installer or migration tool; duplicate-skill detection; a central MCP registry; provider configuration generators; an MCP broker or gateway; plugin conversion or marketplace functionality; general trust/risk static analysis of scripts and executables (post-hackathon; see [`docs/design/05-ENVIRONMENT-GUARD.md`](../design/05-ENVIRONMENT-GUARD.md)).

## Core tests (G5)

- wrong GitHub account blocks publish;
- wrong or non-existent Vercel target blocks preview;
- action substitution after approval is denied (bound hash mismatch);
- argument or target change after approval is denied;
- stale/expired approval is denied;
- denied production action stays denied;
- missing or ambiguous identity fails closed;
- effective-permission mismatch is recorded as evidence;
- secret-bearing output is redacted.

## Exit criteria

A publish or preview action cannot proceed with ambiguous identity, insufficient authority, a denied semantic action, stale approval, changed command/target, or an unverifiable hook configuration.
