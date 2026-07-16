# Q1-Q4 Runway real-quota verification

Verified on 2026-07-16 with `codex-cli 0.144.4` on Windows. No access token,
credential, account identifier, or private command output is present below.

## Observed Codex app-server interface

The existing `.local/ratelimit-probe.mjs` confirmed the JSON-RPC stdio sequence:

1. Spawn `codex app-server` (`codex.cmd` is resolved by the shared Windows-safe command runner).
2. Send `initialize` with `capabilities.experimentalApi: true`.
3. Send the `initialized` notification after 700 ms.
4. Send `account/rateLimits/read` with request id `1` after 1,400 ms.
5. Read the id `1` JSON-RPC response and stop the bounded child process.

The live response exposed `rateLimits`, `rateLimitsByLimitId`, and
`rateLimitResetCredits`. AxiomGate projects only window duration, used percent,
reset time, plan type, credit balance/unlimited state, and banked-reset metadata.
It does not derive or display message counts.

One earlier live attempt timed out while the app-server logged provider/plugin
refresh timeouts. AxiomGate returned `UNKNOWN` with that reason. A subsequent
bounded retry succeeded, proving both the defensive fallback and live path.

## Live CLI proof

Command:

```text
node apps/cli/dist/index.js runway status
```

Output:

```text
Runway capacity (real Codex app-server data)
Limit | Window | Used | Resets at | Plan | Source/confidence
codex | weekly | 3% | 2026-07-22T13:55:34.000Z | pro | codex-app-server/high
codex_bengalfox | weekly | 0% | 2026-07-23T01:38:31.000Z | pro | codex-app-server/high
Banked resets | 0 | codex-app-server/high
```

Command:

```text
node apps/cli/dist/index.js doctor
```

Output:

```text
node: v24.11.1
codex CLI: codex-cli 0.144.4
git repository: yes (main; clean)
Codex capacity: plan=pro; weekly used=3%; resets=2026-07-22T13:55:34.000Z [codex-app-server/high]
```

## Automated verification

`pnpm typecheck` completed for `@axiomgate/core` and `@axiomgate/cli`.

`pnpm test` result:

```text
Test Files  17 passed (17)
Tests       179 passed | 1 skipped (180)
```

The skipped test is the pre-existing opt-in identity live smoke test.

`pnpm build` completed for `@axiomgate/core` and `@axiomgate/cli`.

Coverage added in this slice includes the captured real response parser,
primary/secondary/additional limit windows, malformed input, Unix-to-ISO reset
conversion, real reserve threshold math, live/manual fallback, banked-reset
expiry, reached-limit summaries, and `max` model-plan/run-argument behavior.
