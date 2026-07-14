# Codex Collaboration Log

How Codex and GPT-5.6 are used to build AxiomGate. Updated continuously.

## Model policy

- **Implementation:** Codex CLI with **GPT-5.6 Sol, high reasoning effort** (user's default config) in a designated primary session.
- **Plumbing/spikes:** GPT-5.6 Luna, low effort (cheap verification runs).
- **Orchestration/review:** Claude acts as orchestrator and independent reviewer only — no core functionality is written by Claude (see `docs/17`).

## Session log

| Date | Session ID | Model | Purpose | Outcome |
|---|---|---|---|---|
| 2026-07-14 | 019f611c-3894-7780-8051-6acdec591dd2 | gpt-5.6-luna | F2 hook gate: observe spike | PASS — PreToolUse fires with exact command payload |
| 2026-07-14 | 019f611c-9873-73f2-a05b-c556300489f1 | gpt-5.6-luna | F2 hook gate: exit-2 deny spike | FAIL — deny ignored under `approval_policy="never"` (fail-open finding) |

## Primary build thread

- Session ID: _to be designated at first build session (F3) and preserved for `/feedback`._
