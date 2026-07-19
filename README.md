# AxiomGate

> **Plan. Govern. Execute. Prove.**

AxiomGate is a local-first mission-control runtime for Codex. It gives Codex a bounded mission, an explainable model and capacity plan, the correct project identity, an explicit authority level, and only the actions required for the task; verifies the resulting implementation; and refuses to call work complete without evidence.

This repository pack is the implementation contract for the OpenAI Build Week project. It is intentionally documentation-first. No implementation claim is valid until code, tests, runtime evidence, and documentation agree.

## Product in one sentence

AxiomGate turns an open-ended Codex request into a governed, quota-aware, identity-safe, verifiable software mission.

## Six product layers

1. **Mission Compiler** — converts intent into acceptance criteria, constraints, evidence requirements, and action authority.
2. **Runway** — plans models, quota, cost, expiring capacity, context, continuity, and loop intervention.
3. **Environment Guard** — resolves project identity, credentials, environments, and the mission-specific policy for commands, tools, APIs, and other capabilities already available to Codex.
4. **Codex Runtime** — executes the mission through controlled Scout, Builder, and independent Verifier roles.
5. **Verification Engine** — integrates PatchPilot to test, secure, simplify, remediate, and re-verify the implementation.
6. **Evidence Gate** — connects every completion claim to evidence, directs human review, requests approvals, and emits a Build Receipt.

## Deliberate product boundary

AxiomGate does **not** attempt to become a universal skill installer, plugin marketplace, MCP manager, or cross-agent configuration synchronizer during Build Week. Skills, MCP servers, CLIs, native integrations, browser automation, and APIs are treated as capability mechanisms. Environment Guard evaluates what actions they expose, whether those actions are relevant and trusted, which identity they use, and whether the Mission Contract permits them.

## Start here

Every coding agent must read these files in order before changing source code:

1. [`START_HERE.md`](START_HERE.md)
2. [`MASTER_BUILD_CONTRACT.md`](MASTER_BUILD_CONTRACT.md)
3. [`AGENTS.md`](AGENTS.md)
4. [`docs/00-PRODUCT-VISION.md`](docs/00-PRODUCT-VISION.md)
5. [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md)
6. [`docs/23-DEFINITION-OF-DONE.md`](docs/23-DEFINITION-OF-DONE.md)
7. [`tasks/TASKS.md`](tasks/TASKS.md)
8. The phase document for the task being implemented
9. [`docs/26-OFFICIAL-RULES-COMPLIANCE.md`](docs/26-OFFICIAL-RULES-COMPLIANCE.md) before hackathon-facing work

The agent must then produce the pre-implementation assessment described in `START_HERE.md`. It must not modify production code before that assessment is reviewed.

## Repository truth rules

- A checkbox, status label, README claim, screenshot, or assistant message is not proof of implementation.
- A feature is complete only when its code, automated tests, runtime behavior, evidence, and documentation all agree.
- Unknowns must be marked unknown. Estimates must include their source and confidence.
- Mocked behavior must be visibly labelled and must never be presented as live functionality.
- No secret, browser cookie, raw access token, private test record, or user data belongs in Git.
- Raw local artifacts belong under `.local/`; sanitized, reproducible hackathon evidence belongs under `evidence/public/`.
- Existing PatchPilot functionality is integrated and improved, not silently rewritten or claimed as newly created.

## Documentation map

See [`FILE_INDEX.md`](FILE_INDEX.md) for every document and its purpose.

## Enforcement, not narration

Environment Guard enforces policy through official Codex extension points — hooks (`PreToolUse`, `PermissionRequest`, deny-wins blocking), sandbox and permission-profile configuration, and the Codex App Server/SDK for session control. Governance that only asks the model to behave is not governance; every allow, deny, and approval decision is executed at the hook boundary and recorded as evidence.

## Current status

The Build Week implementation now covers the governed mission spine end to end. See [`docs/21-IMPLEMENTATION-STATUS.md`](docs/21-IMPLEMENTATION-STATUS.md) for evidence-backed subsystem status.

Update [`docs/21-IMPLEMENTATION-STATUS.md`](docs/21-IMPLEMENTATION-STATUS.md) as work proceeds. Never mark a subsystem complete from memory or model confidence.
