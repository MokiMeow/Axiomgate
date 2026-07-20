# Definition of Done

## Task-level done

A task is done only when:

- acceptance criteria pass;
- relevant tests pass now;
- formatting/lint/type checks pass;
- security/privacy impact is reviewed;
- error and cancellation paths are covered;
- evidence is stored;
- docs are updated;
- temporary artifacts are removed;
- the diff is reviewed;
- commit is created;
- limitations are recorded.

## Feature-level done

Additionally:

- UI/CLI behavior works end to end;
- persistence and migration are tested;
- restart/recovery works where applicable;
- external adapters are tested at contract and sandbox level;
- authority, semantic-action policy, action-substitution, and wrong-target tests pass;
- observability is sufficient;
- performance is measured;
- public claims match evidence.

## Mission-level done

- every required criterion is PASS or explicitly WAIVED;
- PatchPilot verification is fresh;
- Human Review Map is resolved;
- approvals and effective-permission observations are recorded;
- Git target and preview target are correct;
- production is unchanged;
- receipt is generated from stored evidence.

## Submission-level done

- clean clone setup succeeds;
- deterministic replay succeeds;
- primary live demo succeeds;
- video is publicly visible on YouTube, less than three minutes, and includes required English audio or translation;
- README is accurate;
- Build Week delta is explicit;
- Codex session ID is preserved;
- repository has no secrets or junk;
- judge can understand value in under one minute;
- all Devpost fields are complete.

## Forbidden substitutes

The following do not satisfy Done:

- model says done;
- UI screenshot only;
- test written but not run;
- mocked external action;
- stale evidence;
- disabled failing test;
- unreviewed generated report;
- task checkbox without links.
