# Evaluation Replay Lab

## Goal

Let judges reproduce the core controls without personal accounts, paid quota, or long agent runs.

## Build Week replay scenarios (exactly three - ADR-008)

1. **Wrong identity / wrong target blocked.** A publish/deploy targets a repository or Vercel project that does not belong to the profile's account; Environment Guard denies it at the hook and records the denial as evidence.
2. **Approved command mutated and denied.** An action is approved, then the command/arguments/target change; the bound approval is void and execution is blocked.
3. **Missing evidence blocks completion.** All criteria pass except one with no fresh machine evidence; the mission cannot complete until the criterion passes or is visibly waived.

Run each with `axiomgate replay <scenario>`.

## Post-hackathon scenarios (documented intent, not Build Week work)

Quota-policy changes, banked-reset expiry, model-transition checkpoints, malicious/over-broad capability descriptions, multi-mechanism action equivalence, loop-triggered intervention, maintainability regression, remediation rerun replay, semantic-approval rollback records.

## Fixture requirements

- deterministic;
- synthetic;
- sanitized;
- versioned;
- documented;
- no hidden network dependency;
- clear expected output;
- fast enough for judge use.

## Live versus replay

Every UI event and receipt must identify `LIVE`, `SANDBOX`, or `REPLAY`. Never present replayed events as live Codex execution.

## Command

One-command replay from a clean clone, for example:

```text
npx axiomgate replay wrong-target
```

Choose the final command names during implementation.
