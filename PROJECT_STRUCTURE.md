# Recommended Repository Structure

Map this structure onto the existing repository after Phase 0 rather than rewriting working packages blindly.

```text
apps/
  web/                  AxiomGate local web dashboard and PatchPilot views
                        (no desktop app for Build Week — ADR-009)
  cli/                  CLI surface
packages/
  axiomgate-core/       one package, layers as modules (ADR-008):
    mission/            contract, criteria, versioning, hash
    runway/             ledger, reserve, loop, snapshot, resume
    guard/              identity, policy, hooks, approvals
    runtime/            Codex session adapter, roles, mission state
    evidence/           verdicts, receipts, receipt-verify
  core/                 existing PatchPilot core (scanners, remediation,
                        audit, telegram) — reused, not rewritten
tests/
  fixtures/public/
demo/
  fixtures/
evidence/
  public/
docs/
tasks/
.local/                 ignored private artifacts
```

## Rule

One process, one core package; layers are modules, not services. Split a module into its own package only when a real dependency or deployment boundary demands it — never for conceptual symmetry. Reuse existing PatchPilot packages when they already own the responsibility cleanly.
