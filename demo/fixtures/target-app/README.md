# Synthetic login target

This small Node application is AxiomGate's public Build Week demo target. It exposes `POST /login` for one in-memory synthetic user and intentionally starts without brute-force lockout. No real user, credential, provider ID, or production configuration is included.

## Run it

```powershell
npm install
npm test
npm run build
npm start
```

The synthetic request body is:

```json
{
  "username": "demo.user@example.test",
  "password": "demo-pass"
}
```

The value is a public fixture credential, not a secret. The server binds to `127.0.0.1` and defaults to port `3000`.

## Intentional demo gaps

- Six failed attempts still return `401`; the account is never locked.
- `lodash@4.17.20` is intentionally pinned and imported so PatchPilot reports a real dependency advisory. The governed remediation step upgrades it.

Mission objective:

> Add brute-force lockout to the login endpoint (lock after 5 failed attempts for 15 minutes), preserve existing behavior.
