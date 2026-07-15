import { z } from "zod";

export const RunProgressEventSchema = z.strictObject({
  runId: z.string().min(1),
  commandFailures: z.array(
    z.strictObject({
      command: z.string().min(1),
      error: z.string().min(1),
    }),
  ),
  fileChanges: z.number().int().nonnegative(),
  newEvidence: z.number().int().nonnegative(),
});

export type RunProgressEvent = z.infer<typeof RunProgressEventSchema>;

export const LoopRecommendationSchema = z.strictObject({
  signal: z.enum(["repeated_failure", "no_progress"]),
  evidence: z.array(z.string().min(1)),
  recommendation: z.enum([
    "pause and diagnose",
    "split task",
    "escalate model",
  ]),
});

export type LoopRecommendation = z.infer<typeof LoopRecommendationSchema>;

function signature(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function detectLoopRecommendation(
  events: readonly RunProgressEvent[],
): LoopRecommendation | undefined {
  const parsed = z.array(RunProgressEventSchema).parse(events);
  const failures = new Map<
    string,
    { command: string; error: string; occurrences: number }
  >();
  for (const event of parsed) {
    for (const failure of event.commandFailures) {
      const command = signature(failure.command);
      const error = signature(failure.error);
      const key = `${command}\u0000${error}`;
      const existing = failures.get(key);
      const occurrences = (existing?.occurrences ?? 0) + 1;
      failures.set(key, { command, error, occurrences });
      if (occurrences >= 3) {
        return {
          signal: "repeated_failure",
          evidence: [
            `command=${command}`,
            `error=${error}`,
            `occurrences=${occurrences}`,
          ],
          recommendation: "pause and diagnose",
        };
      }
    }
  }

  const lastThree = parsed.slice(-3);
  if (
    lastThree.length === 3 &&
    lastThree.every(
      (event) => event.fileChanges === 0 && event.newEvidence === 0,
    )
  ) {
    return {
      signal: "no_progress",
      evidence: ["consecutiveRuns=3", "fileChanges=0", "newEvidence=0"],
      recommendation: "split task",
    };
  }
  return undefined;
}
