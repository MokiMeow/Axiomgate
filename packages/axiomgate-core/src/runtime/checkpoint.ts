import { z } from "zod";

import type { ParsedCodexStream } from "./codex-jsonl.js";
import type { CodexRunPlan } from "./codex-plan.js";

const CommandStatusSchema = z.enum([
  "SUCCESS",
  "FAILED",
  "UNAVAILABLE",
  "TIMED_OUT",
]);

const MissionCheckpointValueSchema = z.strictObject({
  missionId: z.string().min(1),
  sessionId: z.string().min(1).nullable(),
  reason: z.enum([
    "rate_limit",
    "interrupted",
    "timeout",
    "truncated_stream",
  ]),
  resetAt: z.iso.datetime({ offset: true }).nullable(),
  lastEvent: z.record(z.string(), z.unknown()).nullable(),
  model: z.string().min(1),
  effort: z.enum(["low", "medium", "high"]),
  capturedAt: z.iso.datetime({ offset: true }),
});

const LEGACY_REASONS: Record<string, z.infer<typeof MissionCheckpointValueSchema>["reason"]> = {
  RATE_LIMIT: "rate_limit",
  INTERRUPTED: "interrupted",
  TIMEOUT: "timeout",
  TRUNCATED_STREAM: "truncated_stream",
};

export const MissionCheckpointSchema = z.preprocess((value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  return {
    ...record,
    reason:
      typeof record.reason === "string"
        ? (LEGACY_REASONS[record.reason] ?? record.reason)
        : record.reason,
    resetAt: record.resetAt ?? null,
  };
}, MissionCheckpointValueSchema);

export type MissionCheckpoint = z.infer<typeof MissionCheckpointSchema>;

export interface CheckpointFromRunInput {
  readonly missionId: string;
  readonly parsed: ParsedCodexStream;
  readonly commandStatus: z.infer<typeof CommandStatusSchema>;
  readonly stderr: string;
  readonly model: string;
  readonly effort: "low" | "medium" | "high";
  readonly now?: () => Date;
}

export function checkpointFromRun(
  input: CheckpointFromRunInput,
): MissionCheckpoint | undefined {
  const diagnostic = [input.stderr, ...input.parsed.errors].join("\n");
  const rateLimited =
    /rate[ -]?limit|usage limit|too many requests|quota|limit reached/iu.test(
      diagnostic,
    );
  let reason: MissionCheckpoint["reason"] | undefined;
  if (rateLimited) {
    reason = "rate_limit";
  } else if (input.commandStatus === "TIMED_OUT") {
    reason = "timeout";
  } else if (input.parsed.truncated) {
    reason = "truncated_stream";
  } else if (/interrupt|cancel|terminated/iu.test(diagnostic)) {
    reason = "interrupted";
  }
  if (reason === undefined) {
    return undefined;
  }

  const timestamp = rateLimited
    ? diagnostic.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/u)?.[0]
    : undefined;
  const resetAt =
    timestamp === undefined || Number.isNaN(Date.parse(timestamp))
      ? null
      : new Date(timestamp).toISOString();

  return MissionCheckpointSchema.parse({
    missionId: input.missionId,
    sessionId: input.parsed.sessionId ?? null,
    reason,
    resetAt,
    lastEvent: input.parsed.lastEvent ?? null,
    model: input.model,
    effort: input.effort,
    capturedAt: (input.now ?? (() => new Date()))().toISOString(),
  });
}

export interface BuildCodexResumePlanInput {
  readonly runPlan: CodexRunPlan;
  readonly checkpoint: MissionCheckpoint;
  readonly prompt: string;
}

export function buildCodexResumePlan(
  input: BuildCodexResumePlanInput,
): CodexRunPlan {
  if (input.checkpoint.sessionId === null) {
    throw new Error("checkpoint has no resumable Codex session id");
  }
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    throw new Error("resume prompt must not be empty");
  }
  if (input.runPlan.args.at(-1) !== "-") {
    throw new Error("run plan is not configured for stdin");
  }

  return {
    ...input.runPlan,
    args: [
      ...input.runPlan.args.slice(0, -1),
      "resume",
      input.checkpoint.sessionId,
      "-",
    ],
    stdin: prompt,
  };
}
