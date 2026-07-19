import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifyHookPayload,
  createMissionSnapshot,
  generateHookConfig,
  hashContract,
  processHookInvocation,
  writeMissionSnapshot,
  type HookConfigOptions,
  type IdentityReport,
  type MissionContract,
} from "../src/index.js";

function identity(): IdentityReport {
  const capturedAt = "2026-07-19T14:00:00.000Z";
  return {
    githubLogin: {
      status: "RESOLVED",
      value: "fixture-owner",
      source: "gh api user",
      confidence: "HIGH",
      capturedAt,
    },
    gitRemotes: {
      status: "RESOLVED",
      value: [{
        name: "origin",
        url: "https://github.com/fixture-owner/AxiomGate.git",
        direction: "fetch",
      }],
      source: "git remote -v",
      confidence: "HIGH",
      capturedAt,
    },
    vercelUser: {
      status: "UNAVAILABLE",
      source: "vercel whoami",
      reason: "not required",
      capturedAt,
    },
    vercelProject: {
      status: "UNAVAILABLE",
      source: ".vercel/project.json",
      reason: "not required",
      capturedAt,
    },
  };
}

function contract(): MissionContract {
  const draft = {
    id: "msn_mechanism_equivalence",
    version: 1,
    hash: `sha256:${"0".repeat(64)}`,
    objective: "Prove mechanism-independent policy",
    projectProfileId: "axiomgate",
    intentBoundary: "PUBLISH",
    acceptanceCriteria: [],
    constraints: [],
    nonGoals: [],
    actionPolicy: [
      { action: "repository.read", decision: "ALLOW" },
      { action: "pull_request.create", decision: "DENY" },
    ],
    modelPlan: [],
    status: "ACTIVE",
    createdAt: "2026-07-19T14:00:00.000Z",
    updatedAt: "2026-07-19T14:00:00.000Z",
  } as const;
  return { ...draft, hash: hashContract(draft) };
}

function payload(toolName: string, toolInput: Record<string, unknown>, id: string) {
  return JSON.stringify({
    session_id: "session-equivalence",
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: id,
    cwd: "C:/fixture/AxiomGate",
  });
}

describe("X4 multi-mechanism equivalence", () => {
  it("gives shell and MCP pull-request creation the same semantic verdict and reason", () => {
    const missionDir = mkdtempSync(join(tmpdir(), "axiomgate-x4-"));
    const configOptions: HookConfigOptions = {
      cliEntryPath: join(missionDir, "cli.js"),
      nodePath: process.execPath,
      mcpToolMatchers: ["github_create_pull_request"],
    };
    try {
      const mission = contract();
      const config = generateHookConfig(missionDir, configOptions);
      writeMissionSnapshot(
        missionDir,
        createMissionSnapshot({
          contract: mission,
          policy: mission.actionPolicy,
          identity: identity(),
          hookConfigHash: config.configHash,
        }),
      );
      const shell = processHookInvocation(
        payload(
          "Bash",
          { command: "gh pr create --repo fixture-owner/AxiomGate --title governed" },
          "shell-call",
        ),
        missionDir,
        { configOptions },
      );
      const mcp = processHookInvocation(
        payload(
          "github_create_pull_request",
          { owner: "fixture-owner", repo: "AxiomGate", title: "governed" },
          "mcp-call",
        ),
        missionDir,
        { configOptions },
      );

      expect(shell.request?.semanticAction).toBe("pull_request.create");
      expect(mcp.request?.semanticAction).toBe("pull_request.create");
      expect(shell.request?.mechanism).toBe("gh_cli");
      expect(mcp.request?.mechanism).toBe("mcp:github_create_pull_request");
      expect(shell.event.decision).toBe("DENY");
      expect(mcp.event.decision).toBe("DENY");
      expect(mcp.event.reasons).toEqual(shell.event.reasons);
      expect(mcp.output).toMatchObject({
        hookSpecificOutput: { permissionDecision: "deny" },
      });

      const events = readFileSync(join(missionDir, "events.jsonl"), "utf8")
        .trim()
        .split(/\r?\n/u)
        .map((line) => JSON.parse(line) as { decision: string });
      expect(events).toHaveLength(2);
      expect(events.every((event) => event.decision === "DENY")).toBe(true);
    } finally {
      rmSync(missionDir, { recursive: true, force: true });
    }
  });

  it("denies unknown MCP mechanisms conservatively and enumerates exact matchers", () => {
    expect(
      classifyHookPayload({
        tool_name: "untrusted_remote_mutation",
        tool_input: { target: "somewhere" },
      }),
    ).toMatchObject({
      semanticAction: "UNKNOWN",
      mechanism: "mcp:untrusted_remote_mutation",
      stateChanging: true,
    });

    const left = generateHookConfig("C:/fixture/mission", {
      cliEntryPath: "C:/fixture/cli.js",
      nodePath: process.execPath,
      mcpToolMatchers: ["github_create_pull_request", "vercel_create_deployment"],
    });
    const right = generateHookConfig("C:/fixture/mission", {
      cliEntryPath: "C:/fixture/cli.js",
      nodePath: process.execPath,
      mcpToolMatchers: ["vercel_create_deployment", "github_create_pull_request"],
    });
    expect(left.configHash).toBe(right.configHash);
    expect(left.overrides.join("\n")).toContain('matcher="github_create_pull_request"');
    expect(left.overrides.join("\n")).not.toContain('matcher=".*"');
    expect(left.command).toContain("--mcp-tool-matcher github_create_pull_request");
  });
});
