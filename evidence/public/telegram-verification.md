# Telegram approval relay verification

Date: 2026-07-20 IST

## Scope and protocol

AxiomGate implements the optional Telegram surface with the Bot API `getUpdates` long-polling method. It does not configure a webhook or expose a listener. Inline callback payloads contain only a deterministic short local approval reference and one verb; tests enforce Telegram's 64-byte limit. The relay calls `answerCallbackQuery` for authorized taps and edits the original message for terminal outcomes.

Provider reference: <https://core.telegram.org/bots/api>

Configuration is read only from `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` in the process environment or ignored `.local/telegram.env`. This evidence contains no token, full chat ID, private path, raw diff, source payload, or environment value.

## Fixture proof

Targeted command:

```text
pnpm test -- --run packages/axiomgate-core/test/telegram.test.ts
```

Observed result:

```text
Test Files  1 passed (1)
Tests       21 passed (21)
```

The fixture suite covers:

- normative escaped/truncated card fields, all seven semantic labels, short callbacks, details, and bound hash preservation;
- Telegram approve/deny records through the same locked canonical store as CLI approvals;
- single-use consumption with the persisted run ID, re-tap behavior, expiry, multiple requests, and CLI-versus-Telegram races;
- ignored forwarded callbacks from non-allowlisted chats with only `***last4` persisted;
- bounded transient retries, non-blocking delivery failure, restart-safe update offsets, notification dedupe, and the 20-message session cap;
- redaction markers and fabricated-token non-persistence; and
- GUARD, RUN, VERIFY, remediation, PROVE, and RUNWAY notification rendering, including configurable usage threshold and approvals-only mode.

Full repository gates:

```text
pnpm typecheck  PASS
pnpm test       28 files passed; 279 tests passed; 1 optional live identity test skipped
pnpm build      PASS; bundled CLI dist/index.js 810.9kb
```

## Live Bot API proof

Status: **PENDING**.

An ignored `.local/telegram.env` file was present during the initial bounded probe. The Bot API round trip returned `404 Not Found`; no bot identity was authenticated. At the final gate the file was absent, and `telegram test` reported configuration unavailable. A real approval card was therefore not sent, and Details/Approve/re-tap interactions are not claimed. No credential or full chat identifier appeared in command output or persisted evidence.

The implementation and local security matrix are verified, but G4 and the Environment Guard layer remain `IN_PROGRESS` until a valid presenter credential completes the real card/details/approve/re-tap proof.
