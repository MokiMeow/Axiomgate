# Evidence Gate

## Goal

Prevent unsupported completion claims and make human approval focused and understandable.

## Proof Graph

Each acceptance criterion links to evidence of the types available in the Build Week engine:

- test result;
- API response;
- Git state;
- deployment health (URL probe);
- security scan result;
- hook decision record;
- screenshot (manually reviewed);
- approval;
- waiver.

Conditional evidence types - only if the stretch work ships (X1/X2): browser trace, diff-size warning. A criterion requiring an evidence type the engine cannot produce is marked `UNKNOWN` or `BLOCKED`, never silently passed.

## Criterion state

A mission is complete only when every required criterion is:

- PASS; or
- explicitly WAIVED by an authorized user with reason and risk.

UNKNOWN and BLOCKED are not PASS.

## Human Review Map

Prioritize human attention using:

- security boundary;
- authentication/authorization;
- persistent data;
- external side effects;
- low test coverage;
- model uncertainty;
- high-complexity diff;
- independent-review disagreement.

For each review item, explain what to inspect.

## Approval Relay

Approval surfaces:

- web dashboard;
- CLI;
- Telegram;
- MCP.

All surfaces consume the same typed action request. Telegram must not receive raw secrets or excessive source content.

## Effective permission verification

Compare:

1. requested permission;
2. user-approved permission;
3. runtime-applied permission;
4. observed action.

Record mismatches.

## Build Receipt

Generate:

- mission and contract hash;
- repository, branch, commit;
- models and phases;
- capability-policy snapshot and mechanisms actually used;
- identities and targets;
- intent boundary;
- capacity estimate and actual ledger;
- findings and remediation;
- acceptance criterion verdicts;
- approvals;
- outcome;
- evidence hashes;
- limitations.

Formats:

- JSON (core);
- Markdown (core);
- HTML (post-hackathon).

## Integrity

Receipts must derive from stored events and evidence. Consider optional signing after the core flow is stable.
