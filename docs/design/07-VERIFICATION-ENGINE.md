# Verification Engine

## Goal

Prove the implementation works, is safe, and has not unnecessarily damaged maintainability.

## Foundation

Integrate the existing PatchPilot engine - `packages/core` (scanners, validation runner, Codex remediation, audit hash chains) surfaced through the existing Next.js dashboard and worker. PatchPilot is a web product; there is no desktop app. Treat PatchPilot as pre-existing work and clearly record Build Week additions.

Verified pre-existing capabilities (2026-07-14 audit): OSV/OSV-Scanner, Gitleaks, Trivy, Syft, Semgrep-via-WSL; EPSS/CISA-KEV/NVD enrichment; reachability triage; validation runner (npm install/ci/test/build); Codex remediation in secret-scrubbed disposable workspaces; deterministic npm fixer; live-verified GitHub PR flow; hash-chained audit receipts; HMAC Telegram approvals.

**Not pre-existing (do not claim as integration):** browser/e2e verification, maintainability/complexity analysis, arbitrary test-suite orchestration beyond the validation runner, non-npm remediation. Browser verification is a stretch goal; maintainability is deferred except a diff-size warning.

## Verification plan

Derive checks from:

- acceptance criteria;
- changed files;
- security boundaries;
- dependencies;
- project test configuration;
- deployment target;
- risk classification;
- browser behavior (only if stretch task X1 ships - otherwise browser evidence types are marked `UNKNOWN`).

## Check families

Build Week (all backed by existing PatchPilot machinery or the target repo's own commands):

- formatting;
- lint;
- type checking;
- unit tests (target repo's own suite via validation runner);
- integration tests (target repo's own suite);
- dependency vulnerabilities (OSV/Trivy);
- secret scanning (Gitleaks + redaction tests);
- SAST (Semgrep; WSL required on Windows - verify on the demo machine in Phase 0);
- risky diff analysis (size/paths heuristic);
- deployment health (URL probe - never deploys);
- authorization negative tests (mission-policy suite).

Stretch (only after the core mission passes end to end): one scripted Playwright browser check on the demo fixture app.

Deferred beyond Build Week: general browser/e2e orchestration, console/network capture, API contract tests, migration tests, configuration review, maintainability/entropy analysis.

## Maintainability guard

**Build Week (stretch task X2 only):** a diff-size and risky-path warning. Nothing more.

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
