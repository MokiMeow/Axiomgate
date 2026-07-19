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

After the user publishes version 0.1.0, the clean-machine equivalent is:

```powershell
npx -y axiomgate@0.1.0 doctor
npx -y axiomgate@0.1.0 replay all
npx -y axiomgate@0.1.0 receipt verify scripts/fixtures/publish-receipt.json
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

## Labels and limitations

- The three built-in scenarios are labelled `REPLAY` and use deterministic synthetic data.
- The headline evidence pack is labelled `LIVE` where real Codex, test, and scan execution occurred.
- Windows is verified. macOS and Linux are not yet tested.
- Production deployment is outside Build Week scope and is refused.
