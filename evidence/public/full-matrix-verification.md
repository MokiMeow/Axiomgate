# Full-system validation matrix

> Historical snapshot and supersession: this matrix records source revision
> `bc012e8` against npm `0.1.0` and is intentionally not rewritten as current
> state. For the latest release/publication proof use
> [`repo-curation-verification.md`](repo-curation-verification.md); for the
> actual headline run use
> [`headline-run-verification.md`](headline-run-verification.md); for the
> completed Telegram surface use
> [`telegram-verification.md`](telegram-verification.md); and for the latest
> authority mitigation and 309-test result use
> [`authority-hardening-verification.md`](authority-hardening-verification.md).

Date: 2026-07-20 IST  
Source revision: `bc012e8`  
Published package tested: `axiomgate@0.1.0`  
Codex CLI observed: `0.144.6`

This matrix distinguishes current source, the already-published npm artifact, deterministic fixtures, and live provider behavior. `PARTIAL` and `FAIL` are intentional truth labels, not omitted checks. No production deploy, Git push, npm publish, real credential, full Telegram chat ID, or private filesystem path appears here.

## Master matrix

| Capability | Surface | Right path | Wrong path | Edge path | Result |
|---|---|---|---|---|---|
| Published doctor | npm / CLI | Fresh consumer returned Node, Codex, Git, quota, and native-integration status with exit 0 | Unavailable capacity is rendered explicitly in isolated Codex home | No credentials printed | PASS |
| Published help | npm / CLI | `npx -y axiomgate@0.1.0 --help` returned exit 0 | Unknown command returns usage and non-zero | Windows command shim worked | PASS |
| Published replay all | npm / CLI | All three governance scenarios returned PASS | N/A - aggregate command has no malformed payload | Credential-free and deterministic | PASS |
| Published individual replays | npm / CLI | N/A - `0.1.0` does not dispatch individual scenarios | Each documented scenario returned usage and exit 1 | Current source now supports all three; release still required | FAIL (published), PASS (source) |
| Published receipt verify | npm / CLI | Valid fixture returned exit 0 | One-byte/hash tamper returned exit 1 | Offline and account-free | PASS |
| Public npm metadata | npm registry | Version, bin, Node engine, description, README quickstart, and proof pitch present | N/A - registry metadata read succeeded | npm web page returned HTTP 403 to the browsing environment; registry API remained readable | PARTIAL |
| Public GitHub repository | GitHub | Repository and README render publicly; badges and screenshots resolve | Public branch predates the validated matrix source | Public README still describes Telegram as unfinished | FAIL (publication drift) |
| Plugin marketplace install | Codex plugin / isolated home | Marketplace add, plugin add, list, MCP registration, skill, and verifier all passed | Invalid global local snapshot is reported rather than silently loaded | Isolated home has no account quota until user login | PASS (public plugin), local drift noted |
| MCP through Codex | Codex + MCP | Authenticated Luna called mission-list and receipt-verify successfully | N/A - malformed calls covered by direct stdio row | Fresh isolated home installation was inspected without copying private auth | PASS |
| Dashboard real mode | Web | Real mission workspace returned `demo:false` | Missing mission returned 404 | Resolved approvals no longer appear pending | PASS |
| Dashboard demo mode | Web | Clean workspace returned bundled sample and `demo:true` | N/A - explicit demo fallback is intended | Banner code and SAMPLE label present | PASS |
| Dashboard approve | Web / canonical store | Approve persisted `surface:dashboard` | Cross-origin and invalid body fixtures reject | Approved request disappears from pending list | PASS |
| Dashboard deny | Web / canonical store | Deny persisted `deniedSurface:dashboard` | Canonical rejection returns conflict, not success | Denied request disappears from pending list | PASS |
| Luna / Light | Governed runtime | Fresh session, exit 0, actual usage stored | Shared publish probe denied by hook | Run record stores display `light` and wire `low` | PASS |
| Terra / Medium | Governed runtime | Fresh session, exit 0, actual usage stored | Shared publish probe denied by hook | Distinct session from builder peers | PASS |
| Sol / High | Governed runtime | Fresh session, exit 0, actual usage stored | Shared publish probe denied by hook | No-progress advisory appeared without blocking | PASS |
| Luna / Xhigh | Governed runtime | Fresh session, exit 0, actual usage stored | Shared publish probe denied by hook | Run permitted because weekly usage was below 50% | PASS |
| Luna / Max | Governed runtime | Fresh session, exit 0, actual usage stored | Shared publish probe denied by hook | Run permitted because weekly usage was below 50% | PASS |
| Shared model enforcement | Hook | N/A - probe intentionally requested `git push` | JSON deny emitted and hook evidence appended | Disposable workspace lacked Git identity, so denial was fail-closed | PASS |
| Mission create | PLAN / CLI | Default mission and production-conflict mission created | Bad boundary returned non-zero with accepted values | Production objective emitted explicit conflict, not silent widening | PASS |
| Criteria input | PLAN / CLI | Valid criteria covered by `demo:check` | Missing file returned non-zero | Current source now uses a readable criteria-file error instead of a false mission-ID error | PASS |
| Mission update | PLAN / CLI | Version 1 to 2, contract re-hashed, snapshot regenerated | Invalid/missing mission returns non-zero | Legacy effort migration covered by fixtures | PASS |
| Model plan | PLAN / CLI | Scout Light, build High, remediate Medium, verify High displayed | Invalid effort rejected | Ultra is labeled native multi-agent mode, not an effort tier | PASS |
| Identity resolution | GUARD / core | Resolved identity fixture and live root identity paths pass | Missing/malformed tools return UNAVAILABLE | No guessing and no throw | PASS |
| Deploy-target proof | GUARD / core | Owned verdict fixture passes | Not-owned and 404 fixtures deny | Tool unavailable returns typed UNAVAILABLE | PASS |
| Policy engine | GUARD / core | Allow and approval policies pass | Unknown, boundary escalation, identity, target, and explicit deny cases reject | Deterministic 20-case matrix | PASS |
| Approval store | GUARD / CLI/core | Approve, deny, list, and exact consume pass | Mutated, expired, reused, and wrong-request cases reject | File lock protects races | PASS |
| Hook contract | GUARD / Codex | Allow emits JSON allow and event | Deny/malformed/internal error emit JSON deny and event | Never relies on exit code 2 alone | PASS |
| Enforcement install check | GUARD / live Codex | Live probe returned PASS on Codex 0.144.6 | Offline/config and drift cases covered by fixtures | Verification record updated for installed version | PASS |
| PermissionRequest reviewer | GUARD / fixture + prior live evidence | User reviewer delegates to AxiomGate policy | Unknown reviewer fails safe | Guardian reviewer defers without double prompt | PASS |
| Negative threat suite | GUARD / tests | N/A - suite is intentionally adversarial | 15 named threats denied or flagged with evidence | Secret output is redacted | PASS |
| Governed run | RUN / live Codex | Five model runs succeeded with sessions and usage | Invalid mission returned non-zero | Runway loop advisory did not fake failure | PASS |
| Checkpoint and resume | RUN / fixtures + prior evidence | Resume args preserve governance | Missing/truncated stream checkpoints | Rate-limit reset UNKNOWN stays explicit | PASS |
| Independent verifier | RUN / prior live evidence | Fresh verifier session produced advisory findings | Malformed output becomes UNKNOWN | Findings do not mutate criterion verdicts | PASS |
| Verification plan | VERIFY / tests | Criteria and diff map to required checks | Missing required check prevents green | Unknown check prevents PASS | PASS |
| Target tests and build | VERIFY / demo fixture | Install, 4 baseline tests, and build passed | Dedicated lockout spec fails before remediation as designed | Synthetic fixture has no real users/secrets | PASS |
| Dependency scan | VERIFY / PatchPilot | Repository scan is clean after patch | Initial scan found reachable Vitest advisory | Production audit was clean before and after | PASS |
| Secret scan | VERIFY / tests | Clean diff ignored | Planted fake token detected | Heuristic fallback is labeled | PASS |
| Remediation | VERIFY / prior headline evidence | Governed dependency remediation and affected-check rerun passed | Invalid finding rejects | Advisory verifier prose remains inadmissible | PASS |
| Stale evidence | VERIFY / tests | Current commit evidence counts | Commit mismatch becomes STALE and excluded | Regeneration restores eligibility | PASS |
| Criterion verdicts | PROVE / CLI/core | Fresh admissible evidence produces PASS | Missing, stale, model, FAIL, BLOCKED, UNKNOWN prevent PASS | Explicit waiver remains visible | PASS |
| Completion gate | PROVE / CLI | Complete receipt fixture verifies | Incomplete matrix mission exits non-zero with exact blockers | Permission-quad mismatch is visible | PASS |
| Waiver | PROVE / CLI | Attributed waiver persisted and rendered | Unwaived criteria still block | Waiver does not fabricate evidence | PASS |
| Receipt generation | PROVE / CLI | Complete headline receipt regenerated from stored evidence | N/A - incomplete generation behavior covered by fixtures | Evidence chain head emitted | PASS |
| Receipt tamper detection | PROVE / CLI/MCP | Valid receipt passes | Tampered evidence hash fails loudly and non-zero | Reordering/model/stale claims covered by tests | PASS |
| Live quota | RUNWAY / CLI/MCP | Weekly 12%, reset time, pro plan, and source/confidence shown | Malformed/unavailable fixture renders UNKNOWN | No message counts invented | PASS |
| Verification reserve | RUNWAY / tests | Under/at/over math passes | Reserve breach warns without blocking | Real percentage source is preferred | PASS |
| Loop detection | RUNWAY / live + tests | Healthy fixture stays quiet | Repeated no-progress prompts emitted recommendation | Advisory only | PASS |
| Rate-limit recovery | RUNWAY / tests | Checkpoint and resume command generated | Unparseable reset remains UNKNOWN | Banked-reset hint only appears from recorded data | PASS |
| MCP tool discovery | MCP / stdio | Initialize and tools/list returned all six tools | Unknown method returned `-32601` | Five tools read-only; approval tool mutating | PASS |
| MCP mission list | MCP / stdio + Codex | Returned two governed missions | N/A - empty-project behavior covered by fixtures | No model prose used | PASS |
| MCP mission status | MCP / stdio | Returned proof table and blockers | Missing missionId returned `isError:true` | Current revision included | PASS |
| MCP receipt verify | MCP / stdio + Codex | Valid receipt returned true | Tamper behavior shared with CLI verifier | Offline | PASS |
| MCP runway status | MCP / stdio | Live app-server capacity returned | Unavailable path is typed | No invented fields | PASS |
| MCP approvals list | MCP / stdio | Two pending canonical records returned | Expired/resolved records excluded by store | Read-only annotation true | PASS |
| MCP approve/deny | MCP / stdio | Approval persisted `surface:mcp` | Invalid decision rejected | Consumed approval reuse returned REJECTED | PASS |
| MCP protocol errors | MCP / stdio | N/A - intentionally invalid | Malformed JSON `-32700`; unknown tool `isError:true` | Server stayed alive for later messages | PASS |
| Telegram auth | Telegram / live Bot API | Safe test authenticated configured bot | Invalid/missing configuration fixtures return UNAVAILABLE | Token and full chat ID never printed | PASS |
| Telegram pending cards | Telegram / live | Four distinct live pending cards sent | N/A - invalid records are not sent | Multiple requests remained independently addressable | PASS |
| Telegram approve | Telegram / live | User tap persisted one Telegram single-use approval | Duplicate decision fixture cannot re-grant | Card changed to Approved, then Consumed | PASS |
| Telegram deny | Telegram / live | User tap persisted Telegram denial | Later approval cannot override denial | Denied terminal card rendered | PASS |
| Telegram expiry | Telegram / live + fixture | Untouched live card changed to Expired | Expired mutation rejects | Post-expiry callback toast is fixture-verified because terminal UI intentionally removes decision buttons | PARTIAL |
| Telegram consumption | Telegram / live | Exact canonical grant consumed once and card changed to Consumed | Second consume is rejected by store tests | No real deploy was executed, so card truthfully reports run unavailable | PARTIAL |
| Telegram race | Telegram / live + fixture | CLI-first decision persisted `surface:cli` exactly once | Telegram cannot create a second grant | Watcher replaced buttons before a stale live tap; stale callback is fixture-verified | PARTIAL |
| Telegram unauthorized chat | Telegram / fixture | Allowlisted callback works | Non-allowlisted callback ignored and only hashed identity persists | A second real chat was unavailable | PARTIAL |
| Telegram resilience | Telegram / live + tests | Restart retained offset/dedupe state; notification count stayed 7 | Retry exhaustion is non-blocking in fixtures | Duplicate updates do not duplicate decisions | PASS |
| Telegram stage notifications | Telegram / live + tests | One real GUARD, five real VERIFY, and one real PROVE notification delivered; restart did not duplicate | Suppressed modes/thresholds stay quiet | RUN/remediation/RUNWAY renderers are fixture-verified; real Runway 12% correctly stayed below threshold | PARTIAL |
| Telegram privacy | Git/state scan | Zero tracked token/full-chat hits | N/A - intentional leak fixtures are redacted | State uses `sha256:` chat keys and masked approvers | PASS |
| Production dependency audit | pnpm audit | No known vulnerabilities | N/A - no finding remains | Runtime package unaffected by dev-tool patch | PASS |
| Full dependency scan | PatchPilot/OSV | No known vulnerable dependencies after fix | Initial reachable critical Vitest finding reproduced | Pin updated from 3.2.4 to 3.2.6 | PASS |
| Full repository gates | pnpm | Typecheck, 28 test files, 285 tests, and build passed | N/A - optional live identity smoke remains skipped by design | Demo baseline lockout proof intentionally fails closed and `demo:check` passes | PASS |

