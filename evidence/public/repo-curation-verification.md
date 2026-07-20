# Repository curation verification

Date: 2026-07-20 IST

## Scope and authority

This record covers repository organization, link integrity, punctuation policy, README discoverability, Codex skill accuracy, platform verification, and the local 0.1.1 release preflight. It contains no credential, token, full private path, account secret, push, publish, or deployment action.

GitHub push and npm publish are explicitly outside this local proof until the user grants separate authority.

## C1: repository organization

History-preserving `git mv` operations created:

```text
docs/design       product and architecture blueprints
docs/engineering  decisions, quality, compatibility, and status
docs/submission   hackathon plan and rules compliance
docs/build-log    task board, phases, preflight, and templates
```

`AGENTS.md` remains at root for native agent discovery. CONTRIBUTING moved to `.github`. The stale standalone file index was removed and replaced with the README repository map. The publish dry run remained a three-file package:

```text
README.md
dist/index.js
package.json
```

Link gate after the README map was added:

```text
PASS markdown links: 79 relative targets across 81 tracked Markdown files
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
pnpm check:punctuation  PASS
pnpm check:skill        PASS
```

## C6: release preflight

Pending local 0.1.1 preparation at the time this section was created. It will be updated with the packed-tarball proof before any request for push or publish authority.
