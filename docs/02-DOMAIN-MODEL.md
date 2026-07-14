# Domain Model

## Mission

A versioned request to achieve a bounded software outcome.

Fields include:

- ID;
- objective;
- target project;
- acceptance criteria;
- constraints;
- non-goals;
- required evidence;
- maximum intent boundary;
- budget policy;
- model policy;
- capability policy;
- status;
- timestamps;
- contract hash.

## Acceptance criterion

A testable outcome with:

- statement;
- risk;
- required evidence types;
- current verdict;
- evidence references;
- waiver record if applicable.

Verdicts:

- `UNVERIFIED`
- `PASS`
- `FAIL`
- `BLOCKED`
- `WAIVED`
- `UNKNOWN`

## Capacity source

Represents:

- included allowance;
- rolling window;
- weekly limit;
- banked reset;
- promotional credit;
- purchased credit;
- API budget;
- workspace pool;
- unlimited;
- unknown.

Each source retains unit, remaining amount, reset/expiry time, observation source, confidence, and activation requirements.

## Model plan

Phase-specific model, provider, reasoning effort, expected role, budget range, and escalation policy.

## Semantic action

A stable description of what the runtime proposes to do, independent of the mechanism used to do it.

Examples:

- `repository.read`
- `file.modify`
- `branch.create`
- `pull_request.create`
- `preview.deploy`
- `production.deploy`
- `database.query_readonly`
- `database.migrate`
- `browser.verify`
- `verification.run`

A semantic action records target type, side effects, data access, reversibility, risk, required intent boundary, and required evidence.

## Capability descriptor

A normalized description of an already available mechanism that can perform one or more semantic actions.

Fields may include:

- ID and display name;
- mechanism type: native tool, CLI, API, browser, MCP, skill, local application, or script;
- discovery source;
- availability and health;
- provider/client scope;
- supported semantic actions;
- identity or credential profile required;
- filesystem, network, and data access;
- state-changing behavior;
- trust level and risk;
- version and integrity metadata when available;
- limitations;
- observation time and confidence.

A descriptor is inventory, not authorization.

## Capability policy

Mission-scoped decisions for semantic actions and mechanisms:

- `ALLOW`
- `DENY`
- `REQUIRE_APPROVAL`
- `UNAVAILABLE`
- `UNKNOWN`

The policy may restrict targets, identities, environments, command arguments, data scope, time, or number of uses.

## Project profile

Maps:

- local path;
- Git remote;
- repository owner;
- GitHub credential handle;
- Vercel credential handle;
- Vercel team/project;
- environments;
- branch policy;
- deployment policy;
- security policy;
- budget policy.

## Action request

Typed proposed side effect with:

- semantic purpose;
- target;
- selected mechanism;
- required permission;
- intent boundary;
- data access;
- rollback;
- risk;
- raw technical command or call, when applicable;
- requesting agent;
- mission;
- expiry.

## Approval

Records the exact action, target, scope, identity, limits, and expiry the user approved, not a generic “yes”.

## Effective permission observation

Records whether the requested, approved, runtime-applied, and observed permissions agree.

## Finding

A verified or candidate issue from tests, security, dependency, or deployment checks. (Browser findings: only if stretch X1 ships. Maintainability findings: diff-size warning via stretch X2 only; full analysis post-hackathon.)

## Evidence

Immutable reference to an observed result, including:

- source;
- capture time;
- command or API;
- hash;
- redaction status;
- related criterion;
- freshness.

## Build Receipt

Projection of stored mission, action, model, capacity, verification, approval, capability-policy, and evidence records.

## Canonical schemas (normative sketches)

Implementations must start from these shapes so parallel agents do not invent divergent ones. Extend with care; never remove a field silently.

