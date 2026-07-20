# Security Threat Model

## Protected assets

- source code and unpublished intellectual property;
- GitHub, Vercel, database, browser, and provider credentials;
- repository and deployment integrity;
- user-approved budgets and quota capacity;
- mission state and evidence;
- local files and browser profiles;
- approval records and Build Receipts.

## Trust boundaries

- user to web dashboard/CLI;
- web dashboard/CLI to local engine;
- engine to Codex or other model provider;
- engine to commands, CLIs, APIs, browser automation, MCP, skills, and local applications;
- engine to PatchPilot;
- engine to credential stores;
- engine to GitHub/Vercel/Telegram;
- local private evidence to public evidence export.

## Primary threats

### Intent drift

The agent moves from inspection to modification or deployment without authority.

### Prompt and instruction injection

A malicious README, issue, webpage, tool description, skill, MCP response, or command output attempts to alter authority or exfiltrate data.

### Capability confusion or poisoning

A mechanism describes one action but performs a broader action, changes after approval, widens network/filesystem access, or substitutes a different target.

### Credential confusion

The correct action is performed with the wrong account or workspace.

### Approval confusion

The displayed approval and executed command differ.

### Runtime permission mismatch

The runtime applies broader or narrower permission than the user approved.

### Invisible background action

A process continues using tools or connected accounts without visible mission ownership.

### Evidence forgery

The agent fabricates, reuses, or modifies test/security evidence.

### Governance-state self-tampering

The model uses writable workspace authority to change its own mission snapshot,
policy, approvals, or events and recomputes unkeyed integrity hashes before a
consequential action.

### Quota abuse

Loops, repeated agents, or model escalation consume unexpected capacity.

### Local data leakage

Secrets or private fixtures enter prompts, logs, screenshots, receipts, or Git.

### Supply-chain compromise

A dependency, installer, script, binary, or external capability is malicious.

## Required mitigations

- explicit intent boundary;
- semantic action policy;
- deny-by-default external mutation;
- target and identity verification;
- scoped credential handles;
- binding approvals to exact action, target, identity, and technical execution;
- effective-permission reconciliation;
- prompt-injection classification;
- integrity metadata when available;
- process ownership and stop controls;
- evidence hashing and freshness;
- a hook-level hard deny for model-visible writes into `.axiomgate`, evaluated
  before normal mission policy, plus deny-by-default for shell commands not on
  the demonstrably read-only allowlist;
- local redaction;
- loop detection and user ceilings;
- dependency and secret scans;
- negative tests for every authority level.

## Security test principle

Create negative tests for each authority level and external adapter. Test malicious capability fixtures, wrong account, wrong environment, stale approval, changed command or target after approval, secret output, hidden background action, effective-permission mismatch, and receipt tampering.

## Non-claims

AxiomGate does not claim to prove that all third-party code is safe, that prompts cannot influence a model, or that every provider exposes enforceable permissions. The Build Week release hard-denies observed `.axiomgate` write mechanisms, but moving authoritative state fully outside the model-writable workspace remains the stronger long-term boundary. It must identify unsupported boundaries and fail closed where authority or identity cannot be verified.
