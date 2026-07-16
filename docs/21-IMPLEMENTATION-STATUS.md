# Implementation Status

Statuses:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `IMPLEMENTED_UNVERIFIED`
- `VERIFIED`
- `DEFERRED`

| Layer | Status | Evidence | Notes |
|---|---|---|---|
| Mission Compiler | VERIFIED | `packages/axiomgate-core/test/schemas.test.ts`; `packages/axiomgate-core/test/mission-compiler.test.ts`; `evidence/public/f6-r1-verification.md`; `evidence/public/r2-r3-verification.md` | F6 create/update flow plus verify-phase and reserve-policy migration are verified |
| Runway | VERIFIED | `packages/axiomgate-core/test/quota-source.test.ts`; `packages/axiomgate-core/test/runway.test.ts`; `packages/axiomgate-core/test/runtime.test.ts`; `evidence/public/r2-r3-verification.md`; `evidence/public/q1-q4-verification.md` | Official app-server quota windows, live-first/manual-fallback capacity, real-window reserve, banked-reset expiry, post-limit guidance, token actuals, loop recommendations, and GPT-5.6 max-tier selection verified |
| Environment Guard | IN_PROGRESS | `packages/axiomgate-core/test/identity.test.ts`; `packages/axiomgate-core/test/policy.test.ts`; `packages/axiomgate-core/test/hook.test.ts`; `packages/axiomgate-core/test/approval-flow.test.ts`; `packages/axiomgate-core/test/enforcement-hardening.test.ts`; `evidence/public/g1-g2-verification.md`; `evidence/public/g3-g4-verification.md`; `evidence/public/r2-r3-verification.md` | G1–G3 and live version-drift enforcement re-verification are verified; G4 dashboard and Telegram approval surfaces remain |
| Codex Runtime | VERIFIED | `packages/axiomgate-core/test/runtime.test.ts`; `packages/axiomgate-core/test/verifier.test.ts`; `packages/axiomgate-core/test/codex-native.test.ts`; `evidence/public/f6-r1-verification.md`; `evidence/public/r2-r3-verification.md`; `evidence/public/skill-subagent-verification.md` | R1–R3 governed builder, fresh read-only independent verifier, canonical session/recovery state, Runway integration, repo/global Codex skill, and native verifier artifact verified; 0.144.4 named-agent exec targeting is unsupported and falls back honestly |
| Verification Engine | VERIFIED | `packages/axiomgate-core/test/verification-plan.test.ts`; `packages/axiomgate-core/test/verification-checks.test.ts`; `packages/axiomgate-core/test/verification-run.test.ts`; `packages/axiomgate-core/test/verification-remediation.test.ts`; `evidence/public/v1-v4-verification.md` | V1–V4 typed planning, native checks, published PatchPilot scan, secret scan, governed targeted remediation, freshness handling, and real fixture integration verified per ADR-014 |
| Evidence Gate | VERIFIED | `packages/axiomgate-core/test/schemas.test.ts`; `packages/axiomgate-core/test/evidence-verdict.test.ts`; `packages/axiomgate-core/test/receipt.test.ts`; `evidence/public/e1-e2-verification.md` | E1–E2 fresh/admissible criterion verdicts, completion gate, visible waivers, permission quads, stored-record receipt projection, hash-chain integrity, Markdown/JSON formats, and offline tamper verification are verified |
| Local web dashboard | NOT_STARTED | None | Extends PatchPilot Next.js app (ADR-009) |
| CLI | IN_PROGRESS | `apps/cli/src/index.ts`; `evidence/public/g3-g4-verification.md`; `evidence/public/f6-r1-verification.md`; `evidence/public/r2-r3-verification.md`; `evidence/public/v1-v4-verification.md`; `evidence/public/e1-e2-verification.md`; `evidence/public/skill-subagent-verification.md` | Adds idempotent `install-codex` and doctor native-artifact checks alongside mission status/waive/receipt and offline receipt verify; replay and npm publication remain E4 |
| Evaluation Replay Lab | NOT_STARTED | None | Blueprint only |
| Hackathon submission | NOT_STARTED | None | Deadline plan required |

## Update rule

A status may move to `VERIFIED` only when linked evidence satisfies `docs/23-DEFINITION-OF-DONE.md`.
