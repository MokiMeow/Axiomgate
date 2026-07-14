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
| Mission Compiler | NOT_STARTED | None | Blueprint only |
| Runway | NOT_STARTED | None | Blueprint only |
| Environment Guard | NOT_STARTED | None | Blueprint only |
| Codex Runtime | NOT_STARTED | None | Blueprint only |
| Verification Engine | NOT_STARTED | None | PatchPilot audit required |
| Evidence Gate | NOT_STARTED | None | Blueprint only |
| Local web dashboard | NOT_STARTED | None | Extends PatchPilot Next.js app (ADR-009) |
| CLI | NOT_STARTED | None | Existing stack audit required |
| Evaluation Replay Lab | NOT_STARTED | None | Blueprint only |
| Hackathon submission | NOT_STARTED | None | Deadline plan required |

## Update rule

A status may move to `VERIFIED` only when linked evidence satisfies `docs/23-DEFINITION-OF-DONE.md`.
