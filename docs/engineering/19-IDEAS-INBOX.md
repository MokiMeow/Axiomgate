# Ideas Inbox

New ideas belong here before entering scope.

## Admission rule

An idea is accepted only if it:

- strengthens the one vertical mission;
- fits an existing product layer;
- solves a verified user problem;
- can be tested;
- does not materially threaten core completion;
- has a clear demo or long-term value.

## Idea template

```text
Title:
Date:
Source/evidence:
Problem:
Proposed behavior:
Product layer:
User value:
Implementation complexity:
Security/privacy risk:
Effect on three-minute demo:
Alternative:
Recommendation: Accept | Defer | Reject
Decision reference:
```

## Deferred ideas

- public skill marketplace;
- full enterprise team management;
- full mobile app;
- every cloud provider;
- universal provider parity;
- autonomous production deployment;
- social collaboration features.

## Rule for agents

Do not implement an inbox idea until it is accepted and converted into a task with acceptance criteria.

## Accepted: HTTP boundary and dependency hardening

- Date: 2026-11-07.
- Evidence: real local HTTP regressions reproduced untrusted Host data access and
  malformed URL process failure; the registry audit flagged 14 existing advisories.
- Problem: loopback reachability is not a browser origin boundary, and old test/core
  dependencies contain published security fixes absent from the lockfile.
- Proposed behavior: reject untrusted requests before routing, preserve canonical
  approvals, update affected pinned dependencies, and enforce cross-platform CI.
- Product layers: Environment Guard and dashboard adapter; Verification Engine tooling.
- Benefit: protected local state and repeatable proof on every main update.
- Complexity and risk: bounded HTTP adapter changes plus one test-runner major
  upgrade, validated by full tests and packed-distribution verification.
- Demo effect: no visual redesign or hosted data change; local approval clients must
  use same-origin JSON. The historical published release remains unchanged.
- Recommendation: Accept under the user's research-first security improvement scope.
- Decision reference: ADR-018 and task H1.
