# Product Vision

## Problem

Coding agents are increasingly capable of producing code, yet the developer remains responsible for failures that occur around generation:

- vague goals and shifting completion criteria;
- usage and credit exhaustion;
- model switches that lose continuity;
- commands and integrations with excessive authority;
- wrong GitHub or deployment account;
- hidden authority escalation;
- insecure or bloated generated code;
- agents declaring completion without proof;
- approvals that expose commands but not consequences.

## Vision

A developer should be able to hand Codex a meaningful mission and know:

- the mission is bounded;
- the resource plan is visible;
- the right model is used for each phase;
- only mission-relevant actions are permitted;
- credentials and environments are correct;
- consequential actions require understandable approval;
- every completion criterion is verified;
- the final result is auditable.

## Core promise

> AxiomGate permits Codex to generate freely within a mission, but allows it to act only within explicit authority and allows it to claim completion only with externally verifiable evidence.

## Differentiation

AxiomGate is not differentiated by a skill installer, MCP manager, quota meter, scanner, or approval button. Its value is the governed chain connecting mission intent to verified outcome.

## Capability philosophy

AxiomGate does not own the ecosystem of skills, MCP servers, plugins, CLIs, APIs, or provider-native tools. Those are capability mechanisms. AxiomGate owns the policy question:

> What action may Codex perform, on which target, using which identity, under what authority, and what evidence must result?

This keeps the product durable even when providers change their preferred tool protocol.

## Product principles

1. Local-first.
2. Codex-first for Build Week.
3. Cross-provider architecture without false parity claims.
4. Evidence over narration.
5. User authority over automatic spending or deployment.
6. Native capability reuse before custom abstraction.
7. Explicit uncertainty.
8. Minimal relevant context and action exposure.
9. Verification reserve before optimization.
10. Clean, testable, maintainable engineering.

## Success metrics

Measure, do not invent. Build Week metrics:

- mission acceptance criteria verified;
- unsafe actions blocked;
- wrong-identity and wrong-target actions blocked;
- estimated versus actual token usage;
- verification capacity preserved;
- loop interventions;
- approval-required actions correctly intercepted;
- effective permissions matching approved permissions;
- time to resume after a rate-limit interruption;
- findings remediated and reverified;
- judge setup and replay time;
- real installs and governed missions run by external developers.

Future metrics (post-hackathon): time to recover after model/session transitions, maintainability delta, cross-provider coverage.

## Non-goals for the hackathon

- full enterprise policy administration;
- full provider parity;
- a public skill marketplace;
- a universal capability installer or MCP gateway;
- automatic migration of tool configurations between agents;
- an autonomous production deployer;
- a new coding model;
- exact subscription-consumption prediction;
- replacement of all provider interfaces.
