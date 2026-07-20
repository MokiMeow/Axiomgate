# AxiomGate

[![npm](https://img.shields.io/npm/v/axiomgate?label=npm)](https://www.npmjs.com/package/axiomgate)
[![MIT](https://img.shields.io/badge/license-MIT-34d399)](LICENSE)
[![Codex](https://img.shields.io/badge/built%20with-Codex-f4511e)](CODEX_COLLABORATION.md)

## Proof-carrying missions for Codex

AxiomGate lets Codex act only within explicit authority enforced at the Codex hook, then lets it claim completion only when fresh machine evidence satisfies the mission contract. Each governed mission ends in a tamper-evident Build Receipt that anyone can verify offline.

> Codex does the work. AxiomGate carries the proof.

## Why this exists

Coding agents can be confident and wrong. Across 2,208 prompt variants, [UnderSpecBench](https://arxiv.org/abs/2607.02294) reported action-boundary violation rates of 55.8-67.8%, including deterministic Wrong Target and OverScope oracles. In a separate deployment incident, an agent fabricated a repository identifier and deployed the wrong code because it never verified target ownership ([secondary incident report](https://awesomeagents.ai/news/openclaw-opus-hallucinated-repo-id-vercel-deploy/)). OpenAI Codex issue [#16798](https://github.com/openai/codex/issues/16798) is the primary record for the broader failure mode: an agent can ignore repository governance unless enforcement sits outside model narration.

AxiomGate makes both failures testable: unsafe actions are denied at the hook boundary, and unsupported completion claims remain blocked at the evidence gate.

## 90-second quickstart

Release 0.1.3 quickstart (publication pending user confirmation):

```powershell
npx -y axiomgate@0.1.3 doctor
npx -y axiomgate@0.1.3 replay all
```

`replay all` needs no Codex login or cloud credentials. It executes three deterministic regressions through production logic: wrong-target ownership denial, exact-command approval binding, and missing-evidence completion blocking.

From a clean clone, the same path is also available from source:

```powershell
git clone https://github.com/mokimeow/axiomgate.git
Set-Location axiomgate
corepack enable
pnpm install --frozen-lockfile
pnpm build
node apps/cli/dist/index.js replay all
node apps/cli/dist/index.js receipt verify scripts/fixtures/publish-receipt.json
node scripts/tamper-receipt.mjs scripts/fixtures/publish-receipt.json .local/tampered-receipt.json
node apps/cli/dist/index.js receipt verify .local/tampered-receipt.json
```

The final command must print `FAIL` and exit non-zero. See [JUDGE-QUICKSTART.md](JUDGE-QUICKSTART.md) for expected output and the optional authenticated mission lifecycle.

## Enforced authority versus proven outcomes

| Guardrail | What AxiomGate does |
|---|---|
| Identity and target | Resolves GitHub/Vercel identity and proves that a publish/deploy target exists and is owned before use. |
| Intent boundary | Maps `OBSERVE` through `DEPLOY_PRODUCTION` to sandbox/network authority; production deploy is refused in this Build Week release. |
| Semantic policy | Classifies commands and MCP tools into actions, then applies deterministic `ALLOW`, `DENY`, or `REQUIRE_APPROVAL` policy. Unknown state-changing actions fail closed. |
| Governed state | Rejects model-visible writes into `.axiomgate` before policy evaluation, including `apply_patch`, shell, traversal, and structured MCP paths. Moving authority outside the writable workspace remains the stronger long-term design. |
| Approval binding | Binds a single-use, expiring approval to the exact command hash. Mutation or reuse is denied. |
| Telegram approvals and stage notifications | Long-polls Telegram for actor-authorized, exact-command approvals plus readable Guard, Run, Verify, Remediate, Prove, and Runway updates. Private chat is the safe default; group use requires an explicit user-ID allowlist. No webhook or public URL is required. [Live actor-auth evidence](evidence/public/telegram-actor-auth-verification.md). |
| Completion gate | Accepts only fresh `command`, `api`, or `hook` evidence. Model prose is advisory and cannot make a criterion pass. |
| Build Receipt | Hash-chains stored evidence and supports offline integrity, freshness, contract-hash, and no-false-green verification. |

## How Codex and GPT-5.6 are used

AxiomGate is built around native Codex surfaces rather than prompt-only conventions:

- `PreToolUse` machine-JSON denial is the live-proven `codex exec` enforcement path on Codex 0.144.6. `PermissionRequest` uses the same fixture-tested policy entry, but it did not fire in the recorded non-interactive on-request probe under effective `Never`, so AxiomGate does not claim live PermissionRequest enforcement there.
- `codex exec --json` provides governed Builder and fresh, read-only Verifier sessions, event streams, command executions, and token actuals.
- the Codex App Server method `account/rateLimits/read` supplies real usage-window percentage, reset time, plan type, and banked reset metadata; failures render `UNKNOWN` rather than invented capacity;
- a repository Codex [skill](.agents/skills/axiomgate/SKILL.md), a read-only [custom verifier agent](.agents/agents/axiomgate-verifier.toml), an [MCP server](apps/cli/src/mcp.ts), and a [plugin marketplace manifest](.agents/plugins/marketplace.json) make governance discoverable through native integration points.

The Model Director records a rationale per phase. GPT-5.6 Luna/Light scouts structured context, Sol/High builds, Sol/Max is recommended for high- or critical-risk security work, Terra/Medium performs bounded remediation, and Terra/High independently challenges the diff. “Ultra” is documented honestly as native multi-agent capability, not a reasoning level and not orchestrated by AxiomGate in this release.

The real headline mission used **7 governed sessions** and **3,159,955 input-plus-output tokens**, captured from its ledger: Luna/Light for the block proof, Sol/High for the security implementation, and Terra/Medium or Terra/High for remediation and independent review. The sanitized session ledger is documented in [CODEX_COLLABORATION.md](CODEX_COLLABORATION.md).

## Architecture

```text
objective
   │
   ▼
 PLAN ── contract + model plan + runway
   │
 GUARD ─ identity + target proof + hook policy + approvals
   │
  RUN  ─ governed Codex Builder + independent Verifier
   │
 VERIFY ─ native tests/build + PatchPilot scan + secret scan + remediation
   │
 PROVE ─ criterion verdicts + permission quads + offline Build Receipt
```

| Stage | Main implementation | Design reference |
|---|---|---|
| Plan | `packages/axiomgate-core/src/mission`, `packages/axiomgate-core/src/runway` | [Mission Compiler](docs/design/03-MISSION-COMPILER.md), [Runway](docs/design/04-RUNWAY.md) |
| Guard | `packages/axiomgate-core/src/guard` | [Environment Guard](docs/design/05-ENVIRONMENT-GUARD.md) |
| Run | `packages/axiomgate-core/src/runtime` | [Codex Runtime](docs/design/06-CODEX-RUNTIME.md) |
| Verify | `packages/axiomgate-core/src/verification` | [Verification Engine](docs/design/07-VERIFICATION-ENGINE.md) |
| Prove | `packages/axiomgate-core/src/evidence` | [Evidence Gate](docs/design/08-EVIDENCE-GATE.md) |

The verification boundary invokes the published `patchpilot-cli@0.1.3` unchanged, then combines its dependency findings with the target repository’s native test/build commands and secret scan. PatchPilot source is not copied or represented as Build Week work.

## Repository map

This table is the one-hop entry point for reviewers, AI analysis, and contributors.

| Path | Purpose |
|---|---|
| [README.md](README.md) | Product thesis, quickest runnable proof, architecture, support matrix, and repository index. |
| [JUDGE-QUICKSTART.md](JUDGE-QUICKSTART.md) | Credential-free 90-second judge flow with expected outputs. |
| [HACKATHON_DELTA.md](HACKATHON_DELTA.md) | Exact pre-event baseline and Build Week contribution boundary. |
| [CODEX_COLLABORATION.md](CODEX_COLLABORATION.md) | Model roles, governed session record, and Codex integration evidence. |
| [AGENTS.md](AGENTS.md) | Native repository instructions for coding agents. |
| [SECURITY.md](SECURITY.md) | Supported security policy and private reporting guidance. |
| [docs/design](docs/design/) | Product vision, architecture, domain schemas, layer blueprints, naming, and build contract. |
| [docs/engineering](docs/engineering/) | Decisions, compatibility findings, quality rules, implementation status, and Definition of Done. |
| [docs/submission](docs/submission/) | Hackathon submission plan and official-rules compliance. |
| [docs/build-log](docs/build-log/) | Authoritative task board, phase history, and agent preflight. |
| [evidence/public](evidence/public/) | Sanitized, judge-facing proof for live and deterministic claims. |
| [demo](demo/) | Synthetic target application, mission criteria, scripts, and the demonstration runbook. |
| [.agents](.agents/) | Repository Codex skill, read-only verifier agent, and marketplace metadata. |
| [apps](apps/) | Bundled CLI/MCP package and local dashboard. |
| [packages](packages/) | Typed AxiomGate core containing all six product layers. |
| [plugins](plugins/) | Versioned Codex plugin bundle containing the synchronized native artifacts. |
| [scripts](scripts/) | Link/punctuation gates, replay fixtures, receipt tampering, and package verification. |

## Product surfaces

The local dashboard renders a seeded synthetic mission on a clean clone and real `.axiomgate` state when pointed at a governed workspace. Public screenshots are path-redacted captures of the bundled sample data.

![AxiomGate landing page: proof-carrying missions for Codex](docs/assets/axiomgate-landing.png)

![AxiomGate dashboard: wrong-target denial and evidence-gated completion](docs/assets/axiomgate-dashboard.png)

## Judge path and platform support

Start with [JUDGE-QUICKSTART.md](JUDGE-QUICKSTART.md). The deterministic replay and sample receipt require no personal account, credential, paid service, or network after dependencies are installed. The public repository and npm package are intended to remain free through judging.

| Platform | Status | Evidence or limitation |
|---|---|---|
| Windows 11, PowerShell, Node.js 20+, pnpm 10, Codex CLI 0.144.x | Verified | Full tests, build, replay, package install, live mission, hooks, Telegram, and receipt verification. |
| Linux through WSL2 Ubuntu | Unverified | The registered WSL distribution could not attach its missing VHDX on this machine, so no Linux command was run. [Curation evidence](evidence/public/repo-curation-verification.md). |
| macOS | Untested | No macOS runner was available. |

The optional live path requires the judge's own Codex authentication. GitHub and Vercel checks require the judge's own corresponding CLI login.

## Security and privacy

- The dashboard binds to loopback, serves only its packaged public directory, validates same-origin approval writes, bounds request bodies, and confines mission paths.
- External commands use the shared timeout runner. Hook stdout stays machine-JSON only; internal failures deny rather than silently fail open.
- Persisted command, verifier, verification, and deploy-target diagnostics pass through centralized credential redaction before hashing or storage.
- `.local/`, `.axiomgate/`, `.vercel/`, dependency trees, build output, environment files, tarballs, and raw run logs are excluded from Git.
- Optional Telegram approvals read `TELEGRAM_BOT_TOKEN`, the comma-separated `TELEGRAM_CHAT_ID` chat allowlist, and optional comma-separated `TELEGRAM_USER_ID` actor allowlist only from the process environment or ignored `.local/telegram.env`. Without `TELEGRAM_USER_ID`, callbacks are accepted only from an allowlisted private chat. Group or supergroup use requires an explicit matching user-ID allowlist as well as an allowlisted chat. `axiomgate telegram test` and doctor show masked authorization mode, never the token or full identifiers. Stage notifications send the mission objective, workspace label, action, target, and a best-effort redacted command to Telegram, so project metadata leaves the local machine. Persisted relay state contains hashed chat identifiers and masked actor IDs.
- Demo users, IDs, tokens, and wrong-target profiles are synthetic. Presenter substitutions are explicitly labelled in [demo/DEMO-RUNBOOK.md](demo/DEMO-RUNBOOK.md).

See the [threat model](docs/design/10-SECURITY-THREAT-MODEL.md), [negative guard suite](packages/axiomgate-core/test/negative-guard.test.ts), and [public evidence index](evidence/public/README.md).

## Submission evidence

- [Hackathon delta](HACKATHON_DELTA.md) - exact pre-event baseline and Build Week scope.
- [Codex collaboration log](CODEX_COLLABORATION.md) - model roles, seven-session headline ledger, and verified hook probes.
- [Headline run evidence](evidence/public/headline-run-verification.md) - real lockout mission, denial, remediation, review, and receipt proof.
- [Sample offline-verifiable receipt](scripts/fixtures/publish-receipt.json).
- [Implementation status](docs/engineering/21-IMPLEMENTATION-STATUS.md) - evidence-linked product truth.

## Roadmap

- adopt deterministic named custom-agent targeting when Codex exposes it non-interactively;
- broaden replay coverage beyond the three Build Week security regressions;
- normalize additional quota providers without inventing capacity data;
- verify Linux in a working clean environment and add macOS verification.

## License

[MIT](LICENSE) © 2026 [mokimeow](https://github.com/mokimeow).
