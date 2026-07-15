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
| Mission Compiler | IN_PROGRESS | `packages/axiomgate-core/test/schemas.test.ts` | Canonical contract schema, intent-boundary ordering, and hashing verified; compiler flow remains F6 |
| Runway | NOT_STARTED | None | Blueprint only |
| Environment Guard | IN_PROGRESS | `packages/axiomgate-core/test/identity.test.ts`; `packages/axiomgate-core/test/policy.test.ts`; `packages/axiomgate-core/test/hook.test.ts`; `packages/axiomgate-core/test/approval-flow.test.ts`; `evidence/public/g1-g2-verification.md`; `evidence/public/g3-g4-verification.md` | G1–G3 verified; G4 core and CLI verified, with dashboard and Telegram approval surfaces remaining |
| Codex Runtime | NOT_STARTED | None | Blueprint only |
| Verification Engine | NOT_STARTED | None | PatchPilot audit required |
| Evidence Gate | IN_PROGRESS | `packages/axiomgate-core/test/schemas.test.ts` | Canonical evidence and receipt schemas verified; verdict engine and receipt generation remain E1–E2 |
| Local web dashboard | NOT_STARTED | None | Extends PatchPilot Next.js app (ADR-009) |
| CLI | IN_PROGRESS | `apps/cli/src/index.ts`; `evidence/public/g3-g4-verification.md` | `doctor`, hook entry, and approvals list/approve/deny are implemented; remaining E4 commands are not implemented |
| Evaluation Replay Lab | NOT_STARTED | None | Blueprint only |
| Hackathon submission | NOT_STARTED | None | Deadline plan required |

## Update rule

A status may move to `VERIFIED` only when linked evidence satisfies `docs/23-DEFINITION-OF-DONE.md`.
