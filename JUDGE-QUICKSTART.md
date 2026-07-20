# Judge Quickstart

This path verifies the core governance and receipt claims without personal credentials. Commands below are PowerShell and were verified on Windows 11 with Node.js 20+ and pnpm 10.

## Clean-clone path

```powershell
git clone https://github.com/mokimeow/axiomgate.git
Set-Location axiomgate
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node apps/cli/dist/index.js replay all
node apps/cli/dist/index.js receipt verify scripts/fixtures/publish-receipt.json
```

Expected results:

- `replay all` reports three `PASS` rows: `EXISTS_NOT_OWNED`, approval command-hash mismatch, and `INCOMPLETE / UNVERIFIED`;
- receipt verification reports `PASS · RECEIPT INTEGRITY` and exits 0.

## Tamper proof

```powershell
node scripts/tamper-receipt.mjs scripts/fixtures/publish-receipt.json .local/tampered-receipt.json
node apps/cli/dist/index.js receipt verify .local/tampered-receipt.json
```

The second command must report `FAIL · RECEIPT INTEGRITY` and return a non-zero exit code. The tampered copy stays under ignored `.local/`.

## Published-package path

The current registry-backed clean-machine path follows npm's `latest` tag. Source 0.1.1 is prepared and locally verified; until its two-factor-confirmed publication completes, `latest` remains the prior verified release:

```powershell
npx -y axiomgate@latest doctor
npx -y axiomgate@latest replay all
npx -y axiomgate@latest receipt verify scripts/fixtures/publish-receipt.json
```

The receipt path in the last command assumes this repository is the current directory. No GitHub, Vercel, Telegram, or Codex login is used by replay or offline receipt verification.

## Optional authenticated lifecycle

With Codex authenticated on a disposable workspace:

```powershell
node apps/cli/dist/index.js mission create --objective "Add a tested local change" --project .
node apps/cli/dist/index.js mission run <mission-id> --project .
node apps/cli/dist/index.js mission review <mission-id> --project .
node apps/cli/dist/index.js mission verify <mission-id> --project .
node apps/cli/dist/index.js mission status <mission-id> --project .
node apps/cli/dist/index.js mission receipt <mission-id> --format json --project .
```

`<mission-id>` is intentional command output substitution, not an unfinished repository placeholder. Use only a disposable target: the mission guard can modify files within its declared boundary.

## Optional Telegram approval relay

Set `TELEGRAM_BOT_TOKEN` and a comma-separated `TELEGRAM_CHAT_ID` allowlist in the environment or ignored `.local/telegram.env`, then run:

```powershell
node apps/cli/dist/index.js telegram test
node apps/cli/dist/index.js telegram watch --project <governed-workspace>
```

The relay uses Bot API long polling only: it opens no webhook or public listener. Approval cards bind to the existing exact command hash and canonical single-use store. `TELEGRAM_NOTIFY=approvals` suppresses stage notifications; `TELEGRAM_NOTIFY=off` disables the surface; the default is `all` when configured.

## Labels and limitations

- The three built-in scenarios are labelled `REPLAY` and use deterministic synthetic data.
- The headline evidence pack is labelled `LIVE` where real Codex, test, and scan execution occurred.
- Windows is verified. macOS and Linux are not yet tested.
- Production deployment is outside Build Week scope and is refused.
