# F3/F4 Verification - 2026-07-15

Scope: pnpm monorepo scaffold, `@axiomgate/core` canonical schemas and hashing, and the initial `@axiomgate/cli doctor` command. Platform: Windows, Node `v24.11.1`, pnpm `10.33.0`, Codex CLI `0.144.0`.

## Reproducible gates

- `pnpm.cmd install` - succeeded for all three workspace projects; 56 packages installed.
- `pnpm.cmd typecheck` - succeeded for `@axiomgate/cli` and `@axiomgate/core`.
- `pnpm.cmd test` - one test file passed; 15 tests passed; no failures.
- `pnpm.cmd build` - succeeded for `@axiomgate/cli` and `@axiomgate/core`.
- `node apps/cli/dist/index.js doctor` - reported Node `v24.11.1`, Codex CLI `0.144.0`, and the current Git repository/branch state.
- Scoped credential-pattern scan over the new manifests, lockfile, apps, and packages - no matches.
- Production dependency license inventory - Zod `4.4.3`, MIT.

## Test coverage in this slice

- MissionContract, ActionRequest, Approval, Evidence, and BuildReceipt accept their canonical shapes and reject invalid variants.
- Evidence with `source: "model"` is rejected.
- Contract hashes are stable under key reordering and omit the contract's own hash field.
- Contract version bumps increment the version, replace `updatedAt`, and recompute the hash.
- Intent boundaries sort as `OBSERVE < PLAN < MODIFY_LOCAL < PUBLISH < DEPLOY_PREVIEW < DEPLOY_PRODUCTION`.

## Limitation

`pnpm.cmd audit --prod` could not produce a vulnerability result because both npm audit endpoints returned HTTP 410 (endpoint retired). This is recorded as unavailable, not passed. The direct production dependency is pinned and inventoried above; the later PatchPilot verification tasks own the full dependency/security scanner gate.
