# V1-V4 Verification Engine evidence

Captured 2026-07-15 IST. Paths below are repository-relative or sanitized. The fixture and its runtime state remain under ignored `.local/verifytest/`.

## Published PatchPilot CLI interface observed

Both commands were executed through AxiomGate's timeout runner:

```text
npx --yes patchpilot-cli@0.1.3 --help
npx --yes patchpilot-cli@0.1.3 scan --help
status: SUCCESS
exit: 0
```

Observed v0.1.3 contract:

```text
patchpilot scan [path]
--json
--fail-on <critical|high|medium|low> (default: findings do not change exit status)
```

The CLI scans npm and PyPI dependencies against the live OSV database and reports reachability (`imported`, unused, or transitive). No Semgrep or secret-scan command is exposed. AxiomGate therefore uses the target repository's native test/build scripts, invokes this exact published dependency scanner, prefers gitleaks when installed, and otherwise labels its conservative added-diff regex as `builtin-regex-heuristic`.

The actual integration invocation is:

```text
npx --yes patchpilot-cli@0.1.3 scan <workspace> --json --fail-on low
```

`gitleaks version` returned `UNAVAILABLE`/127 on this machine, so the live proof used the labelled heuristic fallback.

## Automated verification

Final commands and real results:

```text
pnpm typecheck
Scope: 2 of 3 workspace projects
packages/axiomgate-core typecheck: Done
apps/cli typecheck: Done

pnpm test
Test Files  14 passed (14)
Tests       140 passed | 1 skipped (141)

pnpm build
Scope: 2 of 3 workspace projects
packages/axiomgate-core build: Done
apps/cli build: Done
```

The skipped test is the existing optional `AXIOM_LIVE_SMOKE=1` identity smoke test. Verification coverage includes required-check/overall-state propagation, real v0.1.3 JSON parsing, malformed-output `UNKNOWN`, native command result mapping, heuristic secret detection, default workspace identity resolution, persisted typed events/Evidence, remediation planning, affected-only reruns, and evidence freshness.

## Real vulnerable-fixture proof

Fixture: a committed npm project with `node --test`, `node --check index.js`, and an imported `lodash@4.17.11` dependency.

Initial `axiomgate mission verify` output:

```text
Criterion | Check | State
criterion_implement | git.diff | PASS
criterion_implement | target.build | PASS
criterion_regression | target.test | PASS
criterion_security | dependency.scan | FAIL
criterion_secrets | secret.scan | PASS
Overall: FAIL
Findings: 7
Evidence: 5
```

PatchPilot returned 7 reachable OSV findings (1 critical, 3 high, 3 medium). The dependency Evidence record captured exit 1 and output hash:

```text
sha256:3496359ae05dc7dcc5c5cefc90a02d7c998275590be5aea34dffd65f9a2d2ced
```

The fixture initially had no Git remote, so the first governed remediation failed closed with `Git remote identity is unavailable` and made no changes. A fixture-only GitHub remote was then configured under the resolved account and `mission update` regenerated the identity snapshot. This prerequisite and failure are retained in the local event log.

Governed Terra/medium remediation then changed `package.json` and `package-lock.json`. A first selected advisory moved lodash to 4.17.23 and cleared that advisory; the live OSV database still reported two newer advisories requiring 4.18.0. A second validated-finding remediation moved lodash to 4.18.0. Its automatic affected-only rerun produced:

```text
Remediation: SUCCESS (gpt-5.6-terra/medium)
target.build: PASS
target.test: FAIL
dependency.scan: PASS
Targeted verification: FAIL
```

This was an honest regression catch: an earlier timed-out `npm ci` left the ignored `node_modules/lodash` install incomplete. The targeted PatchPilot result was zero findings with output hash:

```text
sha256:5f9d5bbaa29f231a848dec1df8a682dc83e2f4f5cc84813702687f5992a312d5
```

After restoring the fixture install through the shared runner (`npm install --ignore-scripts`: exit 0, `found 0 vulnerabilities`), the final full product verification reported:

```text
criterion_implement | git.diff | PASS
criterion_implement | target.build | PASS
criterion_regression | target.test | PASS
criterion_security | dependency.scan | PASS
criterion_secrets | secret.scan | PASS
Overall: PASS
Findings: 0
Evidence: 5
```

The proof demonstrates that no model output was treated as verification Evidence: native test/build and scan records use `source: "command"`, carry output hashes, and are scoped to the current workspace revision.
