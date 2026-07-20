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

import {
  EvidenceSchema,
  redactSensitiveText,
  redactSensitiveValue,
  type Evidence,
} from "../evidence/index.js";
import {
  hashContract,
  CodexReasoningEffortSchema,
  PersistedReasoningEffortSchema,
  ReasoningEffortSchema,
  Sha256Schema,
  stableStringify,
  toDisplayReasoningEffort,
  type ReasoningEffort,
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
  detectLoopRecommendation,
  evaluateRealCapacityReserve,
  evaluateVerificationReserve,
  expiringBankedResetReminder,
  expiringResetReminder,
  readLedgerTotals,
  renderRunwayCapacity,
  resolveRunwayCapacity,
  RunProgressEventSchema,
  type CodexRateLimitsResult,
  type LoopRecommendation,
  type RealCapacityReserveResult,
  type RunProgressEvent,
  type RunwayCapacity,
  type VerificationReserveResult,
} from "../runway/index.js";
import {
  checkpointFromRun,
  buildCodexResumePlan,
  MissionCheckpointSchema,
  type MissionCheckpoint,
} from "./checkpoint.js";
import { parseCodexJsonl, type JsonRecord } from "./codex-jsonl.js";
import { buildCodexRunPlan, type CodexRunPlan } from "./codex-plan.js";
import { missionDirectory } from "./mission-files.js";
import { appendMissionSession } from "./session-store.js";

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
  effort: PersistedReasoningEffortSchema,
  wireEffort: CodexReasoningEffortSchema,
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
  readonly effort?: ReasoningEffort;
  readonly timeoutMs?: number;
  readonly runId?: string;
  readonly hookConfigOptions?: HookConfigOptions;
  readonly resolveIdentity?: (projectPath: string) => IdentityReport;
  readonly isGitRepository?: boolean;
  readonly codexLaunch?: CodexLaunch;
  readonly runner?: StreamingCommandRunner;
  readonly readRateLimits?: () => Promise<CodexRateLimitsResult>;
  readonly projectedBuildPercent?: number;
  readonly now?: () => Date;
  readonly currentCommit?: (projectPath: string) => string;
  readonly onEvent?: (event: JsonRecord) => void;
  readonly onReady?: (plan: CodexRunPlan) => void;
  readonly onRunwayStatus?: (status: RunwayRuntimeStatus) => void;
}

export interface RunwayRuntimeStatus {
  readonly capacity: RunwayCapacity;
  readonly capacityLine: string;
  readonly reminder: string | undefined;
  readonly reserve: VerificationReserveResult | RealCapacityReserveResult;
  readonly loopRecommendation: LoopRecommendation | undefined;
}

export interface MissionRunResult {
  readonly record: MissionRunRecord;
  readonly evidence: Evidence;
  readonly checkpoint: MissionCheckpoint | undefined;
  readonly plan: CodexRunPlan;
  readonly runway: RunwayRuntimeStatus;
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

export function identityReportsMatch(
  left: IdentityReport,
  right: IdentityReport,
): boolean {
  return (
    stableStringify(comparableIdentity(left)) ===
    stableStringify(comparableIdentity(right))
  );
}

export function isGitRepository(projectPath: string): boolean {
  const result = runCommand("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: projectPath,
  });
  return result.status === "SUCCESS" && result.stdout.trim() === "true";
}

