---
name: axiomgate-governance
description: Enforce identity, authority, approval, admissible evidence, and proof for AxiomGate missions. Use in governed workspaces, before publish or deploy actions, and before claiming completion.
---

# Govern AxiomGate missions

## When to use

Use this workflow when a repository contains `.axiomgate` mission state, before any publish or deploy action, and whenever an agent is about to claim a mission is complete.

## Governed workflow

- `axiomgate mission create --objective "<objective>" --project <path>`: compile a bounded, versioned mission contract.
- `axiomgate mission run <id> --project <path>`: launch the governed Builder with hooks, sandbox, model plan, and Runway capture.
- `axiomgate mission verify <id> --project <path>`: run required tests and scans and store admissible evidence.
- `axiomgate mission status <id> --project <path>`: inspect criterion verdicts, evidence references, and the completion gate.
- `axiomgate mission receipt <id> --project <path>`: generate the evidence-derived Build Receipt.
- `axiomgate receipt verify <file>`: verify a receipt offline, including tamper and false-green checks.
- `axiomgate replay all`: run the credential-free wrong-target, approval-binding, and evidence-gate regressions.
- `axiomgate telegram watch --project <path>`: relay allowlisted approval requests and redacted mission-stage updates.
- `axiomgate verify-enforcement`: prove the installed Codex hook denial contract; use `--offline` only for configuration validation.
- `axiomgate runway status --project <path>`: show source-labelled capacity, reset, and banked-reset data without inventing values.

## Enforcement rules

- Resolve identity and prove deploy-target existence and ownership before publish or deploy. Stop on unavailable or mismatched results.
- Respect the mission boundary and action policy. Never broaden authority or substitute a command, target, identity, or mechanism after approval.
- Treat hook denials as final. Do not retry a denied command; use the recorded approval flow when policy requires approval.
- Accept only fresh `command`, `api`, or `hook` evidence. Model output and verifier prose are advisory, not evidence.
- Never claim completion unless the mission status command reports the proof gate as `COMPLETE`. Report every blocker, stale record, waiver, and permission mismatch.