## Live model usage

| Model | Display effort | Wire effort | Input | Cached input | Output | Result |
|---|---:|---:|---:|---:|---:|---|
| gpt-5.6-luna | light | low | 16970 | 8960 | 5 | SUCCESS |
| gpt-5.6-terra | medium | medium | 18161 | 10496 | 5 | SUCCESS |
| gpt-5.6-sol | high | high | 18161 | 9984 | 5 | SUCCESS |
| gpt-5.6-luna | xhigh | xhigh | 16970 | 8960 | 5 | SUCCESS |
| gpt-5.6-luna | max | max | 16970 | 0 | 5 | SUCCESS |

The Light run was repeated after the run-record hardening change; that final record explicitly contains `effort:"light"`, `wireEffort:"low"`, a fresh session, exit 0, and raw usage.

## Real command summaries

```text
pnpm typecheck
packages/axiomgate-core typecheck: Done
apps/cli typecheck: Done
apps/web typecheck: Done

pnpm test
Test Files  28 passed (28)
Tests       285 passed | 1 skipped (286)

pnpm build
packages/axiomgate-core build: Done
apps/cli build: dist/index.js 813.2kb; Done

pnpm audit
No known vulnerabilities found

npx --yes patchpilot-cli@0.1.3 scan .
No known vulnerable dependencies found (scanner: osv-api)
```

