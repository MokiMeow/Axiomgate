import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  classifyHookPayload,
  createMissionSnapshot,
  generateHookConfig,
  hashContract,
  processHookInvocation,
  verifyEnforcement,
  writeMissionSnapshot,
  type IdentityReport,
  type MissionContract,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function missionDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "axiomgate-hook-"));
  temporaryDirectories.push(directory);
  return directory;
}

function identity(): IdentityReport {
  const capturedAt = "2026-07-15T14:00:00.000Z";
  return {
    githubLogin: {
      status: "RESOLVED",
      value: "mokimeow",
      source: "gh api user",
      confidence: "HIGH",
      capturedAt,
    },
    gitRemotes: {
      status: "RESOLVED",
      value: [
        {
          name: "origin",
          url: "https://github.com/mokimeow/AxiomGate.git",
          direction: "fetch",
        },
      ],
      source: "git remote -v",
      confidence: "HIGH",
      capturedAt,
    },
    vercelUser: {
      status: "RESOLVED",
      value: "mokimeow",
      source: "vercel whoami",
      confidence: "HIGH",
      capturedAt,
    },
    vercelProject: {
      status: "RESOLVED",
      value: {
        projectId: "prj_axiomgate",
        orgId: "team_mokimeow",
        projectName: "axiomgate-preview",
      },
      source: ".vercel/project.json",
      confidence: "HIGH",
      capturedAt,
    },
  };
}

function contract(
  actionPolicy: MissionContract["actionPolicy"] = [
    { action: "repository.read", decision: "ALLOW" },
    { action: "file.modify", decision: "ALLOW" },
    { action: "verification.run", decision: "ALLOW" },
    { action: "pull_request.create", decision: "DENY" },
    { action: "preview.deploy", decision: "REQUIRE_APPROVAL" },
    { action: "production.deploy", decision: "DENY" },
  ],
): MissionContract {
  const base = {
    id: "msn_hook",
    version: 1,
    hash: `sha256:${"0".repeat(64)}`,
    objective: "Prove denied publish enforcement",
    projectProfileId: "prj_axiomgate",
    intentBoundary: "MODIFY_LOCAL",
    acceptanceCriteria: [],
    constraints: [],
    nonGoals: [],
    actionPolicy,
    modelPlan: [],
    status: "ACTIVE",
    createdAt: "2026-07-15T14:00:00.000Z",
    updatedAt: "2026-07-15T14:00:00.000Z",
  } as const;

  return { ...base, hash: hashContract(base) };
}

function configureMission(missionDir: string) {
  const options = {
    cliEntryPath: join(missionDir, "cli", "index.js"),
    nodePath: process.execPath,
  };
  const config = generateHookConfig(missionDir, options);
  const missionContract = contract();
  writeMissionSnapshot(
    missionDir,
    createMissionSnapshot({
      contract: missionContract,
      policy: missionContract.actionPolicy,
      identity: identity(),
      hookConfigHash: config.configHash,
    }),
  );
  return options;
}

function payload(command: string, toolName = "Bash") {
  return {
    session_id: "session_fixture",
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input:
      toolName === "apply_patch" ? { patch: command } : { command },
    tool_use_id: "tool_fixture",
    cwd: "C:/fixture",
  };
}

describe("classifyHookPayload", () => {
  it.each([
    ["gh pr create --title demo", "pull_request.create"],
    ["git push origin agent/demo", "pull_request.create"],
    ["vercel deploy --prod", "production.deploy"],
    ["vercel deploy", "preview.deploy"],
    ["npm test", "verification.run"],
  ])("classifies %s as %s", (command, semanticAction) => {
    expect(classifyHookPayload(payload(command)).semanticAction).toBe(
      semanticAction,
    );
  });

  it("classifies an apply_patch tool payload as a local file modification", () => {
    expect(
      classifyHookPayload(
        payload("*** Begin Patch\n*** End Patch", "apply_patch"),
      ).semanticAction,
    ).toBe("file.modify");
  });
});

