# Repository curation verification

Date: 2026-07-20 IST

## Scope and authority

This record covers repository organization, exhaustive Markdown inventory, link integrity, punctuation policy, README discoverability, Codex skill accuracy, platform verification, the local 0.1.1 release preflight, and the separately authorized GitHub synchronization. It contains no credential, token, full private path, account secret, npm publish, or deployment action.

The user explicitly authorized GitHub push and npm publication. GitHub synchronization succeeded. npm publication did not run because the existing registry session failed `npm whoami` with HTTP 401; no credential search, token reuse, or bypass was attempted.

## C1: repository organization

History-preserving `git mv` operations created:

```text
docs/design       product and architecture blueprints
docs/engineering  decisions, quality, compatibility, and status
docs/submission   hackathon plan and rules compliance
docs/build-log    task board, historical phase plans, and agent preflight
```

`AGENTS.md` remains at root for native agent discovery. CONTRIBUTING moved to `.github`. The stale standalone file index was removed and replaced with the README repository map. The publish dry run remained a three-file package:

Four unreferenced build-log templates were removed. Their only content was blank headings, and no source, script, document, or workflow referenced them. The active `.github/pull_request_template.md` remains. Tracked `.local/README.md` and `.local/.gitkeep` were also removed so `.local/` is uniformly private and ignored.

```text
README.md
dist/index.js
package.json
```

Link gate after the README map was added:

```text
PASS markdown links: 111 relative targets across 77 tracked Markdown files
```

## C2: punctuation gate

The initial inventory found 248 em dashes and 47 en dashes in tracked files. All were rewritten. The committed deterministic checker and direct Git grep now report:

```text
PASS punctuation: 0 em dashes and 0 en dashes across 256 tracked text files
git grep U+2014/U+2013: zero hits
```

Incoming Telegram text still normalizes those characters through escaped Unicode code points; no literal forbidden character remains in source.

## C3: README entry point

README has exactly one H1 and links in one hop to the judge quickstart, hackathon delta, Codex collaboration log, native agent instructions, security policy, all four documentation groups, public evidence, demo, native artifacts, apps, packages, plugin, and scripts. Telegram approval and stage notifications are listed as shipped behavior with live evidence. The roadmap contains only future work.

## C4: Codex skill

The repository and plugin skill copies are identical. The skill now includes trigger guidance, the real governed workflow, and hard enforcement rules. Validation output:

```text
PASS skill commands: 10 documented workflows exist in shipped CLI help
Skill is valid!
Skill is valid!
Test Files  1 passed (1)
Tests       6 passed (6)
```

The workflow covers mission create, run, verify, status, receipt generation, offline receipt verification, replay, Telegram watch, enforcement verification, and Runway status. It tells agents never to retry hook-denied commands and never to treat model output as evidence.

## C5: platform matrix

Windows 11 remains verified. WSL discovery returned a registered Ubuntu WSL2 distribution, but starting it failed before a shell was available:

```text
Default distribution: Ubuntu
Default version: 2
Ubuntu state: Stopped
Failure: Wsl/Service/CreateInstance/MountDisk/HCS/ERROR_PATH_NOT_FOUND
Cause reported by WSL: configured ext4.vhdx path does not exist
```

No Linux `node`, pnpm, replay, or receipt command ran. WSL was not repaired or reinstalled because that would be environment administration outside the verification time box. The honest support matrix is:

| Platform | Status |
|---|---|
| Windows 11 | Verified |
| Linux through WSL2 Ubuntu | Unverified, environment unavailable |
| macOS | Untested |

## Current local gates

```text
pnpm typecheck  PASS
pnpm test       28 files passed; 286 passed; 1 optional live identity test skipped
pnpm build      PASS; bundled CLI dist/index.js 819.3kb
pnpm check:links        PASS
pnpm check:markdown     PASS
pnpm check:punctuation  PASS
pnpm check:skill        PASS
```

The Markdown-quality gate checks every tracked Markdown file for substantive content, a consistent top-level heading, replacement/mojibake text, tracked private `.local` content, and abandoned template paths. The final audit includes 77 substantive Markdown files, 111 checked relative targets, and zero forbidden dash characters across 252 tracked text files.

## C6: exhaustive documentation truth audit

Every tracked Markdown file was included in the inventory and automated gates. Active documents were also searched against the shipped CLI help, current Zod schemas, runtime hook configuration, verification planner/executors, dashboard server, package version, and ADR-014 boundary.

Corrections made from that audit:

- current agent preflight now inspects the implemented repository instead of calling it documentation-only;
- canonical mission and receipt sketches include current effort labels, verify phase, reserve policy, MCP approval surface, contract projection, evidence hashes, and chained records;
- runtime documents describe `codex exec --json` for sessions and App Server only for quota, with no shipped SDK dependency;
- hook documents describe only the configured `PreToolUse` and `PermissionRequest` events;
- PatchPilot documents describe the pinned published CLI boundary and do not claim source, worker, database, Next.js, redaction, approval, or receipt-module reuse;
- dashboard documents describe the shipped zero-dependency loopback server and Telegram as the remote phone channel;
- CLI documentation lists the shipped command families and no longer marks Runway as deferred;
- historical phase plans are labelled as historical and point to the current task/status authorities;
- shorthand moved paths such as `docs/02` and `docs/17` were replaced with checked relative links;
- dated public evidence remains unchanged where it truthfully records older versions, failures, or pending live proofs.

## C7: release preflight

Status: **LOCAL PACKAGE PASS; GITHUB PASS; NPM 0.1.1 BLOCKED BY REGISTRY AUTHENTICATION**.

The publishable CLI, bundled MCP version, package README, active quickstarts, plugin manifest, tests, changelog, and package verifier now identify 0.1.1. Historical 0.1.0 evidence remains unchanged because it describes the real prior release.

`npm pack --dry-run --json`:

```text
name: axiomgate
version: 0.1.1
entryCount: 3
files:
  README.md
  dist/index.js
  package.json
runtime dependencies: none
```

The tarball was installed into a new temporary project and invoked only through its installed command shim:

```text
installed axiomgate --help                 exit 0
installed axiomgate doctor                 exit 0
installed replay wrong-target              exit 0, EXISTS_NOT_OWNED, PASS
installed receipt verify intact            exit 0, PASS
installed receipt verify tampered          exit 1, FAIL
installed MCP initialize/tools/call        exit 0, server version 0.1.1
```

Final line:

```text
PASS packed distribution: clean tarball, installed shim, individual replay, receipt tamper detection, and MCP stdio.
```

The initial prepared source was pushed and independently matched before the exhaustive Markdown audit:

```text
local HEAD:       7d478863112cbfe89c9644e6b47c8c41090b9453
origin/main:      7d478863112cbfe89c9644e6b47c8c41090b9453
GitHub API main:  7d478863112cbfe89c9644e6b47c8c41090b9453
```

The final documentation-audit commit is synchronized and rechecked against the remote as the last repository step; its resulting head is recorded in the ignored full report rather than self-referenced inside its own commit.

The post-publication script still requires exact registry version 0.1.1, a fresh pinned `npx` doctor, an individual evidence-gate replay, receipt PASS/tamper-FAIL, GitHub `main` matching local release HEAD, and a rendered current quickstart. It will run only after standard npm authentication and successful publication.