The one skipped test is the opt-in live identity smoke (`AXIOM_LIVE_SMOKE=1`); identity behavior is covered by 18 non-skipped cases and separate live CLI probes.

## Fixes made from matrix findings

- `d21506b` - resolved dashboard approvals no longer remain in the pending UI.
- `6440948` - run records now expose the verified display-to-wire effort mapping.
- `e1f8962` - individual replay scenarios work in source and missing criteria no longer masquerades as a missing mission ID.
- `bc012e8` - Vitest is pinned to 3.2.6, closing GHSA-5xrq-8626-4rwp.

## Remaining publication and live-proof gaps

1. npm `axiomgate@0.1.0` predates the source replay, Telegram, dashboard, effort-record, and security-pin fixes. Publishing a new version requires explicit user authorization.
2. Public GitHub `main` predates the validated matrix source, so its README and product status are stale. Pushing remains a user-authorized account action.
3. The npm web UI returned HTTP 403 to this validation environment; registry metadata and actual `npx` installation were verified instead.
4. Telegram unauthorized-chat behavior, stale post-expiry/race callback toasts, and several stage types remain fixture-verified because only one live allowlisted account existed and the real 12% quota did not cross the notification threshold.
5. Consumption was live and exact-hash-bound, but no consequential command was executed merely to manufacture a run ID; the card honestly reports that the consuming run is unavailable.
6. The default local Codex marketplace entry is stale and fails plugin listing, while the clean public GitHub marketplace installation succeeds in an isolated Codex home.
