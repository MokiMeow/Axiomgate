# Runway

## Goal

Help the user spend AI capacity intentionally while preserving quality and verification. Runway is advisory by default and guarded when the user opts in.

## Build Week scope (ADR-008, ADR-015, ADR-016)

- token/reasoning actuals per mission from `codex exec --json` (the ledger);
- **real capacity snapshot from the Codex app-server `account/rateLimits/read`** (usedPercent, window duration, resetsAt, planType, banked `rateLimitResetCredits`), labelled `source: "codex-app-server"`, confidence high; degrades to UNKNOWN if the method is unavailable — never invents message counts (ADR-015);
- verification reserve computed against the real remaining window;
- expiring banked-reset reminder from real credit expiry;
- simple loop detection;
- post-limit checkpoint and resume;
- phase-specific GPT-5.6 tier/effort recommendations, including `max` reasoning for the highest-risk single-chain phase (ADR-016).

## Future coverage (not Build Week; do not implement)

OpenRouter/multi-model balances, API-budget billing, team pools, multiple providers, and mid-mission provider switching as first-class normalized scenarios. (The Codex 5-hour + weekly window, plan type, and banked resets ARE now in Build Week scope via ADR-015's real app-server source.)

## Normalized capacity source

Every source includes:

- provider;
- account/profile handle;
- kind;
- amount and unit;
- reset time;
- expiry time;
- paid status;
- activation requirement;
- source of observation;
- confidence;
- last updated time.

## Planned capacity versus actual usage

The initial estimate is a **confidence-labelled heuristic** derived from exactly four inputs: task classification (from the contract), selected model tiers and effort (from the model plan), phase count, and token actuals from previous local missions (when any exist). It is presented as a likely range with stated assumptions and is **never presented as provider-authoritative**. With no local history, the estimate is labelled `LOW_CONFIDENCE (no history)`.

Return:

- likely range (min–max);
- confidence label and assumptions;
- key cost drivers;
- reserved verification capacity.

The ledger then records actuals from `codex exec --json` against this plan. Never present exact precision when unavailable.

## Model Director

Recommend models by phase using:

- task ambiguity;
- security sensitivity;
- blast radius;
- repository familiarity;
- failed attempts;
- context pressure;
- remaining capacity;
- test coverage;
- deadline;
- user quality preference.

Model changes require user awareness. Escalation that increases paid or scarce capacity requires explicit approval.

## Reserve

Track expiring capacity. Remind the user that a banked reset or promotion will expire, but never create unnecessary work or activate it automatically.

## Loop detection

Detect:

- same failure signature;
- repeated same command;
- edit/revert oscillation;
- unchanged acceptance progress;
- duplicated parallel work;
- rising context without new evidence.

Recommend pause, checkpoint, diagnosis, task split, or model escalation.

## Continuity (post-hackathon — do not implement for Build Week)

Before model/session/provider transition: calculate continuity risk, create structured checkpoints, compact only if beneficial, preserve the original session, validate state in the new model, prefer an independent fork for verification. Build Week keeps only the post-limit checkpoint/resume above.

## Control modes

- Advisory
- Ask before paid usage
- Guarded
- Hard ceiling

Hard ceilings must create a safe checkpoint before stopping where possible.

## Ledger

Record estimates, actual observed capacity, interventions, approvals, model changes, expiring capacity decisions, and uncertainty.

## Data-source reality (normative)

Every displayed number carries its source and confidence. Verified reality as of 2026-07-14:

| Data | Source | Support level |
|---|---|---|
| Per-mission token/reasoning actuals | `codex exec --json` usage output | **Official, reliable — the ledger's foundation** |
| 5-hour / weekly limit percentages | CLI `/status` (interactive), private `GET /api/codex/usage` (undocumented, may change; first-party surfaces have disagreed publicly) | Observation only, medium confidence, always labelled |
| Banked resets / promo capacity | ChatGPT UI; announced mechanics (one free reset for Go/Plus/Pro/Business, 30-day validity) | Manual entry + reminder; no API |
| API billing | Official platform usage/billing endpoints | Supportable |
| Subscription message bands | Help-center ranges (wide, dynamically adjusted) | Historical/manual, ranges only |
| Shared workspace pools | None known | Unsupported — say so |

Build Week implements: the actuals ledger, the verification reserve, loop detection, one normalized `CapacitySource` type with source+confidence labels, and expiring-capacity reminders. The full 14-scenario normalization matrix is deferred (ADR-008).

## Post-limit resume plan

When a rate limit interrupts a mission: create a checkpoint, display the observed reset time and any banked-reset option (never auto-activate), and offer a one-command resume (`axiomgate mission resume`) that restores canonical mission state. This converts the single most-reported Codex frustration into a recovery feature.

## Honest limitations

Provider subscription data may not be available programmatically. Use source/confidence labels and support manual or user-authorized observations without making scraping essential. Never show an unlabelled quota number: a governance tool that is wrong about the thing it governs loses trust permanently.
