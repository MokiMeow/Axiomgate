# Pre-Implementation Assessment — F3/F4

**Date:** 2026-07-14
**Verdict:** Feasible as scoped to F3/F4.

## Understanding and boundaries

AxiomGate turns a Codex objective into a versioned Mission Contract, plans capacity, enforces identity and action authority, runs Codex, verifies through PatchPilot, and permits completion only from admissible evidence.
The six layers are Mission Compiler, Runway, Environment Guard, Codex Runtime, Verification Engine, and Evidence Gate. The Build Week path ends at a pull request and preview deployment; production deploys and every item under `MASTER_BUILD_CONTRACT.md` “Post-hackathon scope” are excluded.
Genuine completion requires current code, automated checks, runtime evidence, documentation, and task status to agree. Model prose is not evidence.
PatchPilot is pre-existing May 2026 work: a pnpm monorepo with Next.js web, worker, CLI, MCP server, and `packages/core` scanners, validation, remediation, audit, approvals, redaction, and injection guards. F3/F4 will not copy or modify it.

## Verified repository reality

- AxiomGate started as a documentation-only repository at baseline commit `58c1a0a`; current branch is `main`, with no remote, package manifest, TypeScript source, test suite, persistence layer, web app, or CI workflow.
- Current HEAD before this assessment is `2e17304`; the worktree was clean and Git commit identity is configured.
- `docs/17-COMPATIBILITY-ADAPTERS.md` records F2 on `codex-cli 0.144.0`: JSON hook denial is enforced; bare exit code 2 fails open under `approval_policy="never"`. PermissionRequest and usage-field checks remain later work.
- Local tools: Node `v24.11.1`, pnpm `10.33.0`, Codex CLI `0.144.0`, Git `2.55.0.windows.2`, and `rg`. PowerShell script shims are blocked, so verification uses the equivalent `.cmd` launchers on Windows.
- `C:\Users\Mohith S\Desktop\patchpilot` exists and was inspected read-only. Its `packages/core/src` exports the documented validation, scanner, Codex, audit, approval, redaction, prompt-injection, and MCP-tool-guard modules. Its worktree has two unrelated untracked voiceover documents; this session will not touch them.
- Relevant sources read: `START_HERE.md`, `README.md`, the build contract, architecture/domain/security/test/quality/DoD/hygiene docs, ADRs, ideas inbox, status board, task board, Phase 0 file, `docs/17`, PatchPilot `FEATURE_MATRIX.md`, package manifests, core index, and relevant core exports.
- Discovery commands: `git status/log/show/remote`, `rg --files`, `Get-Content`, tool version/presence checks, and read-only PatchPilot tree/Git inspection using a per-command safe-directory override.

## Architecture assessment

One process and one `@axiomgate/core` package with layer modules matches ADR-008 and avoids premature services. F3 should map PatchPilot reuse contracts but defer integration to V1–V4. No migration or persistence change is needed for F3/F4.
The canonical sketches need deterministic validation choices: strict objects, ISO-8601 timestamps, and `sha256:<64 lowercase hex>` hashes. Contract hashing must omit the existing `hash` field to avoid self-reference; version bumping increments `version`, accepts the new timestamp, then re-hashes.

## Implementation and verification plan

1. Create a strict NodeNext pnpm workspace, `@axiomgate/core` layer barrels, a factual PatchPilot reuse map, and `@axiomgate/cli doctor` using standard Node process APIs.
2. Pin TypeScript, Vitest, Zod, and required Node typings; add no runtime parser dependency for the CLI.
3. Implement the five Zod schemas exactly from `docs/02`, the ordered intent-boundary helper, stable key-sorted serialization, SHA-256 contract hashing, and version bump/re-hash.
4. Add happy and rejection tests for all schemas plus hash order independence, version bumping, boundary ordering, and model-evidence rejection.
5. Run install, build/typecheck/test as applicable, inspect diffs and ignored/untracked files, scan dependency metadata and source for obvious secret material, then make atomic assessment/scaffold/schema commits.
6. Rollback is commit-level revert; no database, provider, credential, PatchPilot, or production state changes are authorized.

## Capability-use log

| Semantic action | Mechanism and reason | Identity / access / approval | Evidence |
|---|---|---|---|
| Inspect repository and PatchPilot | `rg`, PowerShell reads, Git read-only commands | Local filesystem; PatchPilot read-only; pre-authorized | Trees, manifests, Git state |
| Create and validate files | `apply_patch`, TypeScript, Vitest | AxiomGate workspace write; pre-authorized | Diff, compiler and test output |
| Resolve dependencies | `pnpm install` | Anonymous npm network read and local workspace write; requested by task | Lockfile and successful install |
| Check CLI environment | Node child processes for Codex and Git | Local process state only; pre-authorized | `doctor` output |
| Record checkpoints | Local Git commits | Configured local Git identity; explicitly required | Three atomic commit hashes |
