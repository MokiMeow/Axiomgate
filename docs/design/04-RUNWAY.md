# Runway

## Goal

Help the user spend AI capacity intentionally while preserving quality and verification. Runway is advisory by default and guarded when the user opts in.

## Build Week scope (ADR-008, ADR-015, ADR-016)

- token/reasoning actuals per mission from `codex exec --json` (the ledger);
- **real capacity snapshot from the Codex app-server `account/rateLimits/read`** (usedPercent, window duration, resetsAt, planType, banked `rateLimitResetCredits`), labelled `source: "codex-app-server"`, confidence high; degrades to UNKNOWN if the method is unavailable - never invents message counts (ADR-015);
- verification reserve computed against the real remaining window;
- expiring banked-reset reminder from real credit expiry;
- simple loop detection;
- post-limit checkpoint and resume;
- phase-specific GPT-5.6 tier/effort recommendations, including `max` reasoning for the highest-risk single-chain phase (ADR-016).

## Future coverage (not Build Week; do not implement)

OpenRouter/multi-model balances, API-budget billing, team pools, multiple providers, and mid-mission provider switching as first-class normalized scenarios. (The Codex 5-hour + weekly window, plan type, and banked resets ARE now in Build Week scope via ADR-015's real app-server source.)

## Normalized capacity source

Each live Codex source records `limitId`, a derived window label, `usedPercent`, `resetsAt`, `planType`, credit balance/unlimited state, banked-reset metadata, source `codex-app-server`, confidence `high`, and capture time. Missing fields remain absent; AxiomGate never derives message counts.

When the App Server is unavailable, `.axiomgate/runway.json` may supply manual plan, reset-count, and reset-expiry fields. Every manual field retains `source`, `confidence`, and `capturedAt`. With neither source available the UI prints `UNKNOWN` plus the reason.

## Planned capacity versus actual usage

The shipped ledger records actual input, output, and raw usage objects from `codex exec --json`. Runway does not invent a token-to-capacity conversion or provider-authoritative task estimate.

The verification reserve compares real weekly `usedPercent` with the mission's `reservePercent`. An optional projected build percentage is used only when supplied by an observed source; otherwise it is displayed as `UNKNOWN`. A separate ledger check warns when cumulative Builder tokens exceed the configured share before any verification run. Both warnings are advisory and never block execution.

## Model Director

The compiler recommends Luna/Light for scouting, Sol/High for normal builds, Sol/Max when a security-sensitive objective has high or critical criteria, Terra/Medium for remediation, and Terra/High for independent verification. Each entry records a rationale; users may override model and effort at the run/review boundary.

Model changes require user awareness. Escalation that increases paid or scarce capacity requires explicit approval.

## Reserve

Track expiring capacity. Remind the user that a banked reset or promotion will expire, but never create unnecessary work or activate it automatically.

## Loop detection

Detect:

- the same command failing with the same normalized error signature at least three times;
- at least three consecutive runs with zero file changes and zero new evidence.

Recommend pause and diagnosis, task split, or model escalation. Other loop classes remain future work.

## Continuity (post-hackathon - do not implement for Build Week)

Before model/session/provider transition: calculate continuity risk, create structured checkpoints, compact only if beneficial, preserve the original session, validate state in the new model, prefer an independent fork for verification. Build Week keeps only the post-limit checkpoint/resume above.

## Control modes

This release is advisory. Paid usage, banked-reset activation, and model changes are never automatic. Guarded budget modes and hard ceilings are post-hackathon work.

## Ledger

Record actual token usage per run. Capacity observations and manual fallback data remain in the source-labelled Runway snapshot; mission events record warnings, reminders, checkpoints, and loop recommendations.

## Data-source reality (normative)

Every displayed number carries its source and confidence. Verified reality as of 2026-07-16:

| Data | Source | Support level |
|---|---|---|
| Per-mission token/reasoning actuals | `codex exec --json` usage output | **Official, reliable - the ledger's foundation** |
| 5-hour / weekly limit percentages | Codex App Server `account/rateLimits/read` | First-party source, confidence high; short-lived cache |
| Reset times and banked resets | Same App Server response, including `rateLimitResetCredits` | First-party source when present; manual fallback supported |
| Plan type and credit balance/unlimited flag | Same App Server response | First-party source when present |
| Message counts or token-to-percent conversion | No verified source | Unsupported; never derive or display |
| Other providers, API billing, and shared workspace pools | No shipped adapter | Unsupported in this release |

Build Week implements the actuals ledger, live-first/manual-fallback capacity, verification reserve, loop detection, source/confidence labels, expiring-reset reminders, and post-limit resume guidance. Multi-provider normalization is deferred.

## Post-limit resume plan

When a rate limit interrupts a mission: create a checkpoint, display the observed reset time and any banked-reset option (never auto-activate), and offer a one-command resume (`axiomgate mission resume`) that restores canonical mission state. This converts the single most-reported Codex frustration into a recovery feature.

## Honest limitations

The App Server method is version-sensitive and may be unavailable or return malformed data. AxiomGate degrades to a source-labelled manual snapshot or `UNKNOWN`; it does not scrape dashboards or infer missing values. Never show an unlabelled quota number.
