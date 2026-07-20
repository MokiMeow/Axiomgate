# Environment Guard

## Goal

Ensure Codex acts on the correct project, through an allowed semantic action, using the correct identity, target, credentials, and authority.

Environment Guard is a policy and identity layer. It is not a skill installer, MCP manager, plugin marketplace, or configuration synchronizer.

## Enforcement mechanism (normative)

Environment Guard enforces policy through official Codex extension points. This is the layer's spine; without it every table below is decorative.

1. **Hook integration.** AxiomGate manages the Codex hook configuration for the mission. `PreToolUse` invokes the local policy engine with the tool name, input, and working directory; its machine-JSON deny is live-proven for non-interactive `codex exec` on 0.144.6. `PermissionRequest` uses the same fixture-tested entry, but did not fire in the recorded on-request `codex exec` probe under effective `Never`; it is not claimed as live enforcement on that path. Bare exit-code denial is never used because it failed open in the recorded compatibility probe.
2. **Approval binding.** When the decision is escalate, the approval record binds the exact command/argument hash observed by the hook, the target, the identity, an expiry, and a single-use flag. If the command, arguments, target, or identity change, the approval is void and the hook denies.
3. **Sandbox mapping.** Intent boundary → sandbox/permission-profile flags at session launch. The runtime may never widen these mid-mission without a new authorization event.
4. **Fail closed.** Missing or mismatched mission snapshots/configuration refuse mission start, and hook parsing/internal errors return JSON deny. `axiomgate verify-enforcement` performs the live installed-version probe; doctor warns after version drift. The compatibility record distinguishes this operational probe from per-mission hash verification.
5. **Evidence.** Every hook decision is persisted as an evidence event and appears in the Build Receipt, including denials - a blocked action is proof the gate works.
6. **Governed-state isolation.** Before normal policy evaluation, the hook rejects model-visible writes whose resolved target is under `.axiomgate`. The check covers observed `apply_patch` payload shapes, common shell write/move/delete mechanisms, traversal and mixed-case paths, and structured MCP file-write paths. No `ALLOW` policy can override it. Unknown shell commands are state-changing `UNKNOWN` unless every segment matches the demonstrably read-only allowlist.

The shipped protection is defense in depth around workspace-local state. Moving authoritative policy and approvals outside the model-writable workspace is the stronger long-term design and remains an explicit limitation rather than a cryptographic claim.

## Capability discovery

The architecture can normalize mechanisms such as:

- native Codex tools;
- operating-system commands;
- deterministic CLIs;
- direct APIs;
- browser automation;
- PatchPilot functions;
- MCP tools;
- skill-provided instructions or scripts;
- local applications and services.

The shipped discovery is intentionally narrow: required local CLIs, Git remotes, GitHub/Vercel identity, project metadata, command classification, and explicitly configured MCP tool matchers. General mechanism inventory is deferred. Discovery is read-only by default; do not install, relocate, copy, deduplicate, convert, update, or reconfigure capabilities merely to make them fit AxiomGate.

## Semantic action mapping

Map provider-specific tools and commands to stable actions.

Examples:

```text
GitHub CLI `gh pr create`      -> pull_request.create
GitHub MCP create-PR tool      -> pull_request.create
Vercel CLI preview command     -> preview.deploy
Playwright browser flow        -> browser.verify
PatchPilot verification run    -> verification.run
```

Policy is evaluated against the semantic action, target, identity, and side effects - not against a fashionable protocol name.

## Capability descriptor

For each relevant mechanism, record only verified metadata:

- discovery source;
- mechanism type;
- availability and health;
- semantic actions exposed;
- required identity and credentials;
- filesystem, network, and data access;
- state-changing behavior;
- rollback capability;
- trust and risk;
- version and integrity metadata when available;
- limitations and confidence.

A capability being present does not make it allowed.

## Mission capability policy

Compile a mission-specific policy:

- actions allowed without further approval;
- actions denied;
- actions requiring semantic approval;
- target and environment restrictions;
- credential-profile restrictions;
- read-only versus state-changing limits;
- argument or path restrictions;
- expiry and usage-count limits.

Example:

```text
ALLOW             repository.read on fixture-owner/target-app
ALLOW             branch.create under agent/*
REQUIRE_APPROVAL  pull_request.create
REQUIRE_APPROVAL  preview.deploy to zkauth-preview
DENY              production.deploy
DENY              database.migrate on production
```

## Capability trust checks

Inspect untrusted capability descriptions, scripts, command proposals, and external instructions for:

- prompt or tool-description injection (deny unknown state-changing semantics and retain full description scanning as deferred X5 work; no PatchPilot source is imported);
- hidden authority escalation;
- secret or browser-profile access;
- unexpected filesystem or network scope;
- destructive operations;
- command substitution or argument mutation (enforced structurally by approval binding, not by text analysis).

Deferred beyond Build Week: obfuscated-code detection, executable integrity/signing metadata, and described-versus-observed behavioral analysis. These are research-grade static-analysis problems; claiming them this week would be security theatre. Record coverage and limitations honestly.

## Identity resolution

Resolve and display:

- local project;
- Git remote;
- authenticated GitHub identity (`gh api user` / `gh auth status`);
- repository owner;
- Vercel account/team (`vercel whoami`, `.vercel/project.json`);
- Vercel project;
- environment;
- branch;
- branch and configured project target.

Block ambiguity or mismatch by default.

## Deploy-target existence and ownership proof

Before any `pull_request.create`, `preview.deploy`, or `production.deploy`, resolve the target repository or project through the GitHub/Vercel API and verify that it exists **and** is owned by the account in the project profile. An agent-invented or coincidentally valid target ID must be blocked. (Motivated by the publicly documented 2026 incident in which an agent invented a repository ID and unrelated code was deployed to a customer project.) The verification result - target ID, owner, API response hash - is attached to the action's evidence.

## Intent boundary

Enforce:

- Observe
- Plan
- Modify Local
- Publish
- Deploy Preview
- Deploy Production

A proposed action above the mission boundary is denied with an escalation reason. Approval cannot widen the mission boundary; the user must explicitly update the contract first.

## Semantic approvals

Show:

- action and purpose;
- selected mechanism;
- identity and target;
- data accessed;
- state changed;
- risk;
- rollback;
- expiry and scope;
- raw technical details.

The approved semantic action and target must be bound to the exact technical execution. Changing the command, arguments, identity, or target invalidates approval.

## Effective-permission reconciliation

Record and compare:

1. permission requested;
2. permission approved;
3. permission applied by the runtime;
4. behavior actually observed.

A mismatch fails safely and becomes evidence. A successful command is not proof that permissions were correctly scoped.

## Credential handling

- Store secrets in existing OS/provider stores.
- Resolve credentials only inside trusted adapters.
- Redact process output.
- Never serialize raw secrets into mission state or receipts.

## Explicitly deferred

The Build Week implementation does not include:

- universal skill installation;
- shared skill-folder migration;
- duplicate-file cleanup across agents;
- MCP registry ownership;
- client configuration generation;
- a universal MCP broker or gateway;
- plugin conversion between providers;
- marketplace or update management.

These may be reconsidered only if the vertical mission produces measured evidence that one is required.
