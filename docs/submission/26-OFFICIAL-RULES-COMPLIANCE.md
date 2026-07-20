# Official Rules Compliance

## Purpose

This document is the submission-compliance source inside the repository. It supplements the product and engineering documents; it does not replace the official OpenAI Build Week rules or Devpost website.

When any local document, plugin output, FAQ, overview page, schedule page, or assistant statement conflicts with the Official Rules, follow the Official Rules and verify the current Devpost website before submission.

## Authoritative sources

Review immediately before submission:

- OpenAI Build Week Official Rules on Devpost;
- OpenAI Build Week overview and Resources pages;
- OpenAI Build Week FAQ and latest Updates;
- the authenticated Devpost submission form;
- the OpenAI Build Week page for current sessions and announcements.

The optional Devpost Hackathons plugin is a helper, not the official source of truth.

## Critical dates

- Submission deadline: **July 21, 2026 at 5:00 PM Pacific Time**.
- India equivalent: **July 22, 2026 at 5:30 AM IST**.
- Internal submission target: at least **one hour before the official deadline**.
- Free Codex credit request deadline: **July 17, 2026 at 12:00 PM Pacific Time**.
- India equivalent: **July 18, 2026 at 12:30 AM IST**.
- Granted hackathon Codex credits must be used by **July 21, 2026 at 5:00 PM Pacific Time**, matching the current Official Rules deadline.
- Winners are expected on or around **August 12, 2026**.

Public pages currently show inconsistent judging-end dates. Keep the project, test path, credentials, sandbox, and public video available through at least **August 12, 2026**, unless Devpost announces a later date.

## Eligibility

Before submission confirm:

- every entrant is at least the applicable age of majority;
- every entrant is resident in an eligible supported country or territory;
- all team members individually meet eligibility requirements;
- one representative is authorized when submitting as a team or organization;
- the entrant has no disqualifying conflict of interest.

India is not listed among the excluded jurisdictions in the rules, but eligibility must still be checked against the current supported-country list.

## Project requirements

The submitted project must:

- be built meaningfully with **Codex and GPT-5.6**;
- fit one and only one track, with **Developer Tools** selected for AxiomGate;
- be working, installable, and consistently runnable on its stated platform;
- behave as shown in the video and described in the submission;
- identify all supported platforms accurately;
- use third-party SDKs, APIs, data, and open-source components only with proper authorization and license compliance;
- contain no malicious code, disabling devices, spyware, or harmful payloads.

## Pre-existing work and Hackathon Delta

PatchPilot and any other pre-existing code must be clearly separated from Build Week work.

The repository must include `HACKATHON_DELTA.md` containing:

- the exact pre-Submission-Period baseline commit;
- the pre-existing features and architecture;
- the Build Week commit range;
- all newly created AxiomGate modules;
- all Build Week changes to PatchPilot;
- new tests and evidence;
- timestamped Codex session evidence;
- the primary `/feedback` session ID;
- before-and-after screenshots or other evidence where useful.

Only work added during the Submission Period should be presented for hackathon evaluation.

## Repository requirements

Provide a repository URL that is either:

### Public repository

- accessible without authentication;
- accompanied by a relevant open-source license;
- free of secrets and private data.

### Private repository

Share access with both:

- `testing@devpost.com`
- `build-week-event@openai.com`

Verify access in an incognito or independent account before submission.

## README requirements

The final README must include:

- concise problem and product explanation;
- installation instructions;
- supported platforms;
- prerequisites and exact versions;
- setup commands;
- sample or synthetic data when needed;
- clear run and test instructions;
- one-command judge path where practical;
- demo, sandbox, or test-account instructions;
- known limitations;
- security and privacy notes;
- how Codex accelerated the workflow;
- where the developer made key product, engineering, and design decisions;
- how GPT-5.6 is integrated and what it does;
- the Hackathon Delta link;
- the Build Receipt/evidence link.

## Developer-tool testing path

Because AxiomGate is a developer tool, judges must be able to evaluate it without rebuilding the entire environment from scratch.

Provide at least one of:

- deterministic replay environment;
- downloadable test build;
- sandbox;
- hosted demo;
- test account;
- clean one-command installer plus a short judge workflow.

