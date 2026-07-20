# Verification Engine

## Goal

Prove the implementation works, is safe, and has not unnecessarily damaged maintainability.

## Foundation

ADR-014 defines the shipped boundary: invoke the published `patchpilot-cli@0.1.3` through AxiomGate's shared timeout runner and parse its scan output into typed findings. PatchPilot remains a separate pre-existing project. Its source, dashboard, worker, database, and internal packages are not copied, imported, or required by AxiomGate.

The AxiomGate layer combines that dependency scan with the target repository's own detected test and build commands, a Gitleaks scan when available or a labelled diff-regex fallback, governed Codex remediation, freshness invalidation, and evidence records. Treat the broader PatchPilot capabilities documented in the pre-event audit as historical context, not as shipped AxiomGate integration.

**Not shipped:** general browser/e2e verification, maintainability/complexity analysis, arbitrary SAST orchestration, deployment-health probing, and non-Node/Python project detection beyond the implemented native checks. Missing evidence remains `UNKNOWN`; it is never silently treated as pass.

## Verification plan

Derive checks from:

- acceptance criteria;
- changed files;
- security boundaries;
- dependencies;
- project test configuration;
- deployment target;
- risk classification;
- browser behavior only when a future executor exists; this release maps such required evidence to `UNKNOWN`.

## Check families

Build Week checks implemented by the verification planner and engine:

- `git.diff` evidence for implementation criteria;
- `target.test` for a target package's `test` script or Python `pytest` project;
- `target.lockout-test` when the target package exposes the dedicated demo script;
- `target.build` for a target package's `build` script;
- `dependency.scan` through `patchpilot-cli scan <workspace>`;
- `secret.scan` through Gitleaks when available, otherwise a clearly labelled conservative diff heuristic.

Unsupported required evidence types produce an `UNKNOWN` check and prevent an overall pass.

Stretch (only after the core mission passes end to end): one scripted Playwright browser check on the demo fixture app.

Deferred beyond Build Week: general browser/e2e orchestration, console/network capture, API contract tests, migration tests, configuration review, maintainability/entropy analysis.

## Maintainability guard

**Current release:** changed files and the diff hash are recorded, but no maintainability verdict is produced.

### Post-hackathon design - do not implement during Build Week

Measure relevant deltas: duplication; cognitive complexity; dependency count; bundle size; file count; dead code; circular dependencies; unnecessary abstractions; swallowed errors. Do not fail on arbitrary metrics without project context. Findings need evidence and severity.

## Remediation cycle

1. Candidate finding.
2. Validate finding.
3. Record impact.
4. Propose fix.
5. Apply within authority.
6. Run targeted checks.
7. Run regression checks.
8. Attach fresh evidence.
9. Close or retain limitation.

## Independence

The verifier should inspect repository reality and rerun relevant checks. It must not accept the builder’s summary as proof.

## Evidence freshness

Evidence is stale when code, configuration, dependency lockfiles, environment, or contract changes invalidate it.

## No fake success

Mocks are acceptable for isolated units but cannot prove live GitHub, Vercel, credential, browser, or provider behavior.
