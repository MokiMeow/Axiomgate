# Observability and Performance

## Observability goals

Explain what AxiomGate is doing without leaking private content.

The shipped records track:

- mission phase;
- current model;
- capability-policy snapshot and selected execution mechanisms;
- Runway capacity snapshot;
- acceptance progress;
- findings;
- pending approvals;
- evidence freshness;
- external actions;
- recovery events.

General process-health telemetry and context-pressure measurement remain future work.

## Structured events

Use typed events with correlation IDs. Avoid parsing decorative console text as the primary system contract.

## Redaction

Redact:

- tokens;
- cookies;
- authorization headers;
- secret environment variables;
- private URLs;
- personal account information;
- sensitive source fragments in remote notifications.

## Future performance baselines

No repository-wide benchmark claim is made in this release. A future benchmark pass should measure:

- dashboard startup;
- mission creation;
- capability discovery and normalization;
- semantic-action policy compilation;
- Codex launch;
- event persistence;
- large-log ingestion;
- verification startup;
- receipt generation;
- memory while idle and active;
- disk growth per mission.

## Performance budgets

Set budgets only after baseline. Store measured values and environment information. Never invent benchmark claims.

## Large outputs

Command output is bounded by the shared timeout runner, hashed into evidence, and referenced from local state. Codex JSONL is parsed as it arrives; timeouts and interruptions create checkpoints. General large-log externalization and user-driven cancellation remain future work.

## Reliability

- retries must be bounded;
- idempotency for external actions;
- explicit timeout types;
- process cleanup;
- crash-safe persistence;
- resumable missions;
- no UI blocking on long operations.
