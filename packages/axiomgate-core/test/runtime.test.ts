import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildCodexRunPlan,
  buildCodexResumePlan,
  compileMission,
  checkpointFromRun,
  createMission,
  generateHookConfig,
  missionDirectory,
  parseCodexJsonl,
  resumeMission,
  runMission,
  runStreamingCommand,
  type IdentityReport,
} from "../src/index.js";

function runtimeIdentity(capturedAt: string): IdentityReport {
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
      value: [
        {
          name: "origin",
          url: "https://github.com/MokiMeow/AxiomGate.git",
          direction: "fetch",
        },
      ],
      source: "git remote -v",
      confidence: "HIGH",
      capturedAt,
    },
    vercelUser: {
      status: "UNAVAILABLE",
      source: "vercel whoami",
      reason: "not needed for fixture",
      capturedAt,
    },
    vercelProject: {
      status: "UNAVAILABLE",
      source: ".vercel/project.json",
      reason: "not needed for fixture",
      capturedAt,
    },
  };
}

describe("buildCodexRunPlan", () => {
  it("constructs a governed build invocation from the contract", () => {
    const contract = compileMission(
      {
        objective: "Add hello.txt",
        boundary: "MODIFY_LOCAL",
      },
      { id: "msn_runtime" },
    ).contract;
    const hookConfigOptions = {
      cliEntryPath: "C:/Program Files/AxiomGate/cli.js",
      nodePath: process.execPath,
    };
    const plan = buildCodexRunPlan({
      contract,
      missionDir: "C:/work project/.axiomgate/missions/msn_runtime",
      projectPath: "C:/work project",
      prompt: "Create hello.txt",
      isGitRepository: false,
      hookConfigOptions,
    });
    const hook = generateHookConfig(plan.missionDir, hookConfigOptions);

    expect(plan).toMatchObject({
      model: "gpt-5.6-sol",
      effort: "high",
      sandbox: "workspace-write",
      networkAccess: false,
      stdin: "Create hello.txt",
      configHash: hook.configHash,
    });
    expect(plan.args).toEqual([
      "exec",
      "--json",
      "--model",
      "gpt-5.6-sol",
      "-c",
      'model_reasoning_effort="high"',
      "--sandbox",
      "workspace-write",
      "-c",
      "sandbox_workspace_write.network_access=false",
      "--dangerously-bypass-hook-trust",
      "--cd",
      plan.projectPath,
      "--skip-git-repo-check",
      ...hook.codexArgs,
      "-",
    ]);
  });

  it("uses explicit model and effort while enabling network at PUBLISH", () => {
    const contract = compileMission(
      { objective: "Open a pull request", boundary: "PUBLISH" },
      { id: "msn_publish" },
    ).contract;
    const plan = buildCodexRunPlan({
      contract,
      missionDir: "C:/repo/.axiomgate/missions/msn_publish",
      projectPath: "C:/repo",
      prompt: "Prepare the change",
      model: "gpt-5.6-luna",
      effort: "low",
      isGitRepository: true,
      hookConfigOptions: {
        cliEntryPath: "C:/axiomgate/cli.js",
        nodePath: process.execPath,
      },
    });

    expect(plan).toMatchObject({
      model: "gpt-5.6-luna",
      effort: "low",
      sandbox: "workspace-write",
      networkAccess: true,
    });
    expect(plan.args).toContain("sandbox_workspace_write.network_access=true");
    expect(plan.args).not.toContain("--skip-git-repo-check");
  });
});

describe("parseCodexJsonl", () => {
  it("captures the real session, items, command executions, errors, and raw usage", () => {
    const stream = readFileSync(
      join(import.meta.dirname, "fixtures", "codex-exec-real.jsonl"),
      "utf8",
    );
    const parsed = parseCodexJsonl(stream);

    expect(parsed.sessionId).toBe(
      "019f664d-a2fe-78b3-bc23-2ea84b977298",
    );
    expect(parsed.items).toHaveLength(5);
    expect(parsed.commandExecutions).toHaveLength(2);
    expect(parsed.errors).toEqual([
      "`--dangerously-bypass-hook-trust` is enabled. Enabled hooks may run without review for this invocation.",
    ]);
    expect(parsed.usages).toEqual([
      {
        input_tokens: 35997,
        cached_input_tokens: 26112,
        output_tokens: 151,
        reasoning_output_tokens: 49,
      },
    ]);
    expect(parsed.truncated).toBe(false);
  });

  it("marks a truncated stream and preserves its last complete event", () => {
    const parsed = parseCodexJsonl(
      '{"type":"thread.started","thread_id":"session_partial"}\n{"type":"turn.completed"',
    );

    expect(parsed).toMatchObject({
      sessionId: "session_partial",
      truncated: true,
      lastEvent: {
        type: "thread.started",
        thread_id: "session_partial",
      },
    });

    expect(
      checkpointFromRun({
        missionId: "msn_partial",
        parsed,
        commandStatus: "FAILED",
        stderr: "stream ended unexpectedly",
        model: "gpt-5.6-sol",
        effort: "high",
        now: () => new Date("2026-07-15T18:00:00.000Z"),
      }),
    ).toEqual({
      missionId: "msn_partial",
      sessionId: "session_partial",
      reason: "TRUNCATED_STREAM",
      lastEvent: {
        type: "thread.started",
        thread_id: "session_partial",
      },
      model: "gpt-5.6-sol",
      effort: "high",
      capturedAt: "2026-07-15T18:00:00.000Z",
    });
  });
});

