# Code Quality Standard

## Priorities

1. Correctness
2. Security
3. Clarity
4. Testability
5. Maintainability
6. Performance
7. Concision

## Clean code rules

- Use explicit domain types.
- Avoid boolean-heavy APIs.
- Keep side effects behind interfaces.
- Keep policy pure where possible.
- Avoid giant service classes.
- Avoid speculative abstraction.
- Do not duplicate validation.
- Return typed errors.
- Preserve causal error context.
- Avoid silent fallback.
- Document surprising behavior.
- Keep provider-specific logic in adapters.
- Keep UI components free of orchestration logic.

## Formatting and linting

Use the existing repository toolchain. If absent, propose a minimal standard during Phase 0. Do not mass-format unrelated existing code in feature commits.

## Dependencies

Before adding a package:

- verify maintenance;
- inspect license;
- inspect transitive risk;
- compare existing implementation;
- record reason;
- pin appropriately;
- add test coverage.

## Performance

Do not optimize blindly. Measure. Prefer incremental scanning, caching with valid invalidation, bounded concurrency, and streaming.

## Maintainability gate

For each major mission, compare the codebase before and after. A functionally passing but structurally degraded implementation is not complete.

## Review checklist

- Does the design match the domain?
- Is authority checked before side effect?
- Can it be tested without the UI?
- Are failures observable?
- Are secrets impossible to serialize?
- Is rollback possible?
- Is the diff smaller than a simpler alternative?
