import { z } from "zod";

const ReserveInputSchema = z.strictObject({
  builderTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  reservePercent: z.number().int().min(0).max(100),
  hasVerificationRun: z.boolean(),
});

export interface VerificationReserveResult {
  readonly status: "OK" | "WARNING";
  readonly builderTokens: number;
  readonly totalTokens: number;
  readonly thresholdTokens: number;
  readonly thresholdPercent: number;
  readonly warning?: string;
}

const RealCapacityReserveInputSchema = z.strictObject({
  usedPercent: z.number().min(0).max(100),
  projectedBuildPercent: z.number().min(0).max(100).optional(),
  reservePercent: z.number().int().min(0).max(100),
  hasVerificationRun: z.boolean(),
});

export interface RealCapacityReserveResult {
  readonly status: "OK" | "WARNING";
  readonly usedPercent: number;
  readonly projectedBuildPercent: number | null;
  readonly projectedUsedPercent: number;
  readonly thresholdPercent: number;
  readonly remainingPercent: number;
  readonly warning?: string;
}

export function evaluateRealCapacityReserve(
  input: z.infer<typeof RealCapacityReserveInputSchema>,
): RealCapacityReserveResult {
  const parsed = RealCapacityReserveInputSchema.parse(input);
  const thresholdPercent = 100 - parsed.reservePercent;
  const projectedUsedPercent =
    parsed.usedPercent + (parsed.projectedBuildPercent ?? 0);
  const breached =
    !parsed.hasVerificationRun && projectedUsedPercent > thresholdPercent;
  return {
    status: breached ? "WARNING" : "OK",
    usedPercent: parsed.usedPercent,
    projectedBuildPercent: parsed.projectedBuildPercent ?? null,
    projectedUsedPercent,
    thresholdPercent,
    remainingPercent: Math.max(0, 100 - parsed.usedPercent),
    ...(breached
      ? {
          warning:
            `WARNING: real weekly capacity reserve would be breached: ${parsed.usedPercent}% used` +
            (parsed.projectedBuildPercent === undefined
              ? " (projected build spend UNKNOWN)"
              : ` + ${parsed.projectedBuildPercent}% projected build spend = ${projectedUsedPercent}%`) +
            ` ` +
            `(maximum before ${parsed.reservePercent}% verification reserve: ${thresholdPercent}%; codex-app-server/high).`,
        }
      : {}),
  };
}

export function evaluateVerificationReserve(
  input: z.infer<typeof ReserveInputSchema>,
): VerificationReserveResult {
  const parsed = ReserveInputSchema.parse(input);
  if (parsed.builderTokens > parsed.totalTokens) {
    throw new Error("builder tokens cannot exceed total observed tokens");
  }
  const thresholdPercent = 100 - parsed.reservePercent;
  const thresholdTokens = (parsed.totalTokens * thresholdPercent) / 100;
  const breached =
    parsed.totalTokens > 0 &&
    !parsed.hasVerificationRun &&
    parsed.builderTokens > thresholdTokens;
  return {
    status: breached ? "WARNING" : "OK",
    builderTokens: parsed.builderTokens,
    totalTokens: parsed.totalTokens,
    thresholdTokens,
    thresholdPercent,
    ...(breached
      ? {
          warning:
            `WARNING: verification reserve is breached: builder used ${parsed.builderTokens}/${parsed.totalTokens} observed tokens ` +
            `(threshold ${thresholdPercent}% = ${thresholdTokens}); run axiomgate mission review before more builder work.`,
        }
      : {}),
  };
}