export function currentCommit(projectPath: string): string {
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

export function appendLedger(
  missionDir: string,
  runId: string,
  sessionId: string | undefined,
  plan: Pick<CodexRunPlan, "model" | "effort">,
  usages: readonly JsonRecord[],
  capturedAt: string,
  role: "builder" | "verifier" = "builder",
): void {
  for (const usage of usages) {
    appendFileSync(
      join(missionDir, "ledger.jsonl"),
      `${JSON.stringify({
        runId,
        sessionId: sessionId ?? null,
        model: plan.model,
        effort: plan.effort,
        role,
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

function runProgressFromParsed(
  runId: string,
  parsed: ReturnType<typeof parseCodexJsonl>,
): RunProgressEvent {
  const completedFileChanges = parsed.items.filter(
    (item) => item.type === "file_change" && item.status === "completed",
  );
  const fileChanges = completedFileChanges.reduce((total, item) => {
    return total + (Array.isArray(item.changes) ? item.changes.length : 1);
  }, 0);
  const commandFailures = parsed.commandExecutions
    .filter(
      (item) =>
        item.status === "failed" ||
        (typeof item.exit_code === "number" && item.exit_code !== 0),
    )
    .flatMap((item) =>
      typeof item.command === "string"
        ? [
            {
              command: item.command,
              error:
                typeof item.aggregated_output === "string" &&
                item.aggregated_output.trim().length > 0
                  ? item.aggregated_output.trim()
                  : `exit ${typeof item.exit_code === "number" ? item.exit_code : "unknown"}`,
            },
          ]
        : [],
    );
  const successfulCommands = parsed.commandExecutions.filter(
    (item) =>
      item.status === "completed" &&
      (item.exit_code === 0 || item.exit_code === undefined),
  ).length;
  return RunProgressEventSchema.parse({
    runId,
    commandFailures,
    fileChanges,
    newEvidence: fileChanges + successfulCommands,
  });
}

function priorRunProgress(missionDir: string): RunProgressEvent[] {
  const path = join(missionDir, "events.jsonl");
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line) as Record<string, unknown>;
        if (value.type !== "run.progress") {
          return [];
        }
        return [RunProgressEventSchema.parse(value.progress)];
      } catch {
        return [];
      }
    });
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
  const now = options.now ?? (() => new Date());
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
  if (!identityReportsMatch(enforcement.snapshot.identity, freshIdentity)) {
    throw new Error(
      `Identity differs from the mission snapshot. Next step: axiomgate mission update ${id}`,
    );
  }

  const capacity = await resolveRunwayCapacity(resolvedProject, {
    ...(options.readRateLimits === undefined
      ? {}
      : { readLive: options.readRateLimits }),
  });
  const totals = readLedgerTotals(missionDir);
  const reservePercent =
    enforcement.snapshot.contract.budgetPolicy?.reservePercent ?? 20;
  const weekly =
    capacity.status === "LIVE"
      ? capacity.sources.find(
          (source) =>
            source.limitId === "codex" && source.windowLabel === "weekly",
        ) ?? capacity.sources.find((source) => source.windowLabel === "weekly")
      : undefined;
  const runwayEventFields = weekly === undefined
    ? {}
    : {
        runwayUsedPercent: weekly.usedPercent,
        runwayRemainingPercent: Math.max(0, 100 - weekly.usedPercent),
        runwayResetsAt: weekly.resetsAt,
        runwayPlanType: weekly.planType,
        bankedResetCount:
          capacity.status === "LIVE" ? capacity.availableResetCount : 0,
        runwaySource: `${weekly.source}/${weekly.confidence}`,
      };
  const reserve =
    weekly === undefined
      ? evaluateVerificationReserve({
          builderTokens: totals.builderTokens,
          totalTokens: totals.totalTokens,
          reservePercent,
          hasVerificationRun: totals.hasVerificationRun,
        })
      : evaluateRealCapacityReserve({
          usedPercent: weekly.usedPercent,
          ...(options.projectedBuildPercent === undefined
            ? {}
            : { projectedBuildPercent: options.projectedBuildPercent }),
          reservePercent,
          hasVerificationRun: totals.hasVerificationRun,
        });
  const initialRunway: RunwayRuntimeStatus = {
    capacity,
    capacityLine: renderRunwayCapacity(capacity),
    reminder:
      capacity.status === "LIVE"
        ? expiringBankedResetReminder(capacity, now())
        : capacity.status === "MANUAL"
          ? expiringResetReminder(capacity.snapshot, now())
          : undefined,
    reserve,
    loopRecommendation: undefined,
  };
  options.onRunwayStatus?.(initialRunway);

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
  const persistedStdout = redactSensitiveText(commandResult.stdout);
  const persistedStderr = redactSensitiveText(commandResult.stderr);
  const parsed = parseCodexJsonl(persistedStdout);
  const runId =
    options.runId ?? `run_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const runsDir = join(missionDir, "runs");
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(join(runsDir, `${runId}.jsonl`), persistedStdout, "utf8");
  if (persistedStderr.length > 0) {
    writeFileSync(
      join(runsDir, `${runId}.stderr.log`),
      persistedStderr,
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
    wireEffort: plan.wireEffort,
    sandbox: plan.sandbox,
    networkAccess: plan.networkAccess,
    configHash: plan.configHash,
    projectPath: resolvedProject,
    promptHash: sha256(plan.stdin),
    eventCount: parsed.events.length,
    itemCount: parsed.items.length,
    commandExecutionCount: parsed.commandExecutions.length,
    errors: parsed.errors.map(redactSensitiveText),
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
  appendMissionSession(missionDir, parsed.sessionId, "builder");
  appendLedger(missionDir, runId, parsed.sessionId, plan, parsed.usages, endedAt);

  const checkpoint = checkpointFromRun({
    missionId: id,
    parsed,
    commandStatus: commandResult.status,
    stderr: persistedStderr,
    model: plan.model,
    effort: plan.effort,
    now: () => new Date(endedAt),
  });
  writeCheckpoint(missionDir, checkpoint);
  const progress = redactSensitiveValue(runProgressFromParsed(runId, parsed));
  const loopRecommendation = detectLoopRecommendation([
    ...priorRunProgress(missionDir),
    progress,
  ]);
  appendFileSync(
    join(missionDir, "events.jsonl"),
    `${JSON.stringify({
      type: "run.progress",
      ts: endedAt,
      missionId: id,
      progress,
    })}\n`,
    "utf8",
  );
  appendFileSync(
    join(missionDir, "events.jsonl"),
    `${JSON.stringify({
      type: "run.finished",
      ts: endedAt,
      missionId: id,
      runId,
      status: record.status,
      model: record.model,
      effort: record.effort,
      inputTokens: typeof parsed.usages.at(-1)?.input_tokens === "number"
        ? parsed.usages.at(-1)!.input_tokens
        : 0,
      outputTokens: typeof parsed.usages.at(-1)?.output_tokens === "number"
        ? parsed.usages.at(-1)!.output_tokens
        : 0,
      ...runwayEventFields,
      message: `Governed run finished with ${record.status}`,
    })}\n`,
    "utf8",
  );
  if (checkpoint !== undefined) {
    appendFileSync(
      join(missionDir, "events.jsonl"),
      `${JSON.stringify({
        type: "run.checkpoint",
        ts: endedAt,
        missionId: id,
        runId,
        reason: checkpoint.reason,
        resetAt: checkpoint.resetAt ?? null,
        message: checkpoint.reason === "rate_limit"
          ? `Rate limit reached; reset ${checkpoint.resetAt ?? "UNKNOWN"}`
          : `Run checkpointed: ${checkpoint.reason}`,
      })}\n`,
      "utf8",
    );
  }
  if (weekly !== undefined) {
    appendFileSync(
      join(missionDir, "events.jsonl"),
      `${JSON.stringify({
        type: "runway.usage",
        ts: endedAt,
        missionId: id,
        usedPercent: weekly.usedPercent,
        remainingPercent: Math.max(0, 100 - weekly.usedPercent),
        resetsAt: weekly.resetsAt,
        planType: weekly.planType,
        bankedResetCount:
          capacity.status === "LIVE" ? capacity.availableResetCount : 0,
        sourceLabel: `${weekly.source}/${weekly.confidence}`,
        message: `Weekly Codex usage is ${weekly.usedPercent}%`,
      })}\n`,
      "utf8",
    );
  }
  if (reserve.warning !== undefined) {
    appendFileSync(
      join(missionDir, "events.jsonl"),
      `${JSON.stringify({ type: "runway.reserve.warning", ts: endedAt, missionId: id, message: reserve.warning })}\n`,
      "utf8",
    );
  }
  if (initialRunway.reminder !== undefined) {
    appendFileSync(
      join(missionDir, "events.jsonl"),
      `${JSON.stringify({
        type: "runway.banked_reset.expiring",
        ts: endedAt,
        missionId: id,
        bankedResetCount:
          capacity.status === "LIVE"
            ? capacity.availableResetCount
            : capacity.status === "MANUAL"
              ? capacity.snapshot.resetsAvailable?.value
              : undefined,
        message: initialRunway.reminder,
      })}\n`,
      "utf8",
    );
  }
  if (loopRecommendation !== undefined) {
    appendFileSync(
      join(missionDir, "events.jsonl"),
      `${JSON.stringify({
        type: "runway.recommendation",
        ts: endedAt,
        missionId: id,
        runId,
        ...loopRecommendation,
      })}\n`,
      "utf8",
    );
  }
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
    outputHash: sha256(persistedStdout),
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

  return {
    record,
    evidence,
    checkpoint,
    plan,
    runway: { ...initialRunway, loopRecommendation },
  };
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
    effort:
      options.effort ?? toDisplayReasoningEffort(checkpoint.effort),
    resumeCheckpoint: checkpoint,
  });
}
