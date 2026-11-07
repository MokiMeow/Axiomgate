# Local Dashboard HTTP Boundary Verification

Date: 2026-11-07 UTC. Label: **SANDBOX** for local process/fixture checks;
registry audit and GitHub CI are external service observations. No live Codex
mission, production deployment, or npm release is claimed.

## Scope and baseline

The source checkpoint was `5d599f2fb824701c8ffabf873d494d6835ee707e`.
The original Linux suite reported 328 passing tests, two failures caused by
Windows-only path expectations, and one explicitly opt-in live identity smoke skip.
The two fixtures now use native absolute paths and retain their full assertions.

Real HTTP regressions reproduced a missing local request-authority boundary and
malformed request termination before the fix. The new tests use synthetic mission
and approval records and do not execute an external action. Their before-fix
failure and after-fix success were observed in the same Linux environment.

## Behavior verified

- Exact loopback Host checks precede static files, mission reads, capacity probes,
  and approval mutations. Untrusted supplied origins are rejected on all routes.
- Approval POSTs require a matching serialized Origin and JSON content type.
  Rejected writes leave the canonical pending records unchanged.
- Both supported local hostnames work. Successful approval and denial use the
  canonical store; repeated decisions remain conflicts rather than new grants.
- Invalid URLs, malformed JSON, oversized bodies, wrong methods, missing records,
  and unexpected mission-data errors return controlled responses. Subsequent
  requests still succeed. Raw storage diagnostics are not returned over HTTP.
- Reads support GET/HEAD, approval writes support POST, and framing is disallowed.

## Current checks

Environment: Linux, Node 24.22.1, pnpm 10.33.0, TypeScript 5.9.3,
Vitest 4.1.12, Zod 4.6.7, Vite 7.3.7.

- Frozen dependency installation with lifecycle scripts disabled: PASS.
- `pnpm build` and `pnpm typecheck`: PASS.
- `pnpm test`: 36 files, **375 passed, one optional live identity smoke skipped**.
  The post-upgrade full run took 4.46 seconds; this is a single observation, not a
  performance benchmark or a comparison across otherwise identical conditions.
- `pnpm check:links`, `check:markdown`, `check:punctuation`, and `check:skill`: PASS.
- `pnpm demo:check`: PASS, including the expected failing baseline lockout spec.
- `node apps/cli/dist/index.js replay all`: all three deterministic scenarios PASS.
- `node apps/web/hosting/verify.mjs`: PASS; all eight hosted missions remain SAMPLE
  and hosted approvals remain read-only.
- `pnpm publish:check`: PASS for the local tarball, installed CLI, doctor, replay,
  intact receipt, expected tampered-receipt rejection, and MCP stdio contract.
- `pnpm audit`: zero reported advisories after the update, versus 14 before it.
  The previous two critical ratings concerned test-only Tinypool; they are not a
  claim of demonstrated remote execution in the shipped product. The Zod fix is
  in the core dependency. Audit results are time-sensitive, not a security proof.
- Syntax checks, whitespace checks, changed-file secret-pattern review, and
  independent adversarial code review: no blocking findings. The repository has
  no standalone ESLint or formatter configuration; none is claimed to have run.

The new GitHub workflow has pinned actions, read-only permissions, no retained
checkout credential, a high/critical audit gate, and Linux/Windows jobs running
build, typecheck, tests, documentation, demo, replay, hosting, and package checks.
Remote results are pending publication and must be checked for the exact commit.

## Research and compatibility

Official sources consulted on 2026-11-07:

- [Node HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html).
- [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [MCP local HTTP security guidance](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
  This is an analogous local-HTTP threat; AxiomGate's MCP transport remains stdio.
- [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- [Tinypool advisory](https://github.com/advisories/GHSA-85c8-ppgw-ccpr).
- [Vitest 4 migration](https://v4.vitest.dev/guide/migration.html).

No schema migration, UI redesign, authentication system, PatchPilot source change,
provider configuration, or release publication was introduced. Custom hostnames,
public tunnels, reverse proxies, and Origin-less HTTP approval scripts are not
supported; use the local browser, CLI, or existing Telegram approval adapter.
The controls do not authenticate a process already running as the local user.

Visual browser behavior, macOS, live provider credentials, and a new governed
mission receipt were not validated in this change. Historical published-release
proof remains historical; source hardening does not update npm 0.1.3 automatically.
