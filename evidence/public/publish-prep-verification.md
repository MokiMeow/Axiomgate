# Publication preparation verification

Captured 2026-07-19 on Windows with Node 24.11.1, npm 11.6.2, pnpm 10.33.0, and Codex CLI 0.144.6. All package checks used a locally generated tarball installed into a fresh temporary project. Temporary absolute paths are represented as `<temp>`; no credential, token, private target ID, tarball, or `node_modules` content is committed.

No `npm publish`, Git remote creation, or `git push` was run. Public registry and Git-URL checks remain user actions after publication.

## Publishable package

`apps/cli` is the unscoped public package `axiomgate@0.1.0`. Esbuild 0.28.1 (MIT) is pinned as a development-only bundler. The single Node 20 ESM output includes `@axiomgate/core` and Zod; the packed manifest has no runtime dependencies and contains no `workspace:*` runtime reference.

Observed `npm pack --json` projection:

```text
name:          axiomgate
version:       0.1.0
tarball size:  132309 bytes
unpacked:      786766 bytes
shasum:        894cfd6aa077c39d7dd7fbfb6a25814eff498138
integrity:     sha512-YL+/J7/zpT6tLSZK4YsUE2lwW3PIGtgNYMiYDoO1HyhArG2sbTTM8LiLyom552czjnobuz/777IvWWxfwLJS0Q==

README.md       848 bytes
dist/index.js   785016 bytes
package.json    902 bytes
entryCount:     3
```

The bundle begins with `#!/usr/bin/env node`. Package metadata sets MIT, Node `>=20`, registry `https://registry.npmjs.org/`, public access, requested keywords, and explicit GitHub placeholders. The user must replace `OWNER` with the final public GitHub owner before publishing.

## Fresh tarball install

`pnpm publish:check` performed the following from a new temporary directory:

```text
npm pack apps/cli
npm install --ignore-scripts --no-audit --no-fund --no-package-lock <tarball>
added 1 package
```

The harness asserted the installed manifest had no `dependencies`, then invoked the actual installed Windows shim at `node_modules/.bin/axiomgate.cmd`.

Installed help completed with exit 0 and exposed the required surfaces:

```text
Agent protocol: axiomgate mcp
Usage: axiomgate doctor | ... | axiomgate mission create ... |
       axiomgate mission run ... | axiomgate mission verify ... |
       axiomgate mission receipt ... | axiomgate receipt verify <file> | ...
```

Installed doctor completed with exit 0 in an isolated, empty `CODEX_HOME`:

```text
AXIOMGATE / doctor · environment & trust
Node             [OK] v24.11.1
Model Director   Light · Medium · High · Xhigh · Max
Codex CLI        [OK] codex-cli 0.144.6
Git repository   [X] ABSENT
Codex capacity   [!] UNAVAILABLE (no valid response in the isolated home)
AxiomGate skill  [X] ABSENT (<temp>/codex-home/...)
Verifier agent   [X] ABSENT (<temp>/codex-home/...)
```

The unavailable lines are expected zero-config environment observations, not package failures.

## Offline receipt and tamper proof

The installed shim verified a copied sanitized receipt fixture:

```text
exit=0
PASS · RECEIPT INTEGRITY
contract hash
1 chained evidence records
criterion evidence citations
criterion verdicts and completion gate
```

The harness changed one evidence record's `outputHash` in a copied receipt and reran the same installed command:

```text
exit=1
FAIL · RECEIPT INTEGRITY
Evidence chain hash mismatch at record 1 (ev_publish_fixture)
```

The original fixture was unchanged.

## Installed MCP stdio proof

The installed shim received four newline-delimited JSON-RPC messages over stdio: `initialize`, `notifications/initialized`, `tools/list`, and one `tools/call` for `axiomgate_receipt_verify`.

Observed results:

```text
serverInfo:  { name: "axiomgate", version: "0.1.0" }
tools/list:  6 tools
tool call:   { valid: true,
               checks: [contract hash,
                        1 chained evidence records,
                        criterion evidence citations,
                        criterion verdicts and completion gate],
               errors: [] }
process exit: 0
```

## Public-repository plugin preparation

A repository-root `.agents/plugins/marketplace.json` points to the canonical `./plugins/axiomgate` package. The plugin-creator cachebuster helper updated the manifest and its validator passed. A real local add/install was run with an isolated `CODEX_HOME`:

```text
codex plugin marketplace add . --json
marketplaceName: axiomgate-build-week
alreadyAdded: false

codex plugin add axiomgate@axiomgate-build-week --json
pluginId: axiomgate@axiomgate-build-week
version: 0.1.0+codex.20260719170534

codex plugin list --json
installed: true
enabled: true
```

The installed snapshot contained:

- the AxiomGate governance skill;
- `axiomgate-verifier.toml` with `sandbox_mode = "read-only"`, Terra, and high effort;
- MCP registration `npx -y axiomgate@latest mcp`.

Doctor against that isolated plugin home reported:

```text
AxiomGate skill  [OK] via plugin axiomgate@axiomgate-build-week
Verifier agent   [OK] via plugin axiomgate@axiomgate-build-week
```

The Git URL path cannot be exercised until the user pushes the repository. `docs/14-HACKATHON-SUBMISSION.md` records the exact fresh-home commands for that post-push check.

## Post-publication verifier

`node scripts/verify-published.mjs --dry-run` completed without a registry request and printed its two future checks:

```text
CHECK 1: npm view axiomgate version --registry=https://registry.npmjs.org/ --json
CHECK 2: npx -y axiomgate@latest doctor
```

The live form intentionally remains unrun until the user publishes.

## Final repository gates

```text
pnpm typecheck
apps/web: Done
packages/axiomgate-core: Done
apps/cli: Done
exit=0

pnpm test
Test Files  24 passed (24)
Tests       239 passed | 1 skipped (240)
Duration    2.05s
exit=0

pnpm build
packages/axiomgate-core: Done
apps/cli: dist/index.js 766.6kb; Done
exit=0

pnpm audit --prod
No known vulnerabilities found
```

`git diff --check` passed. The publication-scope secret-pattern scan returned no matches, the built bundle contained no private path, email, `workspace:*`, or external `@axiomgate/core` reference, and no `.tgz` exists in the repository tree.

## Limitations

- The package and plugin repository fields use `OWNER` / `<GIT_URL>` placeholders because no Git remote or final public URL exists in this workspace.
- Registry visibility and public Git marketplace cloning are `PENDING` user actions.
- The optional packaged dashboard was not included; the required CLI, offline receipt verifier, and MCP server are the publication scope.
