# Mission Compiler

## Goal

Convert an informal request into a stable, testable mission without over-constraining Codex’s implementation freedom.

## Inputs

- user request;
- project profile;
- repository instructions;
- global user policies;
- relevant semantic actions and available execution mechanisms;
- existing architecture;
- current Git state;
- requested deadline and budget;
- authorization level.

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

Full discovery and classification of user/project/repository/provider/external/untrusted instruction sources, duplicate-rule and stale-path detection, unsupported-directive analysis, and compiler-side prompt-injection classification. (Prompt-injection scanning of untrusted content is Environment Guard's job - `docs/05`.)

## Output contract

A mission contract must include:

- objective;
- business/user outcome;
- acceptance criteria;
- constraints;
- explicit non-goals;
- target project/environment;
- intent boundary;
- evidence requirements;
- risk classification;
- budget and model policies;
- capability policy: allowed, denied, and approval-required semantic actions;
- approval points;
- rollback expectation.

## User review

Show changes from the original request:

- assumptions introduced;
- ambiguities resolved;
- scope reduced;
- constraints added;
- evidence required.

The user must be able to edit the mission before execution.

## Versioning

Any material contract change creates a new version and hash. Existing evidence remains bound to the version under which it was created.

## Completion criteria

- contradictory instructions are surfaced;
- the contract is machine-readable;
- every criterion can be independently verified;
- authority is explicit;
- no criterion relies only on subjective model judgment.
