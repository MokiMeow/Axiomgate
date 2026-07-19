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
- Later result: `exec --json` usage fields are verified in R1. The 0.144.4 `PermissionRequest` non-interactive limitation is recorded below.

### G3 live-enforcement results — codex-cli 0.144.4, 2026-07-15 (VERIFIED)

- Live blocked-action proof: real `codex exec` denied `git push origin main` via the AxiomGate hook; no `command_execution` item emitted; DENY event persisted with command hash. Evidence: `evidence/public/g3-g4-verification.md`.
- **Version drift 0.144.0 → 0.144.4 changed hook semantics:**
  - Matchers are **exact tool names**; `".*"` and `"*"` silently never fire (**fail-open**). Config must enumerate `Bash`, `apply_patch`, and any MCP tool names explicitly.
  - `hookSpecificOutput.hookEventName` is **required**; a deny without it is ignored (**fail-open**) even though the hook recorded it.
- **Ops rule:** after ANY Codex version change, re-run the hook enforcement test suite + one live blocked-command proof before trusting enforcement; every evidence file records the exact codex-cli version. Avoid `codex update` between final verification and the submission demo.
- **PermissionRequest on-request probe (2026-07-16): VERIFIED LIMITATION.** A real `codex -a on-request ... exec --json` run configured with only the AxiomGate `PermissionRequest` hook asked the model to request escalation for `git push`. Codex emitted no `command_execution`, but its router reported `approval policy is Never; reject command`; the PermissionRequest hook did not fire, so no live payload exists to characterize. `codex exec --help` exposes no exec-scoped approval option. On 0.144.4, AxiomGate therefore does not claim live PermissionRequest enforcement for non-interactive exec; the verified `PreToolUse` JSON deny remains mandatory. Evidence: `evidence/public/guard-closeout-verification.md`.
- 0.144.4 strict config accepts `approvals_reviewer = "user" | "auto_review" | "guardian_subagent"` (the latter is a legacy-compatible name). AxiomGate fixture-tests the external-reviewer contract: `user` receives the AxiomGate policy/approval decision; native reviewers defer without a second AxiomGate prompt; unknown reviewers defer to explicit approval; explicit policy DENY always wins. Reviewer identity is bound into the hook config hash and recorded in hook events. Live defer output could not be exercised through `codex exec` because of the limitation above.

### Native skill and custom-verifier results — codex-cli 0.144.4, 2026-07-16 (VERIFIED WITH FALLBACK)

- Repo skills are discoverable under `.agents/skills/<folder>/SKILL.md`; AxiomGate ships `axiomgate-governance` there and can install it into `$CODEX_HOME/skills/axiomgate/`.
- Loadable custom-agent TOML uses the current keys `name`, `description`, `developer_instructions`, `model`, `model_reasoning_effort`, and `sandbox_mode`. AxiomGate keeps its judge-visible source at `.agents/agents/axiomgate-verifier.toml` and installs it into `$CODEX_HOME/agents/`.
- `multi_agent` is stable/enabled, but `codex exec --help` exposes no deterministic named-agent selector on 0.144.4. Custom-agent spawning is prompt/model driven. `mission review` therefore remains a fresh `gpt-5.6-terra/high`, `read-only` verifier session and reports the fallback explicitly; it does not fake delegation.
- Live proof produced a valid advisory verifier record in fresh session `019f6af1-79f0-7860-b442-1d2791c933e9`; the target's tracked diff hash was unchanged before/after. Evidence: `evidence/public/skill-subagent-verification.md`.

### Reasoning-effort wire results — codex-cli 0.144.4, 2026-07-16 (VERIFIED)

- Six isolated `gpt-5.6-luna` probes through the shared timeout runner tested `light`, `low`, `medium`, `high`, `xhigh`, and `max` exactly once each.
- `light` was rejected with HTTP 400 `invalid_enum_value`. `low`, `medium`, `high`, `xhigh`, and `max` each completed successfully.
- AxiomGate's product vocabulary is `Light`, `Medium`, `High`, `Xhigh`, `Max`; the exec adapter translates display `light` to wire `low` and passes the other values through.
- Legacy contracts/receipts containing `none`, `minimal`, or `low` remain parseable; `mission update` migrates those values to display `light` before versioning and re-hashing.
- Ultra is native Codex multi-agent mode, not a reasoning-effort wire value. AxiomGate records it as a capability note only and does not orchestrate Ultra during Build Week. Evidence: `evidence/public/effort-labels-verification.md`.

### Enforcement re-verification — codex-cli 0.144.6, 2026-07-19 (VERIFIED)

- Codex auto-updated 0.144.4 → 0.144.6. Per the ops rule, `axiomgate verify-enforcement` was run: **PASS LIVE** — real session `019f7ab8-43d3-79d2-b71f-7ea96fe36a91`, gated command denied at the hook, zero command executions, version + timestamp recorded to `enforcement-verified.json`. Hook semantics unchanged from 0.144.4.
- Reminder: do not `codex update` between final verification and the demo recording; re-run `verify-enforcement` after any update.

### MCP and plugin packaging — codex-cli 0.144.6, 2026-07-19 (VERIFIED)

- Stdio MCP registration is native: `codex mcp add <name> -- <command>...`. AxiomGate registered `node <built-cli> mcp`; `codex mcp get axiomgate` reported an enabled stdio server. Direct JSON-RPC and a real read-only Luna `codex exec` both completed `axiomgate_mission_status` and `axiomgate_receipt_verify`; the latter returned gate `COMPLETE` and receipt `valid: true`.
- MCP read tools must declare the standard `readOnlyHint: true` annotation for non-interactive exec. Without it, 0.144.6 discovered and attempted the tools but cancelled them as approval-requiring calls even under `--ask-for-approval never`. With the truthful annotation, the same read-only calls completed. The approval mutation tool is not annotated read-only.
- Hook matchers remain exact names on 0.144.6, including MCP tools. `generateHookConfig({ mcpToolMatchers })` sorts and explicitly enumerates configured MCP tool names in both hook events and carries those names into the hook command/config hash; it never emits `*` or `.*`. Known MCP adapters map to semantic actions, while an unknown explicitly hooked MCP tool maps to state-changing `UNKNOWN` and is denied by default.
- `codex plugin add` does **not** accept a local directory. It installs `PLUGIN@MARKETPLACE` from a configured marketplace snapshot. Local/Git marketplace sources are added with `codex plugin marketplace add <source>`; direct marketplace, plugin, or marketplace-publish commands beyond this installed-snapshot flow are not exposed.
- A local marketplace root must contain `.agents/plugins/marketplace.json`; a root-level `marketplace.json` was rejected as unsupported. Each plugin has `.codex-plugin/plugin.json`, with optional `skills/`, `agents/`, and `.mcp.json` components.
- Live install used `codex plugin marketplace add <repo>/plugin` followed by `codex plugin add axiomgate@axiomgate-build-week`. `codex plugin list --json` reported version `0.1.0`, installed `true`, enabled `true`, and the exact local source. A second `axiomgate install-codex` run reported every artifact `UNCHANGED`.
- This is a local, version-controlled distribution proof only. No marketplace publication is claimed because 0.144.6 exposes no publish command.

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
