# Phase 7 - Hardening

> Historical phase plan. Use [TASKS.md](TASKS.md) and the [implementation status](../engineering/21-IMPLEMENTATION-STATUS.md) for current completion claims.

Aligned to board task **S1** (ADR-008).

## Outcome

The vertical implementation is reliable, secure, fast, clean, and reproducible.

## Work

- Execute threat-model tests.
- Run dependency/license/secret audits.
- Test clean Windows setup.
- Test backup, migration, and rollback.
- Test crash, interruption, and resume.
- Measure startup, memory, scan, verification, and receipt performance.
- Remove dead code and unused dependencies.
- Audit logs and screenshots for secrets.
- Review documentation against actual behavior.
- Conduct independent adversarial review.
- Fix and rerun.

## Exit criteria

All critical/high findings are resolved or transparently documented as blocking limitations.
