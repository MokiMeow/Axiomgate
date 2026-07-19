import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  approve,
  classifyHookPayload,
  createMissionSnapshot,
  generateHookConfig,
  hashContract,
  listPending,
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
        orgId: "team_fixture_owner",
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
  intentBoundary: MissionContract["intentBoundary"] = "MODIFY_LOCAL",
): MissionContract {
  const base = {
    id: "msn_hook",
    version: 1,
    hash: `sha256:${"0".repeat(64)}`,
    objective: "Prove denied publish enforcement",
    projectProfileId: "prj_axiomgate",
    intentBoundary,
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

function configureMission(
  missionDir: string,
  missionContract: MissionContract = contract(),
) {
  const options = {
    cliEntryPath: join(missionDir, "cli", "index.js"),
    nodePath: process.execPath,
  };
  const config = generateHookConfig(missionDir, options);
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

function verifiedTarget() {
  return {
    verdict: "VERIFIED_OWNED" as const,
    reason: "fixture target is owned",
    rawOutput: "fixture",
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
    expect(
      config.overrides.every(
        (value) =>
          value.includes('matcher="Bash"') &&
          value.includes('matcher="apply_patch"'),
      ),
    ).toBe(true);
    if (process.platform === "win32") {
      expect(config.command).toMatch(/^node "[A-Z]:\//u);
      expect(config.command).not.toContain("\\");
    }

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
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
      },
    });
  });

  it("echoes PermissionRequest in its JSON decision contract", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(missionDir);
    const result = processHookInvocation(
      JSON.stringify({
        ...payload("npm test"),
        hook_event_name: "PermissionRequest",
      }),
      missionDir,
      { configOptions },
    );

    expect(result.output.hookSpecificOutput).toMatchObject({
      hookEventName: "PermissionRequest",
      permissionDecision: "allow",
    });
    expect(result.event.hookEvent).toBe("PermissionRequest");
  });

  it("Approval reviewer user: AxiomGate returns its PermissionRequest decision", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(
      missionDir,
      contract(undefined, "DEPLOY_PREVIEW"),
    );
    const result = processHookInvocation(
      JSON.stringify({
        ...payload("vercel deploy"),
        hook_event_name: "PermissionRequest",
      }),
      missionDir,
      {
        configOptions,
        approvalsReviewer: "user",
        verifyDeployTarget: verifiedTarget,
      },
    );

    expect(result.output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(result.event).toMatchObject({
      decision: "DENY",
      effectiveReviewer: "user",
      reviewerDisposition: "AXIOMGATE",
    });
    expect(listPending(missionDir)).toHaveLength(1);
  });

  it.each(["guardian_subagent", "auto_review"])(
    "Approval reviewer %s: AxiomGate defers without a second prompt",
    (reviewer) => {
      const missionDir = missionDirectory();
      const configOptions = configureMission(
        missionDir,
        contract(undefined, "DEPLOY_PREVIEW"),
      );
      const result = processHookInvocation(
        JSON.stringify({
          ...payload("vercel deploy"),
          hook_event_name: "PermissionRequest",
        }),
        missionDir,
        {
          configOptions,
          approvalsReviewer: reviewer,
          verifyDeployTarget: verifiedTarget,
        },
      );

      expect(result.output.hookSpecificOutput?.permissionDecision).toBeUndefined();
      expect(result.output.systemMessage).toContain("native approval reviewer");
      expect(result.event).toMatchObject({
        decision: "DEFER",
        effectiveReviewer: reviewer,
        reviewerDisposition: "CODEX_NATIVE",
      });
      expect(result.event.reasons.join(" ")).toContain("native approval reviewer");
      expect(listPending(missionDir)).toHaveLength(0);
    },
  );

  it("Approval reviewer unknown: AxiomGate defers to explicit approval safely", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(
      missionDir,
      contract(undefined, "DEPLOY_PREVIEW"),
    );
    const result = processHookInvocation(
      JSON.stringify({
        ...payload("vercel deploy"),
        hook_event_name: "PermissionRequest",
      }),
      missionDir,
      {
        configOptions,
        approvalsReviewer: "future_reviewer",
        verifyDeployTarget: verifiedTarget,
      },
    );

    expect(result.output.hookSpecificOutput?.permissionDecision).toBeUndefined();
    expect(result.output.systemMessage).toContain("explicit approval");
    expect(result.event).toMatchObject({
      decision: "DEFER",
      effectiveReviewer: "future_reviewer",
      reviewerDisposition: "EXPLICIT_APPROVAL",
    });
    expect(result.event.reasons.join(" ")).toContain("explicit approval");
    expect(listPending(missionDir)).toHaveLength(0);
  });

  it("binds a configured native reviewer into the hook command and config hash", () => {
    const missionDir = missionDirectory();
    const base = generateHookConfig(missionDir, {
      cliEntryPath: join(missionDir, "cli", "index.js"),
      nodePath: process.execPath,
    });
    const native = generateHookConfig(missionDir, {
      cliEntryPath: join(missionDir, "cli", "index.js"),
      nodePath: process.execPath,
      approvalsReviewer: "guardian_subagent",
    });

    expect(native.command).toContain("--approvals-reviewer guardian_subagent");
    expect(native.configHash).not.toBe(base.configHash);
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

  it("allows an exact approved command once across hook retries", () => {
    const missionDir = missionDirectory();
    const configOptions = configureMission(
      missionDir,
      contract(undefined, "DEPLOY_PREVIEW"),
    );
    const first = processHookInvocation(
      JSON.stringify(payload("vercel deploy")),
      missionDir,
      {
        configOptions,
        now: () => new Date("2026-07-15T14:10:00.000Z"),
        verifyDeployTarget: verifiedTarget,
      },
    );
    expect(first.output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(first.request).toBeDefined();
    expect(
      approve(missionDir, first.request!.id, {
        approver: "fixture-user",
        now: () => new Date("2026-07-15T14:11:00.000Z"),
      }).status,
    ).toBe("APPROVED");

    const retriedPayload = { ...payload("vercel deploy"), tool_use_id: "retry" };
    const allowed = processHookInvocation(
      JSON.stringify(retriedPayload),
      missionDir,
      {
        configOptions,
        now: () => new Date("2026-07-15T14:12:00.000Z"),
        verifyDeployTarget: verifiedTarget,
      },
    );
    expect(allowed.output.hookSpecificOutput.permissionDecision).toBe("allow");

    const consumed = processHookInvocation(
      JSON.stringify({ ...retriedPayload, tool_use_id: "third" }),
      missionDir,
      {
        configOptions,
        now: () => new Date("2026-07-15T14:13:00.000Z"),
        verifyDeployTarget: verifiedTarget,
      },
    );
    expect(consumed.output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(
      listPending(missionDir, {
        now: () => new Date("2026-07-15T14:13:00.000Z"),
      }),
    ).toHaveLength(1);
  });
});
