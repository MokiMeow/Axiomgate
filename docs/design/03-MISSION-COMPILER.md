# Mission Compiler

## Goal

Convert an informal request into a stable, testable mission without over-constraining Codex’s implementation freedom.

## Inputs

- required objective text;
- governed project path, represented by a project profile ID in the contract;
- optional intent boundary (default `MODIFY_LOCAL`);
- optional JSON criteria file containing 3-6 criteria;
- current resolved identity for the mission snapshot;
- the built-in action-policy, model-plan, and 20% verification-reserve defaults.

## Build Week compilation scope (ADR-008)

The Build Week compiler is a schema and an editor, not an NLP system:

1. read the objective;
2. create 3-6 acceptance criteria;
3. select evidence types per criterion;
4. set the intent boundary;
5. apply the action-policy template from the project profile;
6. detect one direct policy conflict (objective vs. profile policy) and surface it;
7. hash and version the accepted contract.

## Instruction compilation (post-hackathon - do not implement for Build Week)

Full discovery and classification of user/project/repository/provider/external/untrusted instruction sources, duplicate-rule and stale-path detection, unsupported-directive analysis, and compiler-side prompt-injection classification. Prompt-injection handling belongs to the [Environment Guard](05-ENVIRONMENT-GUARD.md).

## Output contract

A mission contract must include:

- objective;
- acceptance criteria;
- constraints;
- explicit non-goals;
- target project/environment;
- intent boundary;
- evidence requirements;
- per-criterion risk classification;
- budget and model policies;
- action policy: allowed, denied, and approval-required semantic actions;
- version, timestamps, status, and canonical hash.

## User review

Creation prints the mission ID, version, boundary, model plan, criteria, contract path, and any direct production-policy conflict. The generated `contract.json` is editable. `axiomgate mission update <id>` revalidates it, migrates legacy model-plan fields, increments the version, re-hashes the contract, refreshes identity, and regenerates the hook snapshot before execution.

## Versioning

Any material contract change creates a new version and hash. Existing evidence remains bound to the version under which it was created.

## Completion criteria

- contradictory instructions are surfaced;
- the contract is machine-readable;
- every criterion can be independently verified;
- authority is explicit;
- no criterion relies only on subjective model judgment.
