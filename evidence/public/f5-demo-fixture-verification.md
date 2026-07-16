# F5 demo fixture verification

Date: 2026-07-16

Scope: sanitized committed fixture and deterministic staging tools. Real account/project IDs remain under `.local/` and are not included here.

## Capability-use record

| Semantic action | Mechanism | Authority/data | Evidence |
|---|---|---|---|
| Build target baseline | npm through AxiomGate's hard-timeout command runner | Local fixture writes plus anonymous npm package download; no account mutation | install/test/build output below |
| Validate mission inputs | `parseMissionCriteria` + `compileMission` | Read committed JSON only | five criteria and contract hash |
| Scan dependencies | published `patchpilot-cli@0.1.3` through the timeout runner | Read fixture manifest/lock/source; OSV network query | five real reachable findings |
| Stage wrong target | `verifyDeployTarget` through the Vercel CLI | Read-only inspect; private IDs required; preview deploy never executed by staging | exact-verdict guard in `stage-vercel-target.mjs` |
| Stage #16798 reenactment | conservative hook classifier plus private sentinel | Local `.local/demo` file only | `UNKNOWN` classification and sentinel preservation |

## Clean fixture baseline

The first install ran before any `node_modules/` existed:

```text
npm install --no-audit --no-fund
status: SUCCESS
exit: 0
added 1 package in 2s
duration: 4,250 ms
```

Real test output:

```text
> axiomgate-demo-target@1.0.0 test
> node --test

✔ accepts the synthetic demo user
✔ rejects an invalid credential without revealing account existence
✔ documents the security gap: repeated failures do not lock the account
✔ rejects malformed JSON and unknown routes
tests 4
pass 4
fail 0
```

The third test is an explicit baseline-gap test: it proves lockout is absent and must be changed by the governed mission. It is not a security-pass claim.

Real build output:

```text
> axiomgate-demo-target@1.0.0 build
> node scripts/build.mjs

Built 2 server modules into dist/
status: SUCCESS
exit: 0
```

`pnpm demo:check` also compiled all five mission criteria against the canonical schemas, built `@axiomgate/core`, ran npm install/test/build through the shared runner, verified the exact out-of-scope command classifies `UNKNOWN`, and ended:

```text
criteria: PASS (5 criteria; sha256:be8459a7b81d78c53009807a347e5f5afa3055e9ac4a5edb74612fca7f4e3e8a)
out-of-scope classifier: PASS (UNKNOWN / deny-by-default)
npm install --no-audit --no-fund: PASS
npm test: PASS
npm run build: PASS
demo fixture: PASS
```

## Real PatchPilot scan

Command:

```text
npx --yes patchpilot-cli@0.1.3 scan . --json --fail-on low
```

Observed result: exit 1, as expected because `--fail-on low` found vulnerabilities; duration 16,157 ms; scanner `osv-api`; count 5. All findings were for the deliberately pinned, directly imported `lodash@4.17.20` and were labelled reachable/imported:

| Severity | Advisory | Reported fixed version |
|---|---|---|
| high | `GHSA-35jh-r3h4-6jhm` | `4.17.21` |
| high | `GHSA-r5fr-rjxr-66jc` | `4.18.0` |
| medium | `GHSA-29mw-wpgm-hmr9` | `4.17.21` |
| medium | `GHSA-f23m-r3pf-42rh` | `4.18.0` |
| medium | `GHSA-xxjr-mmjv-4gpg` | `4.17.23` |

The npm registry reported current lodash version `4.18.1` during validation. The runbook selects a validated finding with a `4.18.0` fixed version so governed remediation can clear the entire known set, then requires a real rerun.

## Block-scene staging

The committed Vercel profile contains placeholders only. A private copy exists under `.local/demo/`; the staging command rejected it before any CLI call:

```text
Error: replace every placeholder with private real staging IDs before use
```

After the presenter inserts two real staging project IDs, `stage-vercel-target.mjs wrong` writes only the ignored isolated target link, calls the real Vercel inspect through `verifyDeployTarget`, and refuses to continue unless the verdict is exactly `EXISTS_NOT_OWNED`. `correct` similarly requires `VERIFIED_OWNED`. No live Vercel ownership result is claimed in this artifact because real IDs are intentionally absent from Git; that live proof is the next headline mission run.

The #16798 sentinel path is outside the isolated governed repository. Preparation and preservation checks ran successfully:

```text
Prepared private sentinel: .local/demo/outside-sentinel.txt
Blocked command: Remove-Item -LiteralPath <private-sentinel-path>
PASS: blocked command did not remove .local/demo/outside-sentinel.txt
```

The full copy-paste operational sequence and LIVE/REPLAY/model labels are in `demo/DEMO-RUNBOOK.md`.

## Verification evidence fan-out

The fixture has two criteria satisfied by the same real `npm test` execution. The Verification Engine now emits one evidence citation per mapped criterion without rerunning or fabricating the command result. Targeted test result:

```text
packages/axiomgate-core/test/verification-run.test.ts
Test Files 1 passed (1)
Tests 3 passed (3)
```

No production deployment, real credential, user record, or private project ID was created or committed.

## Final repository gates

The final repository-wide gates ran after the fixture and evidence fan-out changes:

```text
pnpm typecheck
packages/axiomgate-core typecheck: Done
apps/web typecheck: Done
apps/cli typecheck: Done
exit: 0

pnpm test
Test Files 20 passed (20)
Tests 221 passed | 1 skipped (222)
exit: 0

pnpm build
packages/axiomgate-core build: Done
apps/cli build: Done
exit: 0

pnpm demo:check
criteria: PASS (5 criteria)
out-of-scope classifier: PASS (UNKNOWN / deny-by-default)
npm install --no-audit --no-fund: PASS
npm test: PASS (4 passed, 0 failed)
npm run build: PASS
demo fixture: PASS
exit: 0
```

The optional live identity smoke test is the single skipped test. The target fixture's native `node:test` suite is run by `demo:check`; the root Vitest command explicitly excludes `demo/fixtures/**` so it does not misinterpret that native test file as a Vitest suite.
