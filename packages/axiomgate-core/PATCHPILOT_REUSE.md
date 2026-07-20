# PatchPilot Core Reuse Map

PatchPilot is the pre-existing Verification Engine foundation at `../patchpilot/packages/core`. AxiomGate will consume its exported contracts in V1-V4; F3/F4 do not copy or modify PatchPilot code.

| PatchPilot export | Existing responsibility | Planned AxiomGate consumer |
|---|---|---|
| `runCommand`, `ValidationRun` | Execute validation commands and retain structured results | Verification runs and command evidence |
| `runProjectScanners`, scanner parsers and coverage | Dependency, secret, SAST, container, and policy checks | Mission verification plans and findings |
| `runCodexExec`, `classifyCodexRemediation` | Scoped Codex remediation execution and outcome classification | Finding remediation and rerun cycle |
| `hashReceipt`, `createAuditReceipt` | Receipt hashing and append-only audit linkage | Evidence-chain integration |
| Approval signing and verification functions | HMAC-bound approval tokens | Telegram approval adapter; AxiomGate retains mission/action binding |
| `redact`, `redactObject` | Secret-aware output redaction | Evidence capture before persistence or export |
| `sanitizeForLlmContext`, MCP tool guards | Prompt-injection and tool-description checks | Untrusted-content checks where required by the demo |
| Telegram callback and message functions | Telegram transport and callback validation | Approval presentation and response transport |

The integration boundary will be a typed adapter in `@axiomgate/core`; PatchPilot remains the owner of scanning, remediation, audit primitives, redaction, and Telegram transport. Mission contracts, semantic-action policy, evidence admissibility, and Build Receipts remain AxiomGate responsibilities.
