# Phase 4 - Verification Engine and PatchPilot

> Historical phase plan. Use [TASKS.md](TASKS.md) and the [implementation status](../engineering/21-IMPLEMENTATION-STATUS.md) for current completion claims.

Aligned to board tasks **V1-V4** (ADR-008, ADR-010, ADR-014). This file records the implemented phase scope. PatchPilot remains external and is consumed only through the published CLI; browser and maintainability work are post-hackathon.

## Outcome

A real Codex change is tested, remediated, and reverified through the integrated PatchPilot engine, with evidence attached to mission criteria.

## Subtasks

- Mission-level typed verification plan, runs, events, and findings in `@axiomgate/core`.
- Verification plan derived from acceptance criteria + diff.
- Execute the target repo's detected test and build commands through the shared timeout runner.
- Execute `patchpilot-cli@0.1.3 scan` for dependencies and Gitleaks or a labelled heuristic for secrets.
- Finding lifecycle: candidate → validated → remediation (Codex, within mission authority) → rerun.
- Stale-evidence invalidation on new commits.
- Verification stage displayed in the mission timeline (web dashboard).
- Published-CLI parsing is fixture-tested and the integration is verified end to end against the real vulnerable demo fixture.

## Tests

- real PatchPilot CLI output parsing, including malformed-output handling;
- finding lifecycle (incl. false-positive validation);
- remediation + rerun;
- cancelled run;
- large-output handling;
- stale-evidence invalidation.

## Exit criteria

No overall pass appears while required checks are missing, stale, failed, or unverified; a real Codex change flows through end to end.
