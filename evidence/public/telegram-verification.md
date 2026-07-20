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
pnpm test       28 files passed; 286 tests passed; 1 optional live identity test skipped
pnpm build      PASS; bundled CLI dist/index.js 819.3kb
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
4. Edited the original card to the concise **Approved once** outcome.
5. Received a repeated post-decision callback, returned the already-decided response, and did not grant again.

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

After the live re-tap proof, presenter feedback identified the visible approved-status button as confusing because it resembled a second approval action. The final UI keeps only **Details** on approved, denied, expired, and consumed cards. Stale, duplicated, or already-in-flight decision callbacks still follow the tested already-decided/expired path and cannot re-grant authority.

No token, full chat ID, private path, raw environment value, or source payload is present in this evidence. G4 and the Environment Guard layer are now `VERIFIED`.

## Real-workspace lifecycle and message UX proof

Status: **PASS** on 2026-07-20.

The relay was exercised again against the real ignored demo workspace containing the governed brute-force-lockout diff. This was not a hand-authored message test. The product generated every card from stored mission, hook, run, verification, proof, approval, and live Codex-capacity records.

The human-facing naming contract is now explicit:

- **Mission** is the objective supplied to `axiomgate mission create --objective`.
- **Workspace** is the governed project folder name.
- Random mission/request IDs appear only under **Audit reference** in the expanded approval details.
- SHA-256 values remain in canonical evidence and integrity records but are not rendered in normal Telegram cards.

The live sequence was:

1. Created a fresh `MODIFY_LOCAL` mission for the real lockout objective.
2. Ran a governed Luna/Light inspection with hooks active.
3. Submitted `git push origin main` to the hook only. It was classified as `pull_request.create`, denied because PUBLISH exceeds MODIFY_LOCAL, recorded, and delivered as **Action blocked**. The command was not executed.
4. Ran `axiomgate mission verify`. The real diff, build, regression, lockout, dependency, and secret checks all passed.
5. Ran the proof gate and generated the receipt. Five criteria were proven and the outcome was COMPLETE.
6. Created a separate PUBLISH approval-review mission. The fixture's synthetic remote first produced the expected NOT_FOUND wrong-target denial. The local remote was then temporarily pointed at the user-owned public repository, the mission snapshot was refreshed, and the hook verified ownership through `gh api`. The synthetic remote was restored before the command exited.
7. The exact `git push origin agent/telegram-ux-proof` request entered the canonical approval store and produced a Telegram card with **Approve once**, **Deny**, and **Details**. No push occurred.
8. The presenter denied the request in Telegram. The original message was edited to the terminal denied card, the canonical store recorded `surface: telegram`, and the pending count returned to zero.

The live watcher exit summary was:

```text
Telegram relay stopped: cards=1; notifications=7; failures=0
```

Representative live stage-card content:

```text
Run complete
Mission: Validate the brute-force lockout implementation...
Workspace: target-app-live
Model: gpt-5.6-luna / Light
Runway: 12% used, 88% remaining
Reset: 25 Jul 2026 03:25 UTC
Banked resets: 0
Plan: pro
Source: codex-app-server/high

Verification complete
Result: PASS
Checks completed: 6
Findings: 0
Model: gpt-5.6-terra / High
Meaning: Required evidence was evaluated against the current workspace revision.

Proof receipt ready
Outcome: COMPLETE
Proof: 5 criteria proven
Meaning: The receipt is ready for offline integrity verification.
```

The approval card named the objective and workspace, showed the exact redacted command, target, verified identity, policy reason, risk, one-use scope, and expiry. The expanded details added semantic action, mission/action authority, timing, and audit references. The denied outcome retained only the readable mission, workspace, decision, action, and target. No outcome card offered another approval action.

One preliminary hook payload intentionally failed closed as malformed before the complete required payload was submitted. It produced a fail-closed notification and no command execution. The corrected payload produced the expected policy-specific denial recorded above.

Privacy inspection found no Telegram token, full chat ID, source payload, command hash, evidence hash, receipt chain hash, or private filesystem path in any rendered card. All rendered message tests also assert that em dashes and en dashes are absent.

No remediation card was generated during this live mission because verification produced zero findings. Its rendering remains fixture-verified; the live record does not claim a remediation that did not occur.
