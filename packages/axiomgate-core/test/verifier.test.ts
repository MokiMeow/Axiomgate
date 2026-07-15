import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildVerifierPlan,
  compileMission,
  createMission,
  generateHookConfig,
  missionDirectory,
  parseVerifierFindings,
  reviewMission,
  type IdentityReport,
} from "../src/index.js";

function verifierIdentity(capturedAt: string): IdentityReport {
  return {
    githubLogin: {
      status: "RESOLVED",
      value: "MokiMeow",
      source: "gh api user",
      confidence: "HIGH",
      capturedAt,
    },
    gitRemotes: {
      status: "RESOLVED",
      value: [],
      source: "git remote -v",
      confidence: "HIGH",
      capturedAt,
    },
    vercelUser: {
      status: "UNAVAILABLE",
      source: "vercel whoami",
      reason: "not needed",
      capturedAt,
    },
    vercelProject: {
      status: "UNAVAILABLE",
      source: ".vercel/project.json",
      reason: "not needed",
      capturedAt,
    },
  };
}

describe("buildVerifierPlan", () => {
  it("starts a fresh governed verifier session with its schema and phase model", () => {
    const contract = compileMission(
      { objective: "Add hello.txt", boundary: "MODIFY_LOCAL" },
      { id: "msn_review" },
    ).contract;
    const hookConfigOptions = {
      cliEntryPath: "C:/Program Files/AxiomGate/cli.js",
      nodePath: process.execPath,
    };
    const missionDir = "C:/work project/.axiomgate/missions/msn_review";
    const projectPath = "C:/work project";
    const outputSchemaPath = join(missionDir, "verifier-output-schema.json");
    const plan = buildVerifierPlan({
      contract,
      missionDir,
      projectPath,
      diff: "diff --git a/hello.txt b/hello.txt",
      outputSchemaPath,
      isGitRepository: false,
      hookConfigOptions,
    });
    const hook = generateHookConfig(plan.missionDir, hookConfigOptions);

    expect(plan).toMatchObject({
      model: "gpt-5.6-terra",
      effort: "high",
      sandbox: "read-only",
      networkAccess: false,
      outputSchemaPath,
    });
    expect(plan.args).toEqual([
      "exec",
      "--json",
      "--model",
      "gpt-5.6-terra",
      "-c",
      'model_reasoning_effort="high"',
      "--sandbox",
      "read-only",
      "--dangerously-bypass-hook-trust",
      "--cd",
      plan.projectPath,
      "--skip-git-repo-check",
      ...hook.codexArgs,
      "--output-schema",
      outputSchemaPath,
      "-",
    ]);
    expect(plan.args).not.toContain("resume");
    expect(plan.stdin).toContain("criterion_implement");
    expect(plan.stdin).toContain("diff --git a/hello.txt b/hello.txt");
    expect(plan.stdin).toContain("security issues");
  });
});

describe("parseVerifierFindings", () => {
  it("parses the final structured verifier message", () => {
    const result = parseVerifierFindings(
      [
        '{"type":"thread.started","thread_id":"verifier-session"}',
        '{"type":"item.completed","item":{"type":"agent_message","text":"[{\\"criterionId\\":\\"criterion_implement\\",\\"verdict\\":\\"looks_correct\\",\\"riskySpots\\":[\\"hello.txt\\"]},{\\"criterionId\\":\\"criterion_security\\",\\"verdict\\":\\"concern\\",\\"concern\\":\\"No regression test\\"}]"}}',
      ].join("\n"),
    );

    expect(result).toEqual({
      status: "VALID",
      findings: [
        {
          criterionId: "criterion_implement",
          verdict: "looks_correct",
          riskySpots: ["hello.txt"],
        },
        {
          criterionId: "criterion_security",
          verdict: "concern",
          concern: "No regression test",
        },
      ],
    });
  });

  it("reports malformed model output without inventing findings", () => {
    expect(
      parseVerifierFindings(
        '{"type":"item.completed","item":{"type":"agent_message","text":"not json"}}',
      ),
    ).toEqual({
      status: "INVALID",
      findings: [],
      reason: "verifier output is not valid JSON",
    });
  });
});

