import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  approve,
  assemblePermissionQuads,
  createMissionSnapshot,
  generateHookConfig,
  hashContract,
  processHookInvocation,
  writeMissionSnapshot,
  type DeployTargetVerification,
  type Evidence,
  type HookDecisionEvent,
  type IdentityReport,
  type MissionContract,
} from "../src/index.js";

const directories: string[] = [];
const START = "2026-07-15T14:00:00.000Z";

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function missionDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "axiomgate-negative-"));
  directories.push(directory);
  return directory;
}

function resolvedIdentity(overrides: Partial<IdentityReport> = {}): IdentityReport {
  const capturedAt = START;
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
      value: [{
        name: "origin",
        url: "https://github.com/mokimeow/AxiomGate.git",
        direction: "fetch",
      }],
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
    ...overrides,
  };
}

function contract(
  boundary: MissionContract["intentBoundary"] = "DEPLOY_PREVIEW",
  actionPolicy: MissionContract["actionPolicy"] = [
    { action: "repository.read", decision: "ALLOW" },
    { action: "file.modify", decision: "ALLOW" },
    { action: "verification.run", decision: "ALLOW" },
    {
      action: "pull_request.create",
      decision: "REQUIRE_APPROVAL",
      restrict: { githubLogin: "mokimeow", githubRepo: "mokimeow/AxiomGate" },
    },
    {
      action: "preview.deploy",
      decision: "REQUIRE_APPROVAL",
      restrict: { vercelUser: "mokimeow", vercelProject: "axiomgate-preview" },
    },
    { action: "production.deploy", decision: "DENY" },
  ],
): MissionContract {
  const base = {
    id: "msn_negative",
    version: 1,
    hash: `sha256:${"0".repeat(64)}`,
    objective: "Prove forbidden actions remain forbidden",
    projectProfileId: "prj_axiomgate",
    intentBoundary: boundary,
    acceptanceCriteria: [],
    constraints: [],
    nonGoals: [],
    actionPolicy,
    modelPlan: [],
    status: "ACTIVE",
    createdAt: START,
    updatedAt: START,
  } as const;
  return { ...base, hash: hashContract(base) };
}

function configure(
  directory: string,
  options: {
    identity?: IdentityReport;
    contract?: MissionContract;
  } = {},
) {
  const configOptions = {
    cliEntryPath: join(directory, "cli", "index.js"),
    nodePath: process.execPath,
  };
  const config = generateHookConfig(directory, configOptions);
  const mission = options.contract ?? contract();
  writeMissionSnapshot(
    directory,
    createMissionSnapshot({
      contract: mission,
      policy: mission.actionPolicy,
      identity: options.identity ?? resolvedIdentity(),
      hookConfigHash: config.configHash,
    }),
  );
  return configOptions;
}

function payload(command: string, extra: Record<string, unknown> = {}) {
  return {
    session_id: "session_negative",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command },
    tool_use_id: "tool_negative",
    cwd: "C:/fixture",
    ...extra,
  };
}

function targetEvidence(verdict: DeployTargetVerification["verdict"]): DeployTargetVerification {
  const output = `fixture target verdict: ${verdict}`;
  const evidence: Evidence = {
    id: `ev_target_${verdict.toLowerCase()}`,
    missionId: "msn_negative",
    criterionId: "environment-guard",
    source: "api",
    command: "fixture target verification",
    exitCode: verdict === "NOT_FOUND" ? 1 : 0,
    outputHash: `sha256:${createHash("sha256").update(output).digest("hex")}`,
    outputRef: ".local/evidence/target.log",
    capturedAt: START,
    freshForCommit: "contract-fixture",
    label: "REPLAY",
    redacted: true,
  };
  return {
    verdict,
    reason: output,
    evidence,
    rawOutput: output,
  };
}

