# Repository Structure

This is the curated Build Week repository layout.

```text
apps/
  web/                  AxiomGate local dashboard
  cli/                  bundled CLI and MCP server
packages/
  axiomgate-core/       mission, runway, guard, runtime, verification,
                        and evidence modules
demo/
  fixtures/             sanitized judge target application
  scripts/              deterministic fixture checks
evidence/
  public/               reviewed, sanitized verification records
docs/
  design/               product and architecture blueprints
  engineering/          decisions, compatibility, quality, and status
  submission/           hackathon plan and rules compliance
  build-log/            task board, phase history, and agent preflight
.agents/                Codex skill, verifier agent, and marketplace metadata
plugins/                versioned AxiomGate Codex plugin bundle
scripts/                package, replay, receipt, and integrity checks
.local/                 ignored private artifacts, never tracked
```

## Rule

One process, one core package; layers are modules, not services. Split a module into its own package only when a real dependency or deployment boundary demands it, never for conceptual symmetry. PatchPilot remains an external published CLI integration under ADR-014; its source is not copied into this repository.
