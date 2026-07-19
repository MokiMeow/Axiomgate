# Codex skill and verifier-agent verification

Verified on 2026-07-16 with `codex-cli 0.144.4` on Windows. Absolute user
paths below are normalized to `<repo>`; no credentials or authentication state
are included.

## Native interface observation

`codex features list` reported `multi_agent` as stable and enabled.

`codex exec --help` exposed model, config, sandbox, output-schema, and session
options, but no `--agent` or other deterministic named-agent selector. The
current Codex manual documents custom agents as prompt/model-driven spawned
agents and defines the loadable keys as `developer_instructions`,
`model_reasoning_effort`, and `sandbox_mode`.

Therefore AxiomGate ships and installs the native `axiomgate-verifier` agent,
but `mission review` honestly retains its existing deterministic fresh-session
read-only verifier path on 0.144.4. It does not fake native delegation.

## Skill validation

The skill-creator validator was run against the committed skill:

```text
python <skill-creator>/scripts/quick_validate.py .agents/skills/axiomgate
Skill is valid!
```

The skill contains no helper scripts. It references only implemented
`axiomgate mission verify <id>` and `axiomgate mission status <id>` commands.

## Temp-home installation proof

The proof used `CODEX_HOME=<repo>/.local/codex-native-proof`; the real user
Codex home was not changed.

Dry run:

```text
Codex integration: DRY_RUN
PLANNED: <repo>/.agents/skills/axiomgate/SKILL.md -> <CODEX_HOME>/skills/axiomgate/SKILL.md
PLANNED: <repo>/.agents/skills/axiomgate/agents/openai.yaml -> <CODEX_HOME>/skills/axiomgate/agents/openai.yaml
PLANNED: <repo>/.agents/agents/axiomgate-verifier.toml -> <CODEX_HOME>/agents/axiomgate-verifier.toml
```

Real install followed by the idempotency check:

```text
Codex integration: INSTALL
WRITTEN: <CODEX_HOME>/skills/axiomgate/SKILL.md
WRITTEN: <CODEX_HOME>/skills/axiomgate/agents/openai.yaml
WRITTEN: <CODEX_HOME>/agents/axiomgate-verifier.toml

Codex integration: INSTALL
UNCHANGED: <CODEX_HOME>/skills/axiomgate/SKILL.md
UNCHANGED: <CODEX_HOME>/skills/axiomgate/agents/openai.yaml
UNCHANGED: <CODEX_HOME>/agents/axiomgate-verifier.toml
```

There is no `codex skills` inspection command in 0.144.4. Doctor provides the
supported presence check:

```text
node: v24.11.1
codex CLI: codex-cli 0.144.4
git repository: yes (main; clean)
Codex capacity: UNAVAILABLE (Codex app-server returned no valid rate-limit response)
AxiomGate skill: present (<CODEX_HOME>/skills/axiomgate/SKILL.md)
AxiomGate verifier agent: present (<CODEX_HOME>/agents/axiomgate-verifier.toml)
```

Capacity is unavailable in the isolated temp home because it deliberately has
no authentication state; this does not affect the native-artifact presence
check.

## Live independent review proof

Command (default verify-phase model and effort):

```text
axiomgate mission review msn_1af4f266df33453f8f7d --project .local/verifytest --timeout-ms 90000
```

Output:

```text
Verifier: FRESH (gpt-5.6-terra/high; sandbox=read-only)
Native verifier: codex exec has no deterministic named-agent selector; using a fresh read-only verifier session
Session: 019f6af1-79f0-7860-b442-1d2791c933e9 (verifier)
Findings: 0 (VALID; advisory)
```

The persisted `findings.json` is valid/advisory and carries the same fresh
session ID, model `gpt-5.6-terra`, effort `high`, and an output hash. The
session was appended to `sessions.json` with role `verifier`.

The target fixture already had V-phase changes before review. Its complete
tracked binary diff hash was identical before and after, and its status lines
were unchanged:

```text
BEFORE_DIFF_HASH=433ccc689d10564c8fc15d66859acd61a7021c84
AFTER_DIFF_HASH=433ccc689d10564c8fc15d66859acd61a7021c84

 M package-lock.json
 M package.json
?? <fixture-cache>/
?? evidence/
```

This proves the read-only verifier did not mutate the existing dirty fixture;
the evidence does not relabel that pre-existing state as clean.

## Automated verification

```text
Skill is valid!

pnpm typecheck
packages/axiomgate-core typecheck: Done
apps/cli typecheck: Done

pnpm test
Test Files  18 passed (18)
Tests       182 passed | 1 skipped (183)

pnpm build
packages/axiomgate-core build: Done
apps/cli build: Done
```

The skipped test is the existing opt-in live identity smoke test.
