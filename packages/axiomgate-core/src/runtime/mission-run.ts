import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { delimiter, join, resolve } from "node:path";

import { z } from "zod";

import { EvidenceSchema, type Evidence } from "../evidence/index.js";
import {
  hashContract,
  Sha256Schema,
  stableStringify,
} from "../mission/index.js";
import {
  resolveIdentity as resolveCurrentIdentity,
  runCommand,
  runStreamingCommand,
  verifyEnforcement,
  type HookConfigOptions,
  type IdentityReport,
  type StreamingCommandRunner,
} from "../guard/index.js";
import {
  checkpointFromRun,
  buildCodexResumePlan,
  MissionCheckpointSchema,
  type MissionCheckpoint,
} from "./checkpoint.js";
import { parseCodexJsonl, type JsonRecord } from "./codex-jsonl.js";
import { buildCodexRunPlan, type CodexRunPlan } from "./codex-plan.js";
import { missionDirectory } from "./mission-files.js";

const DEFAULT_RUN_TIMEOUT_MS = 20 * 60 * 1_000;

export const MissionRunRecordSchema = z.strictObject({
  id: z.string().min(1),
  missionId: z.string().min(1),
  contractHash: Sha256Schema,
  hash: Sha256Schema,
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
  status: z.enum(["SUCCESS", "FAILED", "UNAVAILABLE", "TIMED_OUT"]),
  exitCode: z.number().int(),
  sessionId: z.string().min(1).nullable(),
  model: z.string().min(1),
  effort: z.enum(["low", "medium", "high"]),
  sandbox: z.enum(["read-only", "workspace-write"]),
  networkAccess: z.boolean(),
  configHash: Sha256Schema,
  projectPath: z.string().min(1),
  promptHash: Sha256Schema,
  eventCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  commandExecutionCount: z.number().int().nonnegative(),
  errors: z.array(z.string()),
  rawUsageCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

export type MissionRunRecord = z.infer<typeof MissionRunRecordSchema>;

export interface CodexLaunch {
  readonly command: string;
  readonly argsPrefix: readonly string[];
}

export interface RunMissionOptions {
  readonly prompt: string;
  readonly model?: string;
  readonly effort?: "low" | "medium" | "high";
  readonly timeoutMs?: number;
  readonly runId?: string;
  readonly hookConfigOptions?: HookConfigOptions;
  readonly resolveIdentity?: (projectPath: string) => IdentityReport;
  readonly isGitRepository?: boolean;
  readonly codexLaunch?: CodexLaunch;
  readonly runner?: StreamingCommandRunner;
  readonly now?: () => Date;
  readonly currentCommit?: (projectPath: string) => string;
  readonly onEvent?: (event: JsonRecord) => void;
  readonly onReady?: (plan: CodexRunPlan) => void;
}

export interface MissionRunResult {
  readonly record: MissionRunRecord;
  readonly evidence: Evidence;
  readonly checkpoint: MissionCheckpoint | undefined;
  readonly plan: CodexRunPlan;
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function comparableIdentity(identity: IdentityReport): unknown {
  return Object.fromEntries(
    Object.entries(identity).map(([key, field]) => [
      key,
      field.status === "RESOLVED"
        ? { status: field.status, source: field.source, value: field.value }
        : { status: field.status, source: field.source },
    ]),
  );
}

function identitiesMatch(left: IdentityReport, right: IdentityReport): boolean {
  return (
    stableStringify(comparableIdentity(left)) ===
    stableStringify(comparableIdentity(right))
  );
}

function isGitRepository(projectPath: string): boolean {
  const result = runCommand("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: projectPath,
  });
  return result.status === "SUCCESS" && result.stdout.trim() === "true";
}

function currentCommit(projectPath: string): string {
  const head = runCommand("git", ["rev-parse", "HEAD"], { cwd: projectPath });
  if (head.status !== "SUCCESS") {
    return "WORKTREE";
  }
  const status = runCommand("git", ["status", "--porcelain"], {
    cwd: projectPath,
  });
  return status.status === "SUCCESS" && status.stdout.trim().length === 0
    ? head.stdout.trim()
    : `WORKTREE:${head.stdout.trim()}`;
}

export function resolveCodexLaunch(): CodexLaunch {
  if (process.platform !== "win32") {
    return { command: "codex", argsPrefix: [] };
  }
  const candidates = [
    ...(process.env.APPDATA === undefined
      ? []
      : [
          join(
            process.env.APPDATA,
            "npm",
            "node_modules",
            "@openai",
            "codex",
            "bin",
            "codex.js",
          ),
        ]),
    ...(process.env.PATH ?? "")
      .split(delimiter)
      .filter(Boolean)
      .map((entry) =>
        join(entry, "node_modules", "@openai", "codex", "bin", "codex.js"),
      ),
  ];
  const entry = candidates.find((candidate) => existsSync(candidate));
  return entry === undefined
    ? { command: "codex", argsPrefix: [] }
    : { command: process.execPath, argsPrefix: [entry] };
}

function appendSession(missionDir: string, sessionId: string | undefined): void {
  if (sessionId === undefined) {
    return;
  }
  const path = join(missionDir, "sessions.json");
  const sessions = existsSync(path)
    ? z.array(z.string().min(1)).parse(JSON.parse(readFileSync(path, "utf8")))
    : [];
  if (!sessions.includes(sessionId)) {
    sessions.push(sessionId);
  }
  writeFileSync(path, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
}

function appendLedger(
  missionDir: string,
  runId: string,
  sessionId: string | undefined,
  plan: CodexRunPlan,
  usages: readonly JsonRecord[],
  capturedAt: string,
): void {
  for (const usage of usages) {
    appendFileSync(
      join(missionDir, "ledger.jsonl"),
      `${JSON.stringify({
        runId,
        sessionId: sessionId ?? null,
        model: plan.model,
        effort: plan.effort,
        capturedAt,
        usage,
      })}\n`,
      "utf8",
    );
  }
}

function writeCheckpoint(
  missionDir: string,
  checkpoint: MissionCheckpoint | undefined,
): void {
  const path = join(missionDir, "checkpoint.json");
  if (checkpoint === undefined) {
    rmSync(path, { force: true });
    return;
  }
  writeFileSync(
    path,
    `${JSON.stringify(MissionCheckpointSchema.parse(checkpoint), null, 2)}\n`,
    "utf8",
  );
}

async function runMissionInternal(
  projectPath: string,
  id: string,
  options: RunMissionOptions & {
    readonly resumeCheckpoint?: MissionCheckpoint;
  },
): Promise<MissionRunResult> {
  const resolvedProject = resolve(projectPath);
  const missionDir = missionDirectory(resolvedProject, id);
  const enforcement = verifyEnforcement(
    missionDir,
    options.hookConfigOptions,
  );
  if (enforcement.status === "REFUSED") {
    throw new Error(
      `Enforcement verification failed: ${enforcement.reason}. Next step: axiomgate mission update ${id}`,
    );
  }
  const freshIdentity =
    options.resolveIdentity?.(resolvedProject) ??
    resolveCurrentIdentity({ cwd: resolvedProject });
  if (!identitiesMatch(enforcement.snapshot.identity, freshIdentity)) {
    throw new Error(
      `Identity differs from the mission snapshot. Next step: axiomgate mission update ${id}`,
    );
  }

  const basePlan = buildCodexRunPlan({
    contract: enforcement.snapshot.contract,
    missionDir,
    projectPath: resolvedProject,
    prompt: options.prompt,
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.effort === undefined ? {} : { effort: options.effort }),
    isGitRepository:
      options.isGitRepository ?? isGitRepository(resolvedProject),
    ...(options.hookConfigOptions === undefined
      ? {}
      : { hookConfigOptions: options.hookConfigOptions }),
  });
  const plan =
    options.resumeCheckpoint === undefined
      ? basePlan
      : buildCodexResumePlan({
          runPlan: basePlan,
          checkpoint: options.resumeCheckpoint,
          prompt: options.prompt,
        });
  const launch = options.codexLaunch ?? resolveCodexLaunch();
  const runner = options.runner ?? runStreamingCommand;
  options.onReady?.(plan);
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const commandResult = await runner(
    launch.command,
    [...launch.argsPrefix, ...plan.args],
    {
      cwd: resolvedProject,
      input: plan.stdin,
      timeoutMs: options.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS,
      onStdoutLine: (line) => {
        const parsedLine = parseCodexJsonl(line);
        for (const event of parsedLine.events) {
          options.onEvent?.(event);
        }
      },
    },
  );
  const endedAt = now().toISOString();
  const parsed = parseCodexJsonl(commandResult.stdout);
  const runId =
    options.runId ?? `run_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const runsDir = join(missionDir, "runs");
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(join(runsDir, `${runId}.jsonl`), commandResult.stdout, "utf8");
  if (commandResult.stderr.length > 0) {
    writeFileSync(
      join(runsDir, `${runId}.stderr.log`),
      commandResult.stderr,
      "utf8",
    );
  }

  const recordDraft = {
    id: runId,
    missionId: id,
    contractHash: enforcement.snapshot.contract.hash,
    startedAt,
    endedAt,
    status: commandResult.status,
    exitCode: commandResult.exitCode,
    sessionId: parsed.sessionId ?? null,
    model: plan.model,
    effort: plan.effort,
    sandbox: plan.sandbox,
    networkAccess: plan.networkAccess,
    configHash: plan.configHash,
    projectPath: resolvedProject,
    promptHash: sha256(plan.stdin),
    eventCount: parsed.events.length,
    itemCount: parsed.items.length,
    commandExecutionCount: parsed.commandExecutions.length,
    errors: [...parsed.errors],
    rawUsageCount: parsed.usages.length,
    durationMs: commandResult.durationMs,
  };
  const record = MissionRunRecordSchema.parse({
    ...recordDraft,
    hash: hashContract(recordDraft),
  });
  writeFileSync(
    join(runsDir, `${runId}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  appendSession(missionDir, parsed.sessionId);
  appendLedger(missionDir, runId, parsed.sessionId, plan, parsed.usages, endedAt);

  const checkpoint = checkpointFromRun({
    missionId: id,
    parsed,
    commandStatus: commandResult.status,
    stderr: commandResult.stderr,
    model: plan.model,
    effort: plan.effort,
    now: () => new Date(endedAt),
  });
  writeCheckpoint(missionDir, checkpoint);
  const commit =
    options.currentCommit?.(resolvedProject) ?? currentCommit(resolvedProject);
  const evidence = EvidenceSchema.parse({
    id: `ev_${runId}`,
    missionId: id,
    criterionId:
      enforcement.snapshot.contract.acceptanceCriteria[0]?.id ?? "runtime.run",
    source: "command",
    command: "codex exec --json",
    exitCode: commandResult.exitCode,
    outputHash: sha256(commandResult.stdout),
    outputRef: `runs/${runId}.json#${record.hash}`,
    capturedAt: endedAt,
    freshForCommit: commit,
    label: "LIVE",
    redacted: true,
  });
  appendFileSync(
    join(missionDir, "events.jsonl"),
    `${JSON.stringify(evidence)}\n`,
    "utf8",
  );

  return { record, evidence, checkpoint, plan };
}

export function runMission(
  projectPath: string,
  id: string,
  options: RunMissionOptions,
): Promise<MissionRunResult> {
  return runMissionInternal(projectPath, id, options);
}

export function resumeMission(
  projectPath: string,
  id: string,
  options: RunMissionOptions,
): Promise<MissionRunResult> {
  const missionDir = missionDirectory(projectPath, id);
  const checkpoint = MissionCheckpointSchema.parse(
    JSON.parse(readFileSync(join(missionDir, "checkpoint.json"), "utf8")),
  );
  if (checkpoint.missionId !== id) {
    throw new Error("checkpoint belongs to another mission");
  }
  return runMissionInternal(projectPath, id, {
    ...options,
    model: options.model ?? checkpoint.model,
    effort: options.effort ?? checkpoint.effort,
    resumeCheckpoint: checkpoint,
  });
}
