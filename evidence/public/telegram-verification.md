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
pnpm build      PASS; bundled CLI dist/index.js 812.7kb
```

## Live Bot API proof

Status: **PASS**.

The presenter supplied a valid full BotFather token and numeric chat allowlist through ignored `.local/telegram.env`. The safe configuration probe authenticated the bot without printing the credential:

```text
AXIOMGATE / telegram test · Bot API round trip
Bot     @Axiomgate_bot
Result  PASS
```

A disposable mission under ignored `.local/` produced a canonical pending `preview.deploy` request bound to the exact command hash. The live watcher then completed this sequence:

1. Sent one newly formatted approval card to the allowlisted chat.
2. Received the **Details** callback and sent the full redacted details card.
3. Received **Approve once** and wrote the canonical approval record.
4. Edited the original card to the concise **Approved once** outcome while retaining an **Approved once (tap for status)** button.
5. Received a repeated post-decision tap, returned the already-decided callback response, and did not grant again.

Sanitized stored result:

```text
status: APPROVED
surface: telegram
approver: telegram:***3884
singleUse: true
approval decision events: 1
card outcome: APPROVED
persisted chat identifier: sha256 hash only
```

The update offset advanced across Details, approval, and repeated status callbacks, while exactly one approval decision event remained. No deploy command was executed. The disposable hook-generated attempt first failed closed because the shared runner could not resolve shell-only GitHub/Vercel commands in that workspace; the transport proof therefore created the pending request through the same exported canonical approval-store API and records this limitation rather than weakening identity enforcement.

No token, full chat ID, private path, raw environment value, or source payload is present in this evidence. G4 and the Environment Guard layer are now `VERIFIED`.
