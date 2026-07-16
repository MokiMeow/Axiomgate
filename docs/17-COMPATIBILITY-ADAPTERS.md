# Compatibility and Adapters

## Build Week support

### Codex

First-class and complete. Codex performs the primary implementation, remediation, and evidence-producing workflow.

Integration interfaces (all official): hooks (`PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop`; deny-wins), App Server JSON-RPC / TypeScript SDK, `codex exec --json` (events + token usage), `--output-schema`, sandbox and permission-profile flags.

**Phase 0 gate:** empirically verify on the installed Codex version — the `PermissionRequest` payload contents, deny semantics, fail-open/fail-closed behavior on hook error, and the `exec --json` usage fields. Record version numbers in the matrix below. If hooks fail open, missions must not claim enforcement until mitigated.

### F2 gate results — codex-cli 0.144.0, 2026-07-14 (VERIFIED)

- `hooks` feature: **stable, enabled**. `guardian_approval`: stable.
- `PreToolUse` fires on live `codex exec`; stdin payload includes `session_id`, `turn_id`, `cwd`, `model`, `permission_mode`, `tool_name` ("Bash"), `tool_input.command` (exact command), `tool_use_id`, `transcript_path`.
- **Deny via bare exit code 2: IGNORED under `approval_policy="never"` (bypassPermissions) — fail-open. Never rely on exit-2.**
- **Deny via JSON `hookSpecificOutput.permissionDecision: "deny"`: ENFORCED even under bypassPermissions.** Router error surfaces the `permissionDecisionReason`; the command does not execute. This is the normative AxiomGate deny mechanism.
- Hook config injectable per-run via `-c "hooks.PreToolUse=[{matcher=..., hooks=[{type=\"command\", command=...}]}]"` + `--dangerously-bypass-hook-trust` (acceptable only for AxiomGate-authored hooks).
- Ops rule: every `codex exec` invocation gets a hard timeout; one transient ~6-min stall observed before any tool call.
- Still to verify during G3/G4: `PermissionRequest` payload/behavior in `on-request` mode; `exec --json` usage fields (R1).

### G3 live-enforcement results — codex-cli 0.144.4, 2026-07-15 (VERIFIED)

- Live blocked-action proof: real `codex exec` denied `git push origin main` via the AxiomGate hook; no `command_execution` item emitted; DENY event persisted with command hash. Evidence: `evidence/public/g3-g4-verification.md`.
- **Version drift 0.144.0 → 0.144.4 changed hook semantics:**
  - Matchers are **exact tool names**; `".*"` and `"*"` silently never fire (**fail-open**). Config must enumerate `Bash`, `apply_patch`, and any MCP tool names explicitly.
  - `hookSpecificOutput.hookEventName` is **required**; a deny without it is ignored (**fail-open**) even though the hook recorded it.
- **Ops rule:** after ANY Codex version change, re-run the hook enforcement test suite + one live blocked-command proof before trusting enforcement; every evidence file records the exact codex-cli version. Avoid `codex update` between final verification and the submission demo.
- `PermissionRequest`: same code path, fixture-tested; live on-request proof still pending.

### Native skill and custom-verifier results — codex-cli 0.144.4, 2026-07-16 (VERIFIED WITH FALLBACK)

- Repo skills are discoverable under `.agents/skills/<folder>/SKILL.md`; AxiomGate ships `axiomgate-governance` there and can install it into `$CODEX_HOME/skills/axiomgate/`.
- Loadable custom-agent TOML uses the current keys `name`, `description`, `developer_instructions`, `model`, `model_reasoning_effort`, and `sandbox_mode`. AxiomGate keeps its judge-visible source at `.agents/agents/axiomgate-verifier.toml` and installs it into `$CODEX_HOME/agents/`.
- `multi_agent` is stable/enabled, but `codex exec --help` exposes no deterministic named-agent selector on 0.144.4. Custom-agent spawning is prompt/model driven. `mission review` therefore remains a fresh `gpt-5.6-terra/high`, `read-only` verifier session and reports the fallback explicitly; it does not fake delegation.
- Live proof produced a valid advisory verifier record in fresh session `019f6af1-79f0-7860-b442-1d2791c933e9`; the target's tracked diff hash was unchanged before/after. Evidence: `evidence/public/skill-subagent-verification.md`.

### Claude

Independent review only (planning, adversarial testing, blueprint review); **no Build Week runtime implementation**. Core building happens through Codex in the primary `/feedback` thread. Do not make shared-skill installation, mission handoff, or runtime parity a requirement.

### Generic provider

Stable interfaces and fixture implementations only where they improve architectural testability.

### Others

Roadmap only unless real implementation and tests exist.

## Adapter responsibilities

An adapter may provide:

- session launch and lifecycle;
- normalized events;
- capacity observation where supported;
- model/session transition or handoff;
- available execution mechanisms;
- semantic-action mapping;
- identity and permission information;
- effective-permission observations;
- error translation.

Adapters must not imply that all providers support the same controls.

## Capability compatibility

AxiomGate does not convert or synchronize provider-specific skills, plugins, or MCP configurations during Build Week.

Where a capability mechanism is relevant, an adapter reports:

- whether it is available;
- what semantic actions it exposes;
- what identity and permissions it requires;
- what policy controls are enforceable;
- what can only be observed or recommended;
- known limitations.

MCP is one possible mechanism, not a product boundary. The same semantic action may be implemented by native tools, a CLI, an API, browser automation, MCP, a skill script, or a local application.

## Quota

Use official APIs/CLIs where available. Otherwise display confidence and allow manual data. Never make fragile dashboard scraping a core dependency.

## Model switching

Where programmatic switching is unsupported, prepare a handoff and launch instruction rather than faking an automatic switch.

## Compatibility matrix

Maintain a verified table with:

- provider/client version;
- session launch/resume;
- context checkpoint/handoff;
- capacity data source;
- model switching;
- semantic actions discoverable;
- identity resolution;
- approval or permission controls;
- effective-permission observability;
- project/global scope;
- known limitations.

Every row must identify the version tested and whether support is native, adapted, observed only, manual, or unsupported.
