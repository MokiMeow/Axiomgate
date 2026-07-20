import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createMissionSnapshot,
  generateHookConfig,
  hashContract,
  processHookInvocation,
  writeMissionSnapshot,
  type IdentityReport,
  type MissionContract,
} from "../src/index.js";

const directories: string[] = [];
const CAPTURED_AT = "2026-07-20T03:00:00.000Z";

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture() {
  const workspace = mkdtempSync(join(tmpdir(), "axiomgate-authority-"));
  directories.push(workspace);
  const missionDir = join(workspace, ".axiomgate", "missions", "msn_authority");
  mkdirSync(missionDir, { recursive: true });

  const base = {
    id: "msn_authority",
    version: 1,
    hash: `sha256:${"0".repeat(64)}`,
    objective: "Keep governed mission state outside model authority",
    projectProfileId: "prj_authority",
    intentBoundary: "MODIFY_LOCAL",
    acceptanceCriteria: [],
    constraints: [],
    nonGoals: [],
    actionPolicy: [
      { action: "repository.read", decision: "ALLOW" },
      { action: "file.modify", decision: "ALLOW" },
      { action: "verification.run", decision: "ALLOW" },
      { action: "pull_request.create", decision: "DENY" },
      { action: "preview.deploy", decision: "REQUIRE_APPROVAL" },
      { action: "production.deploy", decision: "DENY" },
    ],
    modelPlan: [],
    status: "ACTIVE",
    createdAt: CAPTURED_AT,
    updatedAt: CAPTURED_AT,
  } as const;
  const contract: MissionContract = { ...base, hash: hashContract(base) };
  const identity: IdentityReport = {
    githubLogin: {
      status: "RESOLVED",
      value: "mokimeow",
      source: "gh api user",
      confidence: "HIGH",
      capturedAt: CAPTURED_AT,
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
      capturedAt: CAPTURED_AT,
    },
    vercelUser: {
      status: "UNAVAILABLE",
      source: "vercel whoami",
      reason: "not required",
      capturedAt: CAPTURED_AT,
    },
    vercelProject: {
      status: "UNAVAILABLE",
      source: ".vercel/project.json",
      reason: "not required",
      capturedAt: CAPTURED_AT,
    },
  };
  const configOptions = {
    cliEntryPath: join(workspace, "apps", "cli", "dist", "index.js"),
    nodePath: process.execPath,
  };
  const config = generateHookConfig(missionDir, configOptions);
  writeMissionSnapshot(
    missionDir,
    createMissionSnapshot({
      contract,
      policy: contract.actionPolicy,
      identity,
      hookConfigHash: config.configHash,
    }),
  );
  return { workspace, missionDir, configOptions };
}

function invoke(
  setup: ReturnType<typeof fixture>,
  toolName: string,
  toolInput: Record<string, unknown>,
  cwd = setup.workspace,
) {
  return processHookInvocation(
    JSON.stringify({
      session_id: "session_authority",
      hook_event_name: "PreToolUse",
      tool_name: toolName,
      tool_input: toolInput,
      tool_use_id: `tool_${Date.now()}`,
      cwd,
    }),
    setup.missionDir,
    { configOptions: setup.configOptions },
  );
}

function expectDeniedAndRecorded(
  setup: ReturnType<typeof fixture>,
  result: ReturnType<typeof processHookInvocation>,
) {
  expect(result.output.hookSpecificOutput?.permissionDecision).toBe("deny");
  expect(result.event.decision).toBe("DENY");
  expect(readFileSync(join(setup.missionDir, "events.jsonl"), "utf8")).toContain(
    result.event.id,
  );
}