function invoke(
  directory: string,
  command: string,
  options: {
    configOptions: ReturnType<typeof configure>;
    now?: () => Date;
    verdict?: DeployTargetVerification["verdict"];
    extraPayload?: Record<string, unknown>;
  },
) {
  return processHookInvocation(
    JSON.stringify(payload(command, options.extraPayload)),
    directory,
    {
      configOptions: options.configOptions,
      now: options.now,
      verifyDeployTarget: () => targetEvidence(options.verdict ?? "VERIFIED_OWNED"),
    },
  );
}

function storedLines(directory: string): unknown[] {
  return readFileSync(join(directory, "events.jsonl"), "utf8")
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line) as unknown);
}

function expectDeniedWithEvent(
  directory: string,
  result: ReturnType<typeof processHookInvocation>,
): void {
  expect(result.output.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(result.event.decision).toBe("DENY");
  expect(storedLines(directory)).toContainEqual(result.event);
}

describe("G5 negative guard suite", () => {
  it("Credential confusion: wrong GitHub identity blocks publish and records denial", () => {
    const directory = missionDir();
    const configOptions = configure(directory, {
      identity: resolvedIdentity({
        githubLogin: {
          status: "RESOLVED",
          value: "intruder",
          source: "gh api user",
          confidence: "HIGH",
          capturedAt: START,
        },
      }),
    });
    const result = invoke(directory, "git push origin agent/demo", { configOptions });
    expectDeniedWithEvent(directory, result);
    expect(result.event.reasons.join(" ")).toContain("does not match required login");
  });

  it.each(["EXISTS_NOT_OWNED", "NOT_FOUND"] as const)(
    "Credential confusion: Vercel target verdict %s blocks preview and records target evidence",
    (verdict) => {
      const directory = missionDir();
      const configOptions = configure(directory);
      const result = invoke(directory, "vercel deploy", { configOptions, verdict });
      expectDeniedWithEvent(directory, result);
      expect(result.event.reasons.join(" ")).toContain(verdict);
      expect(storedLines(directory)).toContainEqual(
        expect.objectContaining({ id: `ev_target_${verdict.toLowerCase()}` }),
      );
    },
  );

  it("Approval confusion: action substitution after approval is denied and evidenced", () => {
    const directory = missionDir();
    const configOptions = configure(directory);
    const requested = invoke(directory, "vercel deploy", { configOptions });
    approve(directory, requested.request!.id, {
      approver: "fixture-user",
      now: () => new Date("2026-07-15T14:01:00.000Z"),
    });
    const substituted = invoke(directory, "git push origin agent/demo", { configOptions });
    expectDeniedWithEvent(directory, substituted);
    expect(substituted.request?.id).not.toBe(requested.request?.id);
  });

  it("Approval confusion: argument and target mutation voids approval and records denial", () => {
    const directory = missionDir();
    const configOptions = configure(directory);
    const requested = invoke(directory, "vercel deploy", { configOptions });
    approve(directory, requested.request!.id, {
      approver: "fixture-user",
      now: () => new Date("2026-07-15T14:01:00.000Z"),
    });
    const mutated = invoke(directory, "vercel deploy --name another-project", { configOptions });
    expectDeniedWithEvent(directory, mutated);
    expect(mutated.event.commandHash).not.toBe(requested.event.commandHash);
  });

  it("Approval confusion: expired approval is denied and evidenced", () => {
    const directory = missionDir();
    const configOptions = configure(directory);
    const requested = invoke(directory, "vercel deploy", {
      configOptions,
      now: () => new Date(START),
    });
    approve(directory, requested.request!.id, {
      approver: "fixture-user",
      now: () => new Date("2026-07-15T14:01:00.000Z"),
    });
    const expired = invoke(directory, "vercel deploy", {
      configOptions,
      now: () => new Date("2026-07-15T14:16:00.000Z"),
    });
    expectDeniedWithEvent(directory, expired);
  });

  it("Approval confusion: single-use approval reuse is denied and evidenced", () => {
    const directory = missionDir();
    const configOptions = configure(directory);
    const requested = invoke(directory, "vercel deploy", { configOptions });
    approve(directory, requested.request!.id, {
      approver: "fixture-user",
      now: () => new Date("2026-07-15T14:01:00.000Z"),
    });
    expect(invoke(directory, "vercel deploy", { configOptions }).event.decision).toBe("ALLOW");
    const reused = invoke(directory, "vercel deploy", { configOptions });
    expectDeniedWithEvent(directory, reused);
  });

  it("Intent drift: intent-boundary escalation is denied and evidenced", () => {
    const directory = missionDir();
    const configOptions = configure(directory, { contract: contract("MODIFY_LOCAL") });
    const result = invoke(directory, "git push origin agent/demo", { configOptions });
    expectDeniedWithEvent(directory, result);
    expect(result.event.reasons.join(" ")).toContain("above mission boundary");
  });

  it("Runtime permission mismatch: production deploy remains explicitly denied", () => {
    const directory = missionDir();
    const configOptions = configure(directory, { contract: contract("DEPLOY_PRODUCTION") });
    const result = invoke(directory, "vercel deploy --prod", { configOptions });
    expectDeniedWithEvent(directory, result);
    expect(result.event.reasons.join(" ")).toContain("explicitly denies");
  });

  it("Capability confusion: unknown state-changing action is denied by default", () => {
    const directory = missionDir();
    const configOptions = configure(directory);
    const result = invoke(directory, "rm -rf generated-output", { configOptions });
    expectDeniedWithEvent(directory, result);
    expect(result.event.semanticAction).toBe("UNKNOWN");
  });

  it("Credential confusion: missing identity fails closed and records denial", () => {
    const directory = missionDir();
    const configOptions = configure(directory, {
      identity: resolvedIdentity({
        githubLogin: {
          status: "UNAVAILABLE",
          source: "gh api user",
          reason: "ambiguous login",
          capturedAt: START,
        },
      }),
    });
    const result = invoke(directory, "git push origin agent/demo", { configOptions });
    expectDeniedWithEvent(directory, result);
    expect(result.event.reasons.join(" ")).toContain("identity is unavailable");
  });

  it("Evidence forgery: tampered mission snapshot fails closed and records denial", () => {
    const directory = missionDir();
    const configOptions = configure(directory);
    const path = join(directory, "mission-snapshot.json");
    const snapshot = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    snapshot.snapshotHash = `sha256:${"f".repeat(64)}`;
    writeFileSync(path, JSON.stringify(snapshot), "utf8");
    const result = invoke(directory, "npm run build", { configOptions });
    expectDeniedWithEvent(directory, result);
    expect(result.event.reasons.join(" ")).toContain("snapshot invalid");
  });

  it("Prompt and instruction injection: malformed hook input fails closed and records denial", () => {
    const directory = missionDir();
    const result = processHookInvocation("{malformed", directory);
    expectDeniedWithEvent(directory, result);
  });

  it("Local data leakage: secret-bearing output is never persisted in the denial event", () => {
    const directory = missionDir();
    const configOptions = configure(directory);
    const secret = "ghp_fixtureSecretThatMustNeverPersist123456";
    const result = invoke(directory, "rm -rf generated-output", {
      configOptions,
      extraPayload: { tool_output: { stdout: secret } },
    });
    expectDeniedWithEvent(directory, result);
    expect(readFileSync(join(directory, "events.jsonl"), "utf8")).not.toContain(secret);
  });

  it("Runtime permission mismatch: applied without observation is flagged from persisted hook evidence", () => {
    const directory = missionDir();
    const configOptions = configure(directory);
    const result = invoke(directory, "npm run build", { configOptions });
    expect(result.event.decision).toBe("ALLOW");
    expect(storedLines(directory)).toContainEqual(result.event);
    const quads = assemblePermissionQuads(
      contract(),
      [],
      [],
      [result.event as HookDecisionEvent],
      [],
      "WORKTREE:fixture",
    );
    expect(quads).toEqual([
      expect.objectContaining({ applied: true, observed: false, mismatch: true }),
    ]);
  });
});
