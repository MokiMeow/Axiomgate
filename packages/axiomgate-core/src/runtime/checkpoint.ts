import { z } from "zod";

import type { ParsedCodexStream } from "./codex-jsonl.js";
import type { CodexRunPlan } from "./codex-plan.js";

const CommandStatusSchema = z.enum([
  "SUCCESS",
  "FAILED",
  "UNAVAILABLE",
  "TIMED_OUT",
]);

export const MissionCheckpointSchema = z.strictObject({
  missionId: z.string().min(1),
  sessionId: z.string().min(1).nullable(),
  reason: z.enum([
    "RATE_LIMIT",
    "INTERRUPTED",
    "TIMEOUT",
    "TRUNCATED_STREAM",
  ]),
  lastEvent: z.record(z.string(), z.unknown()).nullable(),
  model: z.string().min(1),
  effort: z.enum(["low", "medium", "high"]),
  capturedAt: z.iso.datetime({ offset: true }),
});

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
  let reason: MissionCheckpoint["reason"] | undefined;
  if (input.commandStatus === "TIMED_OUT") {
    reason = "TIMEOUT";
  } else if (input.parsed.truncated) {
    reason = "TRUNCATED_STREAM";
  } else if (/rate[ -]?limit|too many requests|quota/iu.test(input.stderr)) {
    reason = "RATE_LIMIT";
  } else if (/interrupt|cancel|terminated/iu.test(input.stderr)) {
    reason = "INTERRUPTED";
  }
  if (reason === undefined) {
    return undefined;
  }

  return MissionCheckpointSchema.parse({
    missionId: input.missionId,
    sessionId: input.parsed.sessionId ?? null,
    reason,
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