describe("governed-state authority hardening", () => {
  it("denies apply_patch targeting a mission snapshot before policy evaluation", () => {
    const setup = fixture();
    const result = invoke(setup, "apply_patch", {
      patch: [
        "*** Begin Patch",
        "*** Update File: .axiomgate/missions/msn_authority/mission-snapshot.json",
        "@@",
        "-\"intentBoundary\":\"MODIFY_LOCAL\"",
        "+\"intentBoundary\":\"PUBLISH\"",
        "*** End Patch",
      ].join("\n"),
    });

    expectDeniedAndRecorded(setup, result);
    expect(result.event.reasons.join(" ")).toContain("governed AxiomGate state");
  });

  it("denies the live Codex apply_patch command-field payload shape", () => {
    const setup = fixture();
    const result = invoke(setup, "apply_patch", {
      command: "*** Begin Patch\n*** Add File: .axiomgate/probe.txt\n+changed\n*** End Patch",
    });

    expectDeniedAndRecorded(setup, result);
    expect(result.event.reasons.join(" ")).toContain("governed AxiomGate state");
  });

  it.each([
    "echo changed > .axiomgate/probe",
    "echo changed>.axiomgate/probe",
    "echo changed >> .axiomgate/probe",
    "echo changed | tee .axiomgate/probe",
    "cp safe.txt .axiomgate/probe",
    "mv safe.txt .axiomgate/probe",
    "rm .axiomgate/probe",
    "sed -i 's/a/b/' .axiomgate/probe",
    "node -e \"require('node:fs').writeFileSync('.axiomgate/probe','changed')\"",
    "python -c \"open('.axiomgate/probe','w').write('changed')\"",
  ])("denies shell governed-state mutation: %s", (command) => {
    const setup = fixture();
    expectDeniedAndRecorded(setup, invoke(setup, "Bash", { command }));
  });

  it("denies traversal, absolute, and mixed-case governed-state targets", () => {
    const setup = fixture();
    const nested = join(setup.workspace, "src");
    mkdirSync(nested);
    const commands = [
      "echo changed > ../.axiomgate/probe",
      `Set-Content -LiteralPath '${join(setup.workspace, ".axiomgate", "probe")}' -Value changed`,
      "echo changed > .AxIoMgAtE/probe",
    ];

    for (const command of commands) {
      expectDeniedAndRecorded(
        setup,
        invoke(setup, "Bash", { command }, command.includes("../") ? nested : setup.workspace),
      );
    }
  });

  it("denies an MCP file-write mechanism targeting governed state", () => {
    const setup = fixture();
    const result = invoke(setup, "mcp__filesystem__write_file", {
      path: join(setup.workspace, ".axiomgate", "probe"),
      content: "changed",
    });
    expectDeniedAndRecorded(setup, result);
    expect(result.event.reasons.join(" ")).toContain("governed AxiomGate state");
  });

  it("still allows apply_patch for an ordinary workspace file", () => {
    const setup = fixture();
    const result = invoke(setup, "apply_patch", {
      patch: "*** Begin Patch\n*** Add File: src/app.ts\n+export {};\n*** End Patch",
    });
    expect(result.output.hookSpecificOutput?.permissionDecision).toBe("allow");
    expect(result.event.semanticAction).toBe("file.modify");
  });

  it("denies unknown shell commands instead of treating them as reads", () => {
    const setup = fixture();
    const result = invoke(setup, "Bash", {
      command: "node -e \"console.log('not a classified read')\"",
    });
    expectDeniedAndRecorded(setup, result);
    expect(result.event.semanticAction).toBe("UNKNOWN");
  });

  it.each([
    "ls",
    "cat README.md",
    "git status --short --branch",
    "git diff --stat",
    "rg -n TODO src",
    "Get-Content README.md",
  ])("allows a demonstrably read-only shell command: %s", (command) => {
    const setup = fixture();
    const result = invoke(setup, "Bash", { command });
    expect(result.output.hookSpecificOutput?.permissionDecision).toBe("allow");
    expect(result.event).toMatchObject({
      semanticAction: "repository.read",
      decision: "ALLOW",
    });
  });

  it("keeps the baseline publish denial after the attempted tamper is blocked", () => {
    const setup = fixture();
    const tamper = invoke(setup, "Bash", {
      command: "node -e \"require('node:fs').writeFileSync('.axiomgate/missions/msn_authority/mission-snapshot.json','changed')\"",
    });
    expectDeniedAndRecorded(setup, tamper);

    const publish = invoke(setup, "Bash", {
      command: "git push origin agent/security-probe",
    });
    expectDeniedAndRecorded(setup, publish);
    expect(publish.event.reasons.join(" ")).toContain("above mission boundary");
  });
});