The testing path must be free of charge and remain available through the end of judging. It must not require a judge's personal GitHub, Vercel, Telegram, OpenAI, or other sensitive credentials for the core evaluation.

## Demo video requirements

Use the stricter Official Rules wording.

The demo video must:

- be **less than three minutes**; target approximately **2:45-2:55**;
- be uploaded to **YouTube**;
- be **publicly visible**;
- show a clear, working demonstration;
- contain audio/voiceover;
- explain what was built;
- explain specifically how Codex was used;
- explain specifically how GPT-5.6 was used in the product;
- accurately label LIVE, SANDBOX, and REPLAY behavior;
- avoid copyrighted music, third-party marks, or protected material without permission;
- be in English or have complete English translation materials.

Showing Codex briefly is not strictly mandatory, but it is strongly recommended as visible evidence of genuine use.

## Codex `/feedback` requirement

Run `/feedback` in the primary Codex thread where the majority of core functionality was built.

- Preserve the generated Session ID privately and in the submission checklist.
- Submit the most representative primary build thread, not a planning-only or test-only thread.
- Document other significant Codex sessions in `CODEX_COLLABORATION.md`.
- Do not fabricate, substitute, or lose the primary session ID.

## Submission description and materials

The Devpost submission must include:

- working project;
- Developer Tools category;
- clear project description;
- public YouTube demo link;
- repository URL;
- primary Codex `/feedback` Session ID;
- testing path;
- screenshots/images only when accurate and useful;
- English text or English translation.

Judges may not run the repository. The description, images, README, and video must therefore stand on their own.

## Judging alignment

### Stage One: viability

Prove immediately that AxiomGate:

- fits Developer Tools;
- meaningfully uses Codex and GPT-5.6;
- is a working and testable product rather than a concept document.

### Stage Two: equally weighted criteria

#### Technological Implementation

Show real Codex execution, non-trivial architecture, tests, PatchPilot remediation, Runway decisions, enforcement, and reproducible evidence.

#### Design

Show one coherent product flow with polished web-dashboard/CLI behavior, clear states, semantic approvals, and understandable errors.

#### Potential Impact

Show the specific developer failures prevented: runaway usage, continuity loss, wrong identity, over-privileged actions, unverified completion, and AI-generated code regressions.

#### Quality of the Idea

Emphasize proof-carrying agent execution and the integrated governance lifecycle, not the individual existence of skills, MCP, quota meters, or security scans.

The rules permit automated AI-driven analysis, expert panels, peer review, or combinations. Structure evidence so both machines and humans can understand it.

## Submission editing

- Drafts and submitted entries may be edited before the deadline.
- After the Submission Period ends, assume no substantive changes are allowed.
- Complete a final review and submit early.
- Do not rely on post-deadline portfolio edits to fix the hackathon submission.

## Final compliance checklist

- [ ] Registered and eligible.
- [ ] Developer Tools selected.
- [ ] Project works as described.
- [ ] Codex use is meaningful and evidenced.
- [ ] GPT-5.6 use is meaningful and evidenced.
- [ ] Primary `/feedback` Session ID captured.
- [ ] `HACKATHON_DELTA.md` complete.
- [ ] `CODEX_COLLABORATION.md` complete.
- [ ] Public repository has a relevant license, or private repository is shared with both judging addresses.
- [ ] README contains setup, sample data, test path, platforms, Codex collaboration, GPT-5.6 integration, and limitations.
- [ ] Judge path works from a clean machine/account.
- [ ] Demo is public on YouTube and less than three minutes.
- [ ] Demo includes accurate audio covering project, Codex, and GPT-5.6.
- [ ] Demo contains no unauthorized copyrighted material.
- [ ] Submission materials are in English or translated.
- [ ] Third-party licenses and permissions are verified.
- [ ] No secrets, private data, or harmful code are included.
- [ ] All public claims map to reproducible evidence.
- [ ] Testing path remains available through at least August 12, 2026.
- [ ] Devpost form and every link checked in an independent browser session.
- [ ] Submission completed at least one hour before the official deadline.
