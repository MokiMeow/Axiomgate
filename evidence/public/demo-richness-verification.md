# Hosted demo richness and live refresh verification

Verified on 2026-07-20 from the repository workspace. All records shown here are synthetic SAMPLE data. No account, token, private path, or live quota value is included.

## Curated mission set

The deterministic generator produced eight missions:

| Mission | Demonstrated state | Gate |
| --- | --- | --- |
| Brute-force login lockout | Five criteria proven, deny event, dependency failure remediated | COMPLETE |
| Per-IP rate limiting | Four criteria proven, one UNVERIFIED | INCOMPLETE |
| Preview target ownership | Wrong-target `EXISTS_NOT_OWNED` deny | INCOMPLETE |
| Session validation update | Governed-state write deny | INCOMPLETE |
| Lodash dependency upgrade | Dependency FAIL followed by targeted PASS | COMPLETE |
| Webhook rotation verification | One visible WAIVED criterion with reason and risk | COMPLETE |
| Registration validation | Exact-command approval pending | INCOMPLETE |
| Login configuration audit | Read-only OBSERVE mission | COMPLETE |

Every receipt was generated with the canonical evidence gate and receipt implementation. Tests verify that a COMPLETE receipt has only PASS or WAIVED criteria and that the blocked mission cannot report COMPLETE.

Generator repeatability:

```text
generated 8 SAMPLE missions; flagship msn_demo_lockout: COMPLETE, 5 chained evidence records
missions deterministic: True
capacity deterministic: True
```

## Hosted API proof

```text
PASS GET /: landing static entry found
PASS GET /dashboard: dashboard static entry found
PASS GET /api/missions: eight explicitly labelled SAMPLE missions
PASS GET /api/mission/:id: curated mission and COMPLETE receipt returned
PASS GET /api/capacity: capacity is explicitly SAMPLE
PASS POST /api/approve: hosted demo remains read-only
```

## Refresh proof

The dashboard polls mission summaries and the selected mission every 3 seconds for local live data, uses a slower 10 second interval for hosted SAMPLE data, and polls capacity every 60 seconds. Polling pauses while the document is hidden. Key-sorted content hashing prevents a rerender when the returned record has not changed, so selection and scroll remain stable.

The approval-cycle test created a canonical exact-hash, single-use approval, approved it on the Telegram surface, consumed it through the hook store, and verified that the next detail payload changed and the pending list became empty within the configured 3 second cycle.

```text
Test Files  33 passed (33)
Tests       326 passed | 1 skipped (327)
```

## Visual captures

- [Eight-mission Mission Control](demo-richness-dashboard.png)
- [Pending approval in Approval Queue](demo-richness-approval-queue.png)

Both captures show `hosted-demo · SAMPLE`. The hosted approval card states that approvals become interactive only when AxiomGate is run locally.

## Repository gates

```text
typecheck: PASS
build: PASS
punctuation: PASS, 0 em dashes and 0 en dashes across 270 tracked text files
Markdown quality: PASS, 81 substantive tracked files
Markdown links: PASS, 130 relative targets across 81 tracked Markdown files
```

## Hosted deployment

The verified web commit was deployed to Vercel production through the authenticated CLI. Vercel reported deployment `dpl_Dqe57KgMBs3TAg6Gf7KcCDNGE5XE` as `READY`, with four Node functions for approvals, capacity, mission detail, and mission summaries.

- Production demo: [axiomgate-eta.vercel.app](https://axiomgate-eta.vercel.app/)
- Dashboard: [axiomgate-eta.vercel.app/dashboard](https://axiomgate-eta.vercel.app/dashboard)

The shorter requested alias `axiomgate.vercel.app` was unavailable because Vercel reported that it was already in use. No claim is made over that alias.