describe("mission hook configuration", () => {
  it("generates both exact hook overrides and verifies their snapshot", () => {
    const missionDir = missionDirectory();
    const options = {
      cliEntryPath: join(missionDir, "cli", "index.js"),
      nodePath: process.execPath,
    };
    const config = generateHookConfig(missionDir, options);

    expect(config.overrides).toHaveLength(2);
    expect(config.overrides[0]).toContain("hooks.PreToolUse=");
    expect(config.overrides[1]).toContain("hooks.PermissionRequest=");
    expect(config.overrides.every((value) => value.includes('matcher=".*"'))).toBe(
      true,
    );

    writeMissionSnapshot(
      missionDir,
      createMissionSnapshot({
        contract: contract(),
        policy: contract().actionPolicy,
        identity: identity(),
        hookConfigHash: config.configHash,
      }),
    );

    expect(verifyEnforcement(missionDir, options)).toMatchObject({
      status: "VERIFIED",
      configHash: config.configHash,
    });
  });

  it("refuses a mission snapshot whose content changed after hashing", () => {
    const missionDir = missionDirectory();
    const options = {
      cliEntryPath: join(missionDir, "cli", "index.js"),
      nodePath: process.execPath,
    };
    const config = generateHookConfig(missionDir, options);
    writeMissionSnapshot(
      missionDir,
      createMissionSnapshot({
        contract: contract(),
        policy: contract().actionPolicy,
        identity: identity(),
        hookConfigHash: config.configHash,
      }),
    );

    const path = join(missionDir, "mission-snapshot.json");
    const snapshot = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    snapshot.hookConfigHash = `sha256:${"f".repeat(64)}`;
    writeFileSync(path, JSON.stringify(snapshot), "utf8");

    expect(verifyEnforcement(missionDir, options)).toMatchObject({
      status: "REFUSED",
    });
  });
});

describe("processHookInvocation", () => {
  it("allows an allow-listed verification command with the JSON hook contract", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(missionDir);
    const result = processHookInvocation(
      JSON.stringify(payload("npm test")),
      missionDir,
      { configOptions, now: () => new Date("2026-07-15T14:10:00.000Z") },
    );

    expect(result.output).toEqual({
      hookSpecificOutput: { permissionDecision: "allow" },
    });
  });

  it("denies a policy-prohibited action through JSON stdout", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(missionDir);
    const result = processHookInvocation(
      JSON.stringify(payload("git push origin agent/demo")),
      missionDir,
      { configOptions },
    );

    expect(result.output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(result.output.hookSpecificOutput.permissionDecisionReason).toContain(
      "above mission boundary",
    );
  });

  it("denies an unknown state-changing command", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(missionDir);
    const result = processHookInvocation(
      JSON.stringify(payload("rm -rf generated-output")),
      missionDir,
      { configOptions },
    );

    expect(result.output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(result.event.semanticAction).toBe("UNKNOWN");
  });

  it("fails closed when the snapshot hash does not match", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(missionDir);
    const path = join(missionDir, "mission-snapshot.json");
    const snapshot = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    snapshot.snapshotHash = `sha256:${"f".repeat(64)}`;
    writeFileSync(path, JSON.stringify(snapshot), "utf8");

    const result = processHookInvocation(
      JSON.stringify(payload("npm test")),
      missionDir,
      { configOptions },
    );
    expect(result.output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(result.output.hookSpecificOutput.permissionDecisionReason).toContain(
      "fail-closed: mission snapshot invalid",
    );
    expect(result.event.commandHash).not.toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("denies malformed stdin instead of throwing or relying on exit code 2", () => {
    const missionDir = missionDirectory();
    const result = processHookInvocation("{malformed", missionDir);
    expect(result.output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(result.output.hookSpecificOutput.permissionDecisionReason).toContain(
      "fail-closed",
    );
  });

  it("denies an internal thrown error", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(missionDir);
    const result = processHookInvocation(
      JSON.stringify(payload("npm test")),
      missionDir,
      {
        configOptions,
        now: () => {
          throw new Error("clock failed");
        },
      },
    );
    expect(result.output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(result.output.hookSpecificOutput.permissionDecisionReason).toContain(
      "internal hook error",
    );
  });

  it("appends exactly one well-formed event for a decision", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(missionDir);
    const result = processHookInvocation(
      JSON.stringify(payload("git push origin agent/demo")),
      missionDir,
      { configOptions, now: () => new Date("2026-07-15T14:10:00.000Z") },
    );
    const lines = readFileSync(join(missionDir, "events.jsonl"), "utf8")
      .trim()
      .split(/\r?\n/u);

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual(result.event);
    expect(result.event).toMatchObject({
      source: "hook",
      hookEvent: "PreToolUse",
      toolName: "Bash",
      decision: "DENY",
      missionId: "msn_hook",
      sessionId: "session_fixture",
    });
  });
});
