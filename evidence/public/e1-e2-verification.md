# E1-E2 Evidence Gate verification

Captured 2026-07-15 IST. Runtime artifacts and the tampered copy remain under ignored `.local/verifytest/`; this file contains sanitized judge-facing results.

## Automated gates

```text
pnpm typecheck
Scope: 2 of 3 workspace projects
packages/axiomgate-core typecheck: Done
apps/cli typecheck: Done

pnpm test
Test Files  16 passed (16)
Tests       161 passed | 1 skipped (162)

pnpm build
Scope: 2 of 3 workspace projects
packages/axiomgate-core build: Done
apps/cli build: Done
```

The skipped test is the existing opt-in identity smoke test gated by `AXIOM_LIVE_SMOKE=1`.

E1 tests cover all-fresh PASS, missing/stale UNVERIFIED, FAIL/BLOCKED/UNKNOWN propagation, schema rejection of model-sourced Evidence, complete and incomplete gates, visible attributed waivers, permission-quad mismatch reporting, waiver persistence, and status projection from stored records.

E2 tests cover deterministic projection, exclusion of advisory model prose, canonical JSON embedded in readable Markdown, intact-chain verification, byte tampering, record reordering, contract-hash tampering, criterion-citation tampering, stale/model/missing Evidence false-green rejection, and completion-gate recomputation.

## Live proof table

Command:

```text
axiomgate mission status msn_1af4f266df33453f8f7d --project .local/verifytest
```

Real output:

```text
Criterion | Verdict | Evidence
criterion_implement | PASS | evd_a3196185d1074ca6863d, ev_run_7ef490fcdc464877a28b
criterion_regression | PASS | evd_6832e0c161754b518c88
criterion_security | PASS | evd_2c6080c18e104bcbb073
criterion_secrets | PASS | evd_3be4710799d44560a5a3
Gate: COMPLETE
```

All cited records are admissible (`command`, `api`, or `hook` only), successful, and fresh for the mission's current `WORKTREE:<HEAD>` revision marker. Advisory verifier prose is not an input to these verdicts.

## Receipt and offline verification

Command:

```text
axiomgate mission receipt msn_1af4f266df33453f8f7d --format md --project .local/verifytest
```

Real result:

```text
Outcome: COMPLETE
Evidence chain: sha256:533815f1b74dcb667998b15cdaa52c7b09a2283a033af97f20bbe2b1bca0c9f3
```

The generated Markdown contains a readable mission/criteria/evidence projection and the same canonical receipt payload used by the offline verifier.

Command:

```text
axiomgate receipt verify .local/verifytest/evidence/msn_1af4f266df33453f8f7d-receipt.md
```

Real output and exit status 0:

```text
PASS receipt integrity
CHECKED: contract hash
CHECKED: 25 chained evidence records
CHECKED: criterion evidence citations
CHECKED: criterion verdicts and completion gate
```

## Live tamper rejection

A copy of the Markdown receipt was modified with one manual change in its embedded first Evidence record:

```text
outputHash: sha256:e3b0...b855
        -> sha256:ffff...ffff
```

Command:

```text
axiomgate receipt verify .local/verifytest/evidence/msn_1af4f266df33453f8f7d-receipt-tampered.md
```

Real output and exit status 1:

```text
FAIL receipt integrity
ERROR: Evidence chain hash mismatch at record 1 (evd_aa6a4dd43b0245d89d50)
```

## Integrity boundaries and limitations

- Receipt generation adds the embedded MissionContract, chained Evidence records, and per-criterion evidence-chain hashes to the normative sketch. These fields are required for an offline verifier to recompute rather than trust contract, citation, freshness, and gate claims.
- Evidence v1 has no explicit `evidenceType`; E1 uses one deterministic tested classifier over stored `source` and `command` fields. Freshness always requires an explicit current revision marker and is never inferred from the records.
- Hash chaining proves internal consistency and detects ordinary modification/reordering, but it is unsigned. It does not prove publisher authenticity against an attacker who can rewrite the entire receipt and recompute every hash. The receipt records this limitation; optional signing remains outside E1/E2.
- Non-approval hook events do not persist the full transient ActionRequest. Their receipt action therefore retains the stored hook-derived permission quad with `request: null`; approval-gated actions retain their persisted request and approval.
- Permission-quad mismatches are visible and carried into the receipt. Per [`docs/design/08-EVIDENCE-GATE.md`](../../docs/design/08-EVIDENCE-GATE.md), mission completion itself is determined by criterion PASS/WAIVED state; mismatches are not silently discarded.
- HTML output was not implemented because it is explicitly post-hackathon scope.
