# Phase 4 - Verification Engine and PatchPilot

Aligned to board tasks **V1-V4** (ADR-008, ADR-010). PatchPilot is a web/worker/CLI/MCP/core monorepo - see `docs/09`. Browser checks are stretch-only (X1); maintainability beyond a diff-size warning is post-hackathon.

## Outcome

A real Codex change is tested, remediated, and reverified through the integrated PatchPilot engine, with evidence attached to mission criteria.

## Subtasks

- Mission-level verification API over `packages/core` (typed runs, events, findings) - the smallest stable boundary.
- Verification plan derived from acceptance criteria + diff.
- Execute the target repo's own test suite via the validation runner.
- Execute scanners: OSV, Gitleaks, Semgrep (verify WSL availability on the demo machine), secret scan.
- Finding lifecycle: candidate → validated → remediation (Codex, within mission authority) → rerun.
- Stale-evidence invalidation on new commits.
- Verification stage displayed in the mission timeline (web dashboard).
- Existing PatchPilot regression suite passes after integration; migration is reversible.

## Tests

- existing PatchPilot regression suite;
- finding lifecycle (incl. false-positive validation);
- remediation + rerun;
- cancelled run;
- large-output handling;
- stale-evidence invalidation.

## Exit criteria

No overall pass appears while required checks are missing, stale, failed, or unverified; a real Codex change flows through end to end.
