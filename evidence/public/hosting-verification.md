# Hosted dashboard verification

Date: 2026-07-20

## Scope and labels

- The local dashboard returns no missions on a fresh clone unless `AXIOMGATE_DEMO=true`.
- Explicit demo mode returns one curated mission labelled `SAMPLE` and a capacity record labelled `SAMPLE CAPACITY` with `source: sample` and `confidence: sample`.
- A real mission takes precedence over demo mode and removes the demo banner.
- Vercel functions expose only synthetic read data. Hosted approval requests return HTTP 409 with a local-only message and perform no mutation.
- No Vercel account, project, token, Codex account, or live capacity endpoint was used for this verification.

## Credential-free hosting harness

Command:

```text
node apps/web/hosting/verify.mjs
```

Real output:

```text
PASS GET /: landing static entry found
PASS GET /dashboard: dashboard static entry found
PASS GET /api/missions: one explicitly labelled SAMPLE mission
PASS GET /api/mission/:id: curated mission and COMPLETE receipt returned
PASS GET /api/capacity: capacity is explicitly SAMPLE
PASS POST /api/approve: hosted demo remains read-only
```

The installed tooling was Node.js `v24.11.1` and Vercel CLI `51.7.0`. The root package pins Vercel builds and functions to Node.js `24.x`, following [Vercel's supported Node.js version configuration](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

`vercel build` was intentionally not run because this checkout may carry a linked Vercel account/project and the standing authority rule prohibits credentialed account actions. The deterministic local harness invokes every serverless handler directly and validates both static entry files. Production deploy remains a user action.

## Targeted tests

Command:

```text
pnpm exec vitest run apps/web/test/dashboard-data.test.mjs apps/web/test/hosting.test.mjs apps/web/test/security.test.mjs
```

Real result:

```text
Test Files  3 passed (3)
Tests       20 passed (20)
```

The hosted mission test also runs the canonical offline receipt verifier against the curated receipt. It passed with five fresh admissible evidence records and a valid hash chain. The displayed verification history is `FAIL` followed by targeted `PASS`, the lodash finding is `resolved`, all five criteria are `PASS`, and the receipt outcome is `COMPLETE`.

## Full repository gates

Commands:

```text
pnpm typecheck
pnpm test
pnpm build
pnpm check:punctuation
pnpm check:markdown
pnpm check:links
```

Real results:

```text
typecheck: PASS (core, CLI, web)
Test Files  31 passed (31)
Tests       323 passed | 1 skipped (324)
build: PASS (core and bundled CLI)
punctuation: PASS, 0 em dashes and 0 en dashes across 258 tracked text files
Markdown quality: PASS, 80 substantive tracked files
links: PASS, 130 relative targets across 80 tracked Markdown files
```

Additional checks:

```text
PASS sample generation is deterministic
PASS candidate diff contains no credential-shaped value
PASS git diff --check
```

## Deployment boundary

No push or deployment was performed. The user deploys from the repository root with their own Vercel account:

```powershell
vercel env add AXIOMGATE_DEMO production
# Enter true when prompted.
vercel --prod
```

Equivalent one-command runtime environment configuration:

```powershell
vercel --prod -e AXIOMGATE_DEMO=true
```
