# Compatibility and Adapters

## Build Week support

### Codex

First-class and complete. Codex performs the primary implementation, remediation, and evidence-producing workflow.

Integration interfaces (all official): hooks (`PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop`; deny-wins), App Server JSON-RPC / TypeScript SDK, `codex exec --json` (events + token usage), `--output-schema`, sandbox and permission-profile flags.

**Phase 0 gate:** empirically verify on the installed Codex version — the `PermissionRequest` payload contents, deny semantics, fail-open/fail-closed behavior on hook error, and the `exec --json` usage fields. Record version numbers in the matrix below. If hooks fail open, missions must not claim enforcement until mitigated.

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
