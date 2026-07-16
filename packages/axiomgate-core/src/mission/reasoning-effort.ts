import { z } from "zod";

export const ReasoningEffortSchema = z.enum([
  "light",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

export const LegacyReasoningEffortSchema = z.enum(["none", "minimal", "low"]);
export const PersistedReasoningEffortSchema = z.union([
  ReasoningEffortSchema,
  LegacyReasoningEffortSchema,
]);
export type PersistedReasoningEffort = z.infer<
  typeof PersistedReasoningEffortSchema
>;

export const CodexReasoningEffortSchema = z.enum([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export type CodexReasoningEffort = z.infer<
  typeof CodexReasoningEffortSchema
>;

export const ULTRA_CAPABILITY_NOTE =
  "Ultra is native Codex multi-agent mode for hard fan-out tasks; AxiomGate does not orchestrate Ultra during Build Week.";

export const MODEL_DIRECTOR_EFFORT_LABELS = [
  "Light",
  "Medium",
  "High",
  "Xhigh",
  "Max",
] as const;

/**
 * Verified live with codex-cli 0.144.4 on 2026-07-16: `light` was
 * rejected, while `low`, `medium`, `high`, `xhigh`, and `max` succeeded.
 * Keep the product vocabulary at this boundary and translate Light to the
 * CLI's historical wire value.
 */
const DISPLAY_TO_CODEX_WIRE: Readonly<
  Record<ReasoningEffort, CodexReasoningEffort>
> = {
  light: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max",
};

export function toCodexReasoningEffort(
  effort: ReasoningEffort,
): CodexReasoningEffort {
  return DISPLAY_TO_CODEX_WIRE[effort];
}

export function toDisplayReasoningEffort(
  effort: PersistedReasoningEffort,
): ReasoningEffort {
  return effort === "none" || effort === "minimal" || effort === "low"
    ? "light"
    : effort;
}

export function formatReasoningEffort(
  effort: PersistedReasoningEffort,
): (typeof MODEL_DIRECTOR_EFFORT_LABELS)[number] {
  const display = toDisplayReasoningEffort(effort);
  const labels: Readonly<
    Record<ReasoningEffort, (typeof MODEL_DIRECTOR_EFFORT_LABELS)[number]>
  > = {
    light: "Light",
    medium: "Medium",
    high: "High",
    xhigh: "Xhigh",
    max: "Max",
  };
  return labels[display];
}

export function renderModelDirectorVocabulary(): string {
  return `Model Director efforts: ${MODEL_DIRECTOR_EFFORT_LABELS.join(", ")} (Light uses CLI wire value low). Ultra: native Codex multi-agent mode; not orchestrated by AxiomGate during Build Week.`;
}
