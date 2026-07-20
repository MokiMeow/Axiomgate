# Codex Collaboration Log

How Codex and GPT-5.6 are used to build AxiomGate. Updated continuously.

## Model policy

- **Implementation:** Codex CLI with **GPT-5.6 Sol, high reasoning effort** (user's default config) in a designated primary session.
- **Plumbing/spikes:** GPT-5.6 Luna, low effort (cheap verification runs).
- **Planning/review support:** other tools contributed planning and adversarial review. All core implementation, remediation, runtime proof, and evidence work ran through Codex GPT-5.6 sessions.

## Session log

| Date | Session ID | Model | Purpose | Outcome |
|---|---|---|---|---|
| 2026-07-14 | 019f611c-3894-7780-8051-6acdec591dd2 | gpt-5.6-luna | F2 hook gate: observe spike | PASS - PreToolUse fires with exact command payload |
| 2026-07-14 | 019f611c-9873-73f2-a05b-c556300489f1 | gpt-5.6-luna | F2 hook gate: exit-2 deny spike | FAIL - deny ignored under `approval_policy="never"` (fail-open finding) |
| 2026-07-14 | 019f6129-9a31-7111-934d-7e1930b430ca | gpt-5.6-luna | F2 hook gate: JSON permissionDecision deny | **PASS - command blocked even under bypassPermissions; F2 gate cleared** |
| 2026-07-19 | 019f7afa-6b69-7dc3-8713-3f0d37a4e6da | gpt-5.6-luna / light | Headline run: outside-workspace mutation attempt | PASS - hook persisted `UNKNOWN` / `DENY`; sentinel remained intact; zero command executions |
| 2026-07-19 | 019f7afb-1c78-7083-bcd5-d29043678202 | gpt-5.6-sol / high | Headline run: implement brute-force lockout | PASS - implementation diff produced; native and dedicated lockout tests passed |
| 2026-07-19 | 019f7b00-b5a6-7362-9d40-1d483b45d10b | gpt-5.6-terra / medium | Headline run: remediate five reachable lodash advisories | PASS - dependency updated; targeted build/test/scan rerun passed |
| 2026-07-19 | 019f7b04-264c-7310-a11a-caa38862825f | gpt-5.6-terra / high | Headline run: first fresh read-only review | ADVISORY - identified stale installed dependency after manifest remediation |
| 2026-07-19 | 019f7b09-5b50-76d3-9d28-c48ad0b32980 | gpt-5.6-terra / high | Headline run: review after dependency sync | ADVISORY - identified inherited-property username regression |
| 2026-07-19 | 019f7b0c-d525-7831-82e5-3ab20a3d3ae4 | gpt-5.6-terra / medium | Headline run: bounded reviewer-finding fix | PASS - own-key lookup and regression test added; wrapper also emitted a false-positive rate-limit checkpoint after successful completion |
| 2026-07-19 | 019f7b0f-4eca-7840-ba45-9d0c2ad7e6c5 | gpt-5.6-terra / high | Headline run: final fresh read-only review | ADVISORY - four criteria look correct; build cannot be assessed in read-only sandbox because it writes `dist/` |

## Primary build thread

- The primary repository implementation was completed in the submission's Codex workspace thread. Governed runtime session identifiers are listed above; the seven headline rows total 3,159,955 input-plus-output tokens from the mission ledger.
- Build Week commits are reproducible with `git log --oneline 58c1a0a..HEAD`; no non-Codex tool is credited with core implementation.
