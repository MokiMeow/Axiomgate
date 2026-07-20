# Repository Hygiene

## Goal

Keep the repository small, understandable, reproducible, and safe.

## Structure

- production source in established app/package directories;
- docs in `docs/`;
- execution work in `docs/build-log/`;
- public fixtures in `tests/fixtures/public/`;
- judge fixtures in `demo/fixtures/`;
- reviewed evidence in `evidence/public/`;
- raw/private artifacts in `.local/`.

## Prohibited junk

- duplicate backup folders;
- `final-final` files;
- abandoned prototypes;
- temporary scripts in root;
- generated logs;
- private recordings;
- vendored package caches;
- unused dependencies;
- stale documentation copies;
- commented blocks of replaced code;
- screenshots without purpose.

## Cleanup checkpoint

At the end of each phase:

- list untracked files;
- inspect ignored growth;
- remove dead code;
- check dependency usage;
- check stale docs;
- check duplicate helpers;
- check TODO/FIXME;
- verify no secrets;
- confirm a clean working tree after commit.

## TODO policy

Every TODO must contain a task ID or be removed before submission.

## Generated evidence

Keep only evidence required to support claims. Prefer scripts that regenerate evidence over large committed output.