describe("buildCodexResumePlan", () => {
  it("resumes the checkpoint session with the same governance arguments", () => {
    const contract = compileMission(
      { objective: "Add hello.txt", boundary: "MODIFY_LOCAL" },
      { id: "msn_resume" },
    ).contract;
    const runPlan = buildCodexRunPlan({
      contract,
      missionDir: "C:/repo/.axiomgate/missions/msn_resume",
      projectPath: "C:/repo",
      prompt: "Initial prompt",
      isGitRepository: true,
      hookConfigOptions: {
        cliEntryPath: "C:/axiomgate/cli.js",
        nodePath: process.execPath,
      },
    });
    const resume = buildCodexResumePlan({
      runPlan,
      checkpoint: {
        missionId: "msn_resume",
        sessionId: "019f-resume-session",
        reason: "TIMEOUT",
        lastEvent: { type: "turn.started" },
        model: "gpt-5.6-sol",
        effort: "high",
        capturedAt: "2026-07-15T18:00:00.000Z",
      },
      prompt: "Continue from the checkpoint",
    });

    expect(resume.stdin).toBe("Continue from the checkpoint");
    expect(resume.args.slice(-3)).toEqual([
      "resume",
      "019f-resume-session",
      "-",
    ]);
    expect(resume.args.slice(0, -3)).toEqual(runPlan.args.slice(0, -1));
    expect(resume.configHash).toBe(runPlan.configHash);
  });
});

describe("runStreamingCommand", () => {
  it("captures stdin and emits complete stdout lines under a hard timeout", async () => {
    const lines: string[] = [];
    const result = await runStreamingCommand(
      process.execPath,
      [
        "-e",
        "process.stdin.setEncoding('utf8');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{console.log(JSON.stringify({input:s}));console.log('second-line')})",
      ],
      {
        input: "hello-stream",
        timeoutMs: 5_000,
        onStdoutLine: (line) => lines.push(line),
      },
    );

    expect(result.status).toBe("SUCCESS");
    expect(lines).toEqual([
      '{"input":"hello-stream"}',
      "second-line",
    ]);
  });
});

