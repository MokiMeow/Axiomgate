import { z } from "zod";

export const INTENT_BOUNDARIES = [
  "OBSERVE",
  "PLAN",
  "MODIFY_LOCAL",
  "PUBLISH",
  "DEPLOY_PREVIEW",
  "DEPLOY_PRODUCTION",
] as const;

export const IntentBoundarySchema = z.enum(INTENT_BOUNDARIES);

export type IntentBoundary = z.infer<typeof IntentBoundarySchema>;

const intentBoundaryRanks = new Map<IntentBoundary, number>(
  INTENT_BOUNDARIES.map((boundary, index) => [boundary, index]),
);

export function compareIntentBoundaries(
  left: IntentBoundary,
  right: IntentBoundary,
): -1 | 0 | 1 {
  const difference =
    (intentBoundaryRanks.get(left) ?? -1) -
    (intentBoundaryRanks.get(right) ?? -1);

  return difference === 0 ? 0 : difference < 0 ? -1 : 1;
}
