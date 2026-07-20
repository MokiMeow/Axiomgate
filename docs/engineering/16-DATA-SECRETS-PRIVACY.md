# Data, Secrets, and Privacy

## Storage classes

### Public

Sanitized documentation, deterministic fixtures, public evidence, example receipts.

### Repository-private

Source code and project configuration intended for collaborators.

### Local private

Raw logs, browser state, provider usage, test accounts, recordings, temporary databases, agent transcripts.

### Secret

Tokens, cookies, private keys, OAuth refresh tokens, credential-store references that reveal secrets.

## Rules

- Secret values never enter Git.
- Secret values should not enter model context.
- Environment variable names may be recorded; values may not.
- Approval messages contain scoped summaries, not secrets.
- Build Receipts use profile identifiers, never tokens.
- Screenshots require manual review.
- Logs are redacted before persistence.
- Browser automation is opt-in and isolated.
- Connected Chrome does not imply connected Gmail or other services.

## Test data

- Local/private tests use `.local/`.
- Public fixtures are synthetic and sanitized.
- Demo data must be clearly labelled.
- Never use real user data for judge replay.

## Retention

Allow the user to inspect and delete mission state, evidence, local recordings, and provider observations.

## Export

Exports must state whether content is public-safe, private, or secret-bearing.