describe("reviewMission", () => {
  it("persists advisory findings and a role-tagged fresh session without mutating criteria", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-verifier-"));
    try {
      const hookConfigOptions = {
        cliEntryPath: join(projectPath, "cli", "index.js"),
        nodePath: process.execPath,
      };
      createMission(
        projectPath,
        { objective: "Add hello.txt" },
        {
          id: "msn_verifier",
          hookConfigOptions,
          resolveIdentity: () =>
            verifierIdentity("2026-07-15T19:00:00.000Z"),
        },
      );
      const missionDir = missionDirectory(projectPath, "msn_verifier");
      const contractPath = join(missionDir, "contract.json");
      const contractBefore = readFileSync(contractPath, "utf8");
      const output = [
        '{"type":"thread.started","thread_id":"fresh-verifier-session"}',
        '{"type":"item.completed","item":{"type":"agent_message","text":"[{\\"criterionId\\":\\"criterion_implement\\",\\"verdict\\":\\"concern\\",\\"concern\\":\\"Missing regression assertion\\"}]"}}',
        '{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":20}}',
      ].join("\n");
      let invokedArgs: readonly string[] = [];
      const result = await reviewMission(projectPath, "msn_verifier", {
        diff: "diff --git a/hello.txt b/hello.txt",
        reviewId: "review_fixture",
        hookConfigOptions,
        resolveIdentity: () =>
          verifierIdentity("2026-07-15T19:01:00.000Z"),
        isGitRepository: true,
        codexLaunch: { command: process.execPath, argsPrefix: ["codex.js"] },
        runner: async (command, args) => {
          invokedArgs = args;
          return {
            command,
            args,
            status: "SUCCESS",
            exitCode: 0,
            stdout: output,
            stderr: "",
            durationMs: 15,
          };
        },
        now: () => new Date("2026-07-15T19:02:00.000Z"),
        currentCommit: () => "abc123",
      });

      expect(invokedArgs).not.toContain("resume");
      expect(result.findings.status).toBe("VALID");
      expect(JSON.parse(readFileSync(join(missionDir, "findings.json"), "utf8"))).toMatchObject({
        status: "VALID",
        advisory: true,
        sessionId: "fresh-verifier-session",
        findings: [
          {
            criterionId: "criterion_implement",
            verdict: "concern",
            concern: "Missing regression assertion",
          },
        ],
      });
      expect(JSON.parse(readFileSync(join(missionDir, "sessions.json"), "utf8"))).toEqual([
        { id: "fresh-verifier-session", role: "verifier" },
      ]);
      expect(readFileSync(contractPath, "utf8")).toBe(contractBefore);
      const events = readFileSync(join(missionDir, "events.jsonl"), "utf8")
        .trim()
        .split(/\r?\n/u)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(events.at(-1)).toMatchObject({
        source: "command",
        command: "codex exec --json --output-schema",
        freshForCommit: "abc123",
      });
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it("persists an invalid advisory record for malformed structured output", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-verifier-invalid-"));
    try {
      const hookConfigOptions = {
        cliEntryPath: join(projectPath, "cli", "index.js"),
        nodePath: process.execPath,
      };
      createMission(
        projectPath,
        { objective: "Add hello.txt" },
        {
          id: "msn_verifier_invalid",
          hookConfigOptions,
          resolveIdentity: () =>
            verifierIdentity("2026-07-15T19:00:00.000Z"),
        },
      );
      const result = await reviewMission(projectPath, "msn_verifier_invalid", {
        diff: "",
        reviewId: "review_invalid",
        hookConfigOptions,
        resolveIdentity: () =>
          verifierIdentity("2026-07-15T19:01:00.000Z"),
        isGitRepository: true,
        runner: async (command, args) => ({
          command,
          args,
          status: "SUCCESS",
          exitCode: 0,
          stdout:
            '{"type":"thread.started","thread_id":"invalid-session"}\n{"type":"item.completed","item":{"type":"agent_message","text":"not json"}}',
          stderr: "",
          durationMs: 10,
        }),
        now: () => new Date("2026-07-15T19:02:00.000Z"),
        currentCommit: () => "abc123",
      });

      expect(result.findings).toEqual({
        status: "INVALID",
        findings: [],
        reason: "verifier output is not valid JSON",
      });
      const stored = JSON.parse(
        readFileSync(
          join(
            missionDirectory(projectPath, "msn_verifier_invalid"),
            "findings.json",
          ),
          "utf8",
        ),
      ) as Record<string, unknown>;
      expect(stored).toMatchObject({
        status: "INVALID",
        advisory: true,
        reason: "verifier output is not valid JSON",
        findings: [],
      });
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });
});