```jsonc
// MissionContract v1
{
  "id": "msn_01H...",
  "version": 1,
  "hash": "sha256:...",
  "objective": "Add brute-force lockout to login endpoint",
  "projectProfileId": "prj_...",
  "intentBoundary": "PUBLISH",          // OBSERVE|PLAN|MODIFY_LOCAL|PUBLISH|DEPLOY_PREVIEW|DEPLOY_PRODUCTION
  "acceptanceCriteria": [
    { "id": "ac1", "statement": "5 failed logins lock the account for 15 minutes",
      "risk": "high", "evidenceTypes": ["test_result"], "verdict": "UNVERIFIED", "evidenceIds": [] }
  ],
  "constraints": [], "nonGoals": [],
  "actionPolicy": [
    { "action": "repository.read", "decision": "ALLOW" },
    { "action": "branch.create", "decision": "ALLOW", "restrict": { "branchPrefix": "agent/" } },
    { "action": "pull_request.create", "decision": "REQUIRE_APPROVAL" },
    { "action": "preview.deploy", "decision": "REQUIRE_APPROVAL", "restrict": { "vercelProject": "..." } },
    { "action": "production.deploy", "decision": "DENY" }
  ],
  "modelPlan": [
    { "phase": "scout", "model": "gpt-5.6-luna", "effort": "low", "rationale": "structured mapping" },
    { "phase": "build", "model": "gpt-5.6-sol", "effort": "high", "rationale": "security-sensitive" },
    { "phase": "remediate", "model": "gpt-5.6-terra", "effort": "medium", "rationale": "bounded fixes" }
  ],
  "status": "DRAFT", "createdAt": "...", "updatedAt": "..."
}
```

```jsonc
// ActionRequest v1 (produced by hook interception)
{
  "id": "act_...", "missionId": "msn_...",
  "semanticAction": "pull_request.create",
  "mechanism": "gh_cli",
  "target": { "type": "github_repo", "owner": "...", "repo": "...", "verifiedOwnership": true },
  "identity": { "githubLogin": "...", "source": "gh api user" },
  "rawCommandHash": "sha256:...",        // exact command+args seen by the hook
  "intentBoundaryRequired": "PUBLISH",
  "risk": "medium", "rollback": "close PR",
  "decision": "AWAITING_APPROVAL",       // ALLOW|DENY|AWAITING_APPROVAL|EXPIRED
  "requestedAt": "...", "expiresAt": "..."
}
```

```jsonc
// Approval v1
{
  "id": "apr_...", "actionRequestId": "act_...",
  "boundCommandHash": "sha256:...",      // approval void if execution hash differs
  "surface": "telegram",                 // dashboard|cli|telegram
  "approver": "user", "singleUse": true,
  "grantedAt": "...", "expiresAt": "...", "consumedAt": null
}
```

```jsonc
// Evidence v1
{
  "id": "ev_...", "missionId": "msn_...", "criterionId": "ac1",
  "source": "command",                   // command|api|hook — NEVER "model"
  "command": "npm test", "exitCode": 0,
  "outputHash": "sha256:...", "outputRef": ".local/evidence/ev_....log",
  "capturedAt": "...", "freshForCommit": "abc123",
  "label": "LIVE",                       // LIVE|SANDBOX|REPLAY
  "redacted": true
}
```

```jsonc
// BuildReceipt v1 (projection only — derived from stored events)
{
  "missionId": "msn_...", "contractHash": "sha256:...",
  "repo": { "remote": "...", "branch": "...", "commit": "..." },
  "identities": { "github": "...", "vercel": "..." },
  "modelUsage": [ { "phase": "build", "model": "gpt-5.6-sol", "effort": "high", "tokens": { "input": 0, "output": 0, "reasoning": 0 } } ],
  "capacityLedger": { "estimated": {}, "actual": {}, "sourceLabels": {} },
  "actions": [ /* ActionRequests with decisions, approvals, permissionQuad */ ],
  "permissionQuad": { "requested": "...", "approved": "...", "applied": "...", "observed": "..." },
  "criteria": [ { "id": "ac1", "verdict": "PASS", "evidenceIds": ["ev_..."] } ],
  "findings": [], "waivers": [],
  "outcome": "COMPLETE",                 // COMPLETE|INCOMPLETE|ABORTED
  "evidenceChainHead": "sha256:...", "limitations": [],
  "generatedAt": "..."
}
```
