# G1/G2 Verification — 2026-07-15

Platform: Windows, Node `v24.11.1`, pnpm `10.33.0`, GitHub CLI `2.96.0`, Vercel CLI `51.7.0`.

## G1 — Identity and deploy-target proof

- `pnpm.cmd typecheck` — succeeded for `@axiomgate/cli` and `@axiomgate/core`.
- `pnpm.cmd test` — two files passed; 33 tests passed; one optional live identity smoke test skipped because `AXIOM_LIVE_SMOKE` was not set.
- `pnpm.cmd build` — succeeded for `@axiomgate/cli` and `@axiomgate/core`.
- Built `runCommand` probe using `gh --version` — `SUCCESS`, exit `0`, `gh version 2.96.0 (2026-07-02)`.
- Built `runCommand` probe using `vercel --version` — `SUCCESS`, exit `0`, `51.7.0`; this verifies the Windows `.cmd` execution path without an authenticated API call.
- Fixture coverage includes valid, malformed, empty, not-found, wrong-owner, and tool-unavailable results. Unit tests make no live GitHub or Vercel API calls.
- Scoped credential-pattern and TODO/debug scans over the G1 source, fixtures, and tests found no matches.

G2 results are appended by the G2 commit.
