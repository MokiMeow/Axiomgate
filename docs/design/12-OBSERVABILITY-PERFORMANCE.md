# Observability and Performance

## Observability goals

Explain what AxiomGate is doing without leaking private content.

Track:

- mission phase;
- current model;
- capability-policy snapshot and selected execution mechanisms;
- process health;
- Runway capacity snapshot;
- context pressure;
- acceptance progress;
- findings;
- pending approvals;
- evidence freshness;
- external actions;
- recovery events.

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

## Performance baselines

Measure before optimization:

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

Store large logs externally and place summaries/references in mission context. Support streaming and cancellation.

## Reliability

- retries must be bounded;
- idempotency for external actions;
- explicit timeout types;
- process cleanup;
- crash-safe persistence;
- resumable missions;
- no UI blocking on long operations.
