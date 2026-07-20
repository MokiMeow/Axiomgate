# Hackathon Submission Plan

Read and complete [`26-OFFICIAL-RULES-COMPLIANCE.md`](26-OFFICIAL-RULES-COMPLIANCE.md). The Official Rules and current Devpost website override this plan when information conflicts.

## Category

Developer Tools.

## Submission message

> AxiomGate is a local-first governed runtime that helps developers give Codex complex missions without losing control of models, usage, project identity, authority, external actions, or proof of completion.

## Demo video

Use the stricter Official Rules requirement: a public YouTube video **less than three minutes**, with audio explaining the working project, Codex usage, and GPT-5.6 usage. Target 2:45-2:55.


### 0:00-0:20 - Problem (told with a real incident)

"This spring, an AI agent invented a repository ID and deployed a stranger's code to a customer's server. Coding agents are brilliant - they just carry no ID card and no proof." One developer, multiple accounts, unreliable "done" claims.

### 0:20-0:45 - Mission (Plan)

`axiomgate mission create`: one-line objective becomes a contract - 4 acceptance criteria, PUBLISH boundary, and the GPT-5.6 model plan (Luna scout, Sol high-effort build, Terra remediation) with recorded rationale.

### 0:45-1:10 - The block (Guard) - THE MOMENT

Codex attempts `preview.deploy`. Environment Guard blocks it live: the Vercel target belongs to the wrong team (staged second profile). The hook denial appears in the timeline as evidence. Re-target to the correct project, approve once on Telegram - approval bound to the exact command hash - deploy proceeds.

### 1:10-1:50 - Codex builds, PatchPilot verifies (Run → Verify)

Genuine implementation progress (no dead time; time-lapse). PatchPilot runs the repo's real test suite plus scanners; one genuine finding; Codex remediates it; rerun passes.

### 1:50-2:20 - Completion is earned, not claimed (Prove)

Criterion table fills from machine evidence only. One criterion deliberately shows UNKNOWN - completion is **blocked** until the user waives it with a visible reason. "The agent cannot say done. The evidence says done."

### 2:20-2:50 - Outcome

Correct PR, preview on the correct account, token actuals versus plan, and the Build Receipt - then `axiomgate receipt verify` proves the evidence chain in one command. Closing line: "Codex did the work. AxiomGate carries the proof."

Label every segment LIVE / REPLAY accurately. Show Codex visibly on screen and name Codex and GPT-5.6 in the narration (required by the rules; also criterion 1).

## Distribution and real-usage evidence (impact multiplier)

Impact is scored higher when it is demonstrated, not projected:

- Publish the `axiomgate` CLI to npm by **Jul 18 EOD**; `npx axiomgate` must run `doctor` + a replay demo with zero configuration.
- Share it in Build Week community sessions and relevant developer channels Jul 18-20.
- Target 5-10 real developers running one governed mission before the deadline.
- Collect install counts and user quotes - **only with permission, sanitized, no private data** - and cite them in the Devpost description and video outro.
- Never inflate: report exact numbers ("9 developers ran governed missions during Build Week"), not adjectives.

## Positioning language

Category name: **proof-carrying missions**. Contrast line for judges who know the native landscape: "Codex's guardian is a model judging a model. AxiomGate is deterministic policy plus external evidence - it doesn't ask the agent to be careful; it makes unsafe actions unexecutable and unproven work unclaimable."

## Required public documents

- README;
- setup instructions;
- supported platforms;
- architecture;
- testing;
- security;
- hackathon delta;
- Codex collaboration;
- sample Build Receipt;
- demo/replay instructions;
- relevant public-repository license, or verified private-repository judge access;
- `HACKATHON_DELTA.md`;
- `CODEX_COLLABORATION.md`;
- official-rules compliance checklist.

## Pre-existing work

Create `HACKATHON_DELTA.md` in the actual repository. Include:

- exact pre-event baseline commit;
- existing PatchPilot capabilities;
- Build Week commit range;
- new modules;
- new tests;
- primary Codex session;
- before/after evidence.

## Judge testing

Provide:

- one-command deterministic replay;
- optional live sandbox;
- no personal credential requirement for core evaluation;
- clear replay/live labels;
- expected outputs;
- supported Windows environment;
- free access maintained through at least August 12, 2026;
- public repo license or private repo shared with `testing@devpost.com` and `build-week-event@openai.com`.

### Fresh-machine publication checks

Verify the published public CLI from a directory outside the clone:

```powershell
node scripts/verify-published.mjs
```

The script reads `npm view axiomgate version` from `registry.npmjs.org` and runs `npx -y axiomgate@latest doctor` in a new temporary directory. It prints an independent PASS/FAIL for each check.

Verify the public Codex plugin with an isolated home so the result cannot inherit a developer installation:

```powershell
$env:CODEX_HOME = Join-Path $env:TEMP "axiomgate-codex-home"
codex plugin marketplace add https://github.com/mokimeow/axiomgate --json
codex plugin add axiomgate@axiomgate-build-week --json
codex plugin list --json
npx -y axiomgate@latest doctor
```

The marketplace-add result must name `axiomgate-build-week`; plugin list must report `axiomgate` installed and enabled. Doctor must report the skill via the plugin. Inspect the installed plugin record to confirm the read-only verifier agent and the `npx -y axiomgate@latest mcp` stdio server are present.

## Truth

Do not claim provider support, usage accuracy, security guarantees, or live integrations beyond what judges can verify.
