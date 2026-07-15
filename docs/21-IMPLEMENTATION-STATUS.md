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
| Mission Compiler | VERIFIED | `packages/axiomgate-core/test/schemas.test.ts`; `packages/axiomgate-core/test/mission-compiler.test.ts`; `evidence/public/f6-r1-verification.md` | F6 create/update flow, conflict reporting, hashing, criteria, model plan, identity snapshot, and boundary mapping verified |
| Runway | IN_PROGRESS | `packages/axiomgate-core/test/runtime.test.ts`; `evidence/public/f6-r1-verification.md` | R1 persists token actuals and checkpoints; reserve, loop detection, capacity, and full recovery remain R3 |
| Environment Guard | IN_PROGRESS | `packages/axiomgate-core/test/identity.test.ts`; `packages/axiomgate-core/test/policy.test.ts`; `packages/axiomgate-core/test/hook.test.ts`; `packages/axiomgate-core/test/approval-flow.test.ts`; `evidence/public/g1-g2-verification.md`; `evidence/public/g3-g4-verification.md` | G1–G3 verified; G4 core and CLI verified, with dashboard and Telegram approval surfaces remaining |
| Codex Runtime | IN_PROGRESS | `packages/axiomgate-core/test/runtime.test.ts`; `evidence/public/f6-r1-verification.md` | R1 governed run adapter and basic resume verified; independent builder/verifier roles remain R2 |
| Verification Engine | NOT_STARTED | None | PatchPilot audit required |
| Evidence Gate | IN_PROGRESS | `packages/axiomgate-core/test/schemas.test.ts` | Canonical evidence and receipt schemas verified; verdict engine and receipt generation remain E1–E2 |
| Local web dashboard | NOT_STARTED | None | Extends PatchPilot Next.js app (ADR-009) |
| CLI | IN_PROGRESS | `apps/cli/src/index.ts`; `evidence/public/g3-g4-verification.md`; `evidence/public/f6-r1-verification.md` | `doctor`, hook entry, approvals, and mission create/update/run/resume are implemented; verify/receipt/replay and npm publication remain E4 |
| Evaluation Replay Lab | NOT_STARTED | None | Blueprint only |
| Hackathon submission | NOT_STARTED | None | Deadline plan required |

## Update rule

A status may move to `VERIFIED` only when linked evidence satisfies `docs/23-DEFINITION-OF-DONE.md`.
