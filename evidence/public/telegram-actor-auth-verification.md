# Telegram actor authorization verification

Date: 2026-07-20 IST

Status: `PASS` for fixture coverage and a live private-chat callback.

## Finding and boundary

Before this change, callback authorization compared only
`callback.message.chat.id` with `TELEGRAM_CHAT_ID`. In an allowlisted group,
any member who could see the card could reach the canonical approve or deny
mutation.

The fixed boundary requires an allowlisted chat for every callback. If
`TELEGRAM_USER_ID` is configured, `callback.from.id` must also match that
numeric allowlist. If it is absent, only callbacks whose Telegram chat type is
`private` are accepted. Rejected callbacks receive this toast:

```text
approvals require a private chat or an allowlisted user
```

The canonical approval schema is unchanged. Its existing actor field records
only a masked clicking-user ID and chat type, for example:
`telegram:user=***3884;chat=private`.

## Regression proof

Before implementation, the new cases reproduced the broken boundary:

```text
Test Files  1 failed (1)
Tests       6 failed | 20 passed (26)
```

After implementation:

```text
Test Files  1 passed (1)
Tests       27 passed (27)
```

The fixture cases prove:

- an allowlisted private-chat callback succeeds in private-only mode;
- a group callback is rejected when no user allowlist exists;
- an allowlisted group plus matching clicking user succeeds;
- a non-matching clicking user is rejected even in an allowlisted group;
- approved and denied records store only a masked actor plus chat type;
- rejected events contain masked chat and actor values plus a reason;
- expiry, exact-command binding, and single-use behavior remain canonical; and
- configuration and doctor summaries contain neither the token nor a full ID.

The Telegram and canonical approval suites also passed together:

```text
Test Files  2 passed (2)
Tests       31 passed (31)
```

Full Windows repository gates:

```text
pnpm typecheck  PASS
pnpm test       29 files passed; 314 tests passed; 1 optional live identity test skipped
pnpm build      PASS; bundled CLI dist/index.js 826.5kb
```

## Live private-chat proof

The ignored `.local/telegram.env` contained a Bot API token and chat allowlist,
but no user allowlist, so the runtime selected private-only mode.

```text
AXIOMGATE / telegram test · Bot API round trip
Configuration  configured token=configured chats=***3884 users=private-only notify=all source=.local/telegram.env
Bot            @Axiomgate_bot
Result         [OK] PASS
```

A disposable local mission then sent a real approval card to the configured
private one-to-one chat. The first card was deliberately denied by the user;
the actor-authorized denial was recorded without executing a command. A fresh
card was then approved once as requested.

Sanitized canonical result:

```text
status: APPROVED
surface: telegram
approver: telegram:user=***3884;chat=private
singleUse: true
consumedAt: null
watcher: cards=1; notifications=0; failures=0
```

The approved command was not executed. No second Telegram identity was
available for a live rejection, so the non-allowlisted-actor case is
fixture-verified rather than claimed live.

A scan of the disposable proof state produced:

```text
tokenPresent: false
fullChatIdPresent: false
maskedActorPresent: true
```

## Platform check

`wsl --status` and `wsl -l -v` reported an Ubuntu WSL2 registration, but an
actual launch failed before Node could run because the registered VHDX path
was missing (`ERROR_PATH_NOT_FOUND`). No Linux command was run, no WSL repair
was attempted, and the platform matrix remains unchanged.

## npm 0.1.3 release-candidate proof

Publication status: `PENDING USER CONFIRMATION`.

The bundled package was packed, installed into a fresh temporary directory,
and exercised only through its installed command shim:

```text
package: axiomgate@0.1.3
files: README.md, dist/index.js, package.json
package size: 147347 bytes
unpacked size: 848312 bytes
shasum: 784c60c9c634d57e61747aabbacf1b3ccee3dfb9
```

Installed-tarball results:

```text
axiomgate --help: PASS
axiomgate doctor: PASS
axiomgate telegram test: PASS, token=configured, chats masked, users=private-only
axiomgate replay wrong-target: PASS, EXISTS_NOT_OWNED
receipt verify intact: PASS
receipt verify tampered: expected FAIL, exit 1
MCP initialize/tools/list/receipt call: PASS, server version 0.1.3
```

The tarball verifier checked the live Telegram output against the ignored
configuration values before printing it. No full token, chat ID, or user ID
was present. At capture time this was `npm pack` plus a local install only; no
npm publish or GitHub push had occurred.

## Straggler audit

- No tracked `42/100`, unsupported `44-52%`, or non-repudiable wording remains.
- The landing source and `docs/assets/axiomgate-landing.png` both show the
  UnderSpecBench-supported 55.8-67.8% range and cite the study.
- The wrong-target Vercel scene remains labelled replay or pending unless real
  provider evidence is separately staged.
