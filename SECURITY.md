# Security Policy

## Security posture

AxiomGate controls agents that can read source code, execute commands, access credentials, call external services, and mutate repositories. Fail closed when authority, identity, or evidence is ambiguous.

## Reporting

Record discovered security issues privately. Do not place exploit details, tokens, cookies, user data, or sensitive local paths in public issues or evidence.

## Required controls

- secrets stored outside model-visible configuration;
- scoped credential handles;
- explicit intent boundaries;
- semantic approvals;
- capability source, version, and integrity metadata when available;
- prompt-injection classification;
- permission request/approval/application/observation reconciliation;
- append-only approval and evidence events;
- redaction before persistence;
- deny-by-default production actions;
- trusted path validation for local commands;
- no silent browser-profile reuse.

## Security completion

A security-sensitive feature is incomplete until negative tests demonstrate that forbidden actions remain forbidden.