describe("runMission", () => {
  it("persists the primary session, token actuals, run hash, and command evidence", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-runtime-"));
    try {
      const hookConfigOptions = {
        cliEntryPath: join(projectPath, "axiomgate cli", "index.js"),
        nodePath: process.execPath,
      };
      createMission(
        projectPath,
        { objective: "Add hello.txt", boundary: "MODIFY_LOCAL" },
        {
          id: "msn_run",
          hookConfigOptions,
          resolveIdentity: () =>
            runtimeIdentity("2026-07-15T18:00:00.000Z"),
        },
      );
      const stream = readFileSync(
        join(import.meta.dirname, "fixtures", "codex-exec-real.jsonl"),
        "utf8",
      );
      const seenLines: string[] = [];
      const result = await runMission(projectPath, "msn_run", {
        prompt: "Create hello.txt",
        runId: "run_fixture",
        timeoutMs: 5_000,
        hookConfigOptions,
        resolveIdentity: () =>
          runtimeIdentity("2026-07-15T18:01:00.000Z"),
        isGitRepository: true,
        codexLaunch: { command: process.execPath, argsPrefix: ["codex.js"] },
        runner: async (command, args, options) => {
          expect(command).toBe(process.execPath);
          expect(args[0]).toBe("codex.js");
          expect(options?.input).toBe("Create hello.txt");
          for (const line of stream.trim().split(/\r?\n/u)) {
            options?.onStdoutLine?.(line);
            seenLines.push(line);
          }
          return {
            command,
            args,
            status: "SUCCESS",
            exitCode: 0,
            stdout: stream,
            stderr: "",
            durationMs: 25,
          };
        },
        now: () => new Date("2026-07-15T18:02:00.000Z"),
        currentCommit: () => "abc123",
      });
      const directory = missionDirectory(projectPath, "msn_run");

      expect(seenLines.length).toBeGreaterThan(0);
      expect(result.record).toMatchObject({
        id: "run_fixture",
        missionId: "msn_run",
        sessionId: "019f664d-a2fe-78b3-bc23-2ea84b977298",
        model: "gpt-5.6-sol",
        effort: "high",
        sandbox: "workspace-write",
        networkAccess: false,
        exitCode: 0,
        status: "SUCCESS",
      });
      expect(result.record.hash).toBeDefined();
      expect(
        JSON.parse(readFileSync(join(directory, "sessions.json"), "utf8")),
      ).toEqual(["019f664d-a2fe-78b3-bc23-2ea84b977298"]);
      const ledger = JSON.parse(
        readFileSync(join(directory, "ledger.jsonl"), "utf8").trim(),
      ) as Record<string, unknown>;
      expect(ledger.usage).toEqual({
        input_tokens: 35997,
        cached_input_tokens: 26112,
        output_tokens: 151,
        reasoning_output_tokens: 49,
      });
      expect(
        readFileSync(join(directory, "runs", "run_fixture.jsonl"), "utf8"),
      ).toBe(stream);
      const evidence = JSON.parse(
        readFileSync(join(directory, "events.jsonl"), "utf8").trim(),
      ) as Record<string, unknown>;
      expect(evidence).toMatchObject({
        missionId: "msn_run",
        source: "command",
        exitCode: 0,
        freshForCommit: "abc123",
        label: "LIVE",
        redacted: true,
      });
      expect(evidence.outputRef).toContain(result.record.hash);
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it("resumes the checkpoint session through the governed runtime", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-resume-"));
    try {
      const hookConfigOptions = {
        cliEntryPath: join(projectPath, "cli", "index.js"),
        nodePath: process.execPath,
      };
      createMission(
        projectPath,
        { objective: "Add hello.txt", boundary: "MODIFY_LOCAL" },
        {
          id: "msn_resume_runtime",
          hookConfigOptions,
          resolveIdentity: () =>
            runtimeIdentity("2026-07-15T18:00:00.000Z"),
        },
      );
      const directory = missionDirectory(projectPath, "msn_resume_runtime");
      writeFileSync(
        join(directory, "checkpoint.json"),
        JSON.stringify({
          missionId: "msn_resume_runtime",
          sessionId: "019f-resume-live",
          reason: "TIMEOUT",
          lastEvent: { type: "turn.started" },
          model: "gpt-5.6-sol",
          effort: "high",
          capturedAt: "2026-07-15T18:00:00.000Z",
        }),
        "utf8",
      );
      const stream = readFileSync(
        join(import.meta.dirname, "fixtures", "codex-exec-real.jsonl"),
        "utf8",
      ).replace(
        "019f664d-a2fe-78b3-bc23-2ea84b977298",
        "019f-resume-live",
      );
      let invokedArgs: readonly string[] = [];
      const result = await resumeMission(projectPath, "msn_resume_runtime", {
        prompt: "Continue safely",
        runId: "run_resumed",
        hookConfigOptions,
        resolveIdentity: () =>
          runtimeIdentity("2026-07-15T18:01:00.000Z"),
        isGitRepository: true,
        codexLaunch: { command: process.execPath, argsPrefix: ["codex.js"] },
        runner: async (command, args) => {
          invokedArgs = args;
          return {
            command,
            args,
            status: "SUCCESS",
            exitCode: 0,
            stdout: stream,
            stderr: "",
            durationMs: 10,
          };
        },
        currentCommit: () => "abc123",
      });

      expect(invokedArgs.slice(-3)).toEqual([
        "resume",
        "019f-resume-live",
        "-",
      ]);
      expect(result.record.id).toBe("run_resumed");
      expect(result.record.sessionId).toBe("019f-resume-live");
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it("refuses a stale identity snapshot before spawning Codex", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-identity-"));
    try {
      const hookConfigOptions = {
        cliEntryPath: join(projectPath, "cli", "index.js"),
        nodePath: process.execPath,
      };
      createMission(
        projectPath,
        { objective: "Add hello.txt" },
        {
          id: "msn_identity",
          hookConfigOptions,
          resolveIdentity: () =>
            runtimeIdentity("2026-07-15T18:00:00.000Z"),
        },
      );
      let spawned = false;
      const changedIdentity = runtimeIdentity("2026-07-15T18:01:00.000Z");
      await expect(
        runMission(projectPath, "msn_identity", {
          prompt: "Create hello.txt",
          hookConfigOptions,
          resolveIdentity: () => ({
            ...changedIdentity,
            githubLogin: {
              ...changedIdentity.githubLogin,
              value: "AnotherUser",
            },
          }),
          runner: async () => {
            spawned = true;
            throw new Error("runner should not be called");
          },
        }),
      ).rejects.toThrow(
        "Identity differs from the mission snapshot. Next step: axiomgate mission update msn_identity",
      );
      expect(spawned).toBe(false);
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });
});
