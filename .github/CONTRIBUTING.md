# Contributing

## Branching

- Use one branch per coherent task.
- Never work directly on the protected default branch.
- Name branches `type/short-purpose`, for example `feat/runway-capacity-normalization`.

## Pull requests

Every pull request must include:

- problem and scope;
- linked task IDs;
- implementation summary;
- test commands and real results;
- screenshots or evidence for UI changes;
- security and privacy impact;
- migration and rollback notes;
- documentation updated;
- known limitations.

Use `.github/pull_request_template.md`.

## Review

High-risk changes require:

- independent review;
- negative tests;
- permission-boundary tests;
- evidence that the actual external target was not production;
- a rollback test when state is mutated.

## Commit quality

Commits must be atomic and truthful. Do not bundle formatting of unrelated files, dependency upgrades, refactors, and features into one commit.

## Generated files

Do not commit:

- raw model logs;
- private screenshots;
- browser profiles;
- temporary databases;
- node_modules or build output;
- locally generated certificates;
- provider usage exports containing account details;
- test recordings containing secrets.

Use `.local/`.
