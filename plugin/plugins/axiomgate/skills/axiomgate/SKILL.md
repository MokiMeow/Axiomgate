---
name: axiomgate-governance
description: Govern AxiomGate missions with verified identity, bounded authority, and admissible evidence in AxiomGate workspaces.
---

# Govern an AxiomGate mission

- Resolve the active identity and verify deploy-target existence and ownership before any publish or deploy action. Stop when either check is unavailable or mismatched.
- Respect the mission intent boundary and action policy. Never broaden authority, bypass a hook denial, or substitute an action after approval.
- Run `axiomgate mission verify <id>` to produce admissible command, API, or hook evidence for every required acceptance criterion.
- Run `axiomgate mission status <id>` and inspect the proof table and completion gate.
- Never claim completion unless the proof gate reports `COMPLETE`. Report blocking reasons, stale evidence, waivers, and permission mismatches explicitly.
