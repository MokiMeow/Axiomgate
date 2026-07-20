import { createHash } from "node:crypto";

import { redactSensitiveText } from "../../evidence/index.js";
import type { TelegramNotifyMode } from "./config.js";
import { escapeTelegramHtml, telegramActionLabel } from "./render.js";

export interface TelegramStageNotification {
  readonly key: string;
  readonly text: string;
}

export interface TelegramStageContext {
  readonly objective: string;
  readonly workspace: string;
  readonly boundary?: string;
  readonly modelPlan?: readonly {
    readonly phase: string;
    readonly model: string;
    readonly effort: string;
  }[];
}

const EVENT_LABELS: Readonly<Record<string, string>> = {
  "hook.denied": "🛡️ <b>Action blocked</b>",
  "run.finished": "🏁 <b>Run complete</b>",
  "run.checkpoint": "⏸️ <b>Run paused</b>",
  "verification.completed": "🔎 <b>Verification complete</b>",
  "remediation.completed": "🛠️ <b>Remediation complete</b>",
  "proof.completed": "🧾 <b>Proof receipt ready</b>",
  "runway.usage": "📊 <b>Runway update</b>",
  "runway.reserve.warning": "⚠️ <b>Verification reserve warning</b>",
  "runway.banked_reset.expiring": "⏳ <b>Banked reset expiring</b>",
  "runway.recommendation": "🔁 <b>Runway recommendation</b>",
};

function stringValue(
  event: Readonly<Record<string, unknown>>,
  key: string,
  fallback: string,
): string {
  return typeof event[key] === "string" ? event[key] as string : fallback;
}

function optionalString(
  event: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  return typeof event[key] === "string" && (event[key] as string).length > 0
    ? event[key] as string
    : undefined;
}

function optionalNumber(
  event: Readonly<Record<string, unknown>>,
  key: string,
): number | undefined {
  return typeof event[key] === "number" && Number.isFinite(event[key])
    ? event[key] as number
    : undefined;
}

function clean(value: string, limit = 300): string {
  const normalized = redactSensitiveText(value)
    .replaceAll("—", ":")
    .replaceAll("–", "-");
  const characters = [...normalized];
  const bounded = characters.length <= limit
    ? normalized
    : `${characters.slice(0, Math.max(0, limit - 1)).join("")}…`;
  return escapeTelegramHtml(bounded);
}

function time(value: unknown): string {
  if (typeof value !== "string") return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function section(label: string, ...values: readonly string[]): string[] {
  const present = values.filter((value) => value.length > 0);
  return present.length === 0 ? [] : [`<b>${label}</b>`, ...present, ""];
}

function missionLines(
  event: Readonly<Record<string, unknown>>,
  context: TelegramStageContext | undefined,
): string[] {
  const mission = context?.objective ?? stringValue(event, "missionId", "Unknown mission");
  const workspace = context?.workspace;
  return [
    ...section("Mission", clean(mission, 160)),
    ...(workspace === undefined
      ? []
      : section("Workspace", `<code>${clean(workspace, 100)}</code>`)),
  ];
}

function phaseModel(
  context: TelegramStageContext | undefined,
  phase: string,
): string | undefined {
  const entry = context?.modelPlan?.find((candidate) => candidate.phase === phase);
  if (entry === undefined) return undefined;
  const effort = entry.effort.length === 0
    ? "Unknown"
    : `${entry.effort[0]!.toUpperCase()}${entry.effort.slice(1)}`;
  return `${clean(entry.model, 80)} / ${clean(effort, 20)}`;
}

function reason(event: Readonly<Record<string, unknown>>): string {
  const reasons = event.reasons;
  if (Array.isArray(reasons)) {
    const first = reasons.find((item): item is string => typeof item === "string");
    if (first !== undefined) return first;
  }
  return stringValue(event, "message", "Policy denied this action.");
}

function runwayLines(event: Readonly<Record<string, unknown>>): string[] {
  const used = optionalNumber(event, "runwayUsedPercent")
    ?? optionalNumber(event, "usedPercent");
  if (used === undefined) return [];
  const remaining = optionalNumber(event, "runwayRemainingPercent")
    ?? Math.max(0, 100 - used);
  const banked = optionalNumber(event, "bankedResetCount");
  const reset = optionalString(event, "runwayResetsAt")
    ?? optionalString(event, "resetsAt");
  const plan = optionalString(event, "runwayPlanType")
    ?? optionalString(event, "planType");
  const source = optionalString(event, "runwaySource")
    ?? optionalString(event, "sourceLabel");
  return section(
    "Runway",
    `Used: <b>${used}%</b>`,
    `Remaining: <b>${remaining}%</b>`,
    `Resets: ${reset === undefined ? "UNKNOWN" : clean(time(reset), 80)}`,
    `Banked resets: ${banked === undefined ? "UNKNOWN" : banked}`,
    `Plan: ${plan === undefined ? "UNKNOWN" : clean(plan, 40)}`,
    source === undefined ? "" : `Source: ${clean(source, 80)}`,
  );
}

function eventLines(
  type: string,
  event: Readonly<Record<string, unknown>>,
  context: TelegramStageContext | undefined,
  usageThreshold: number,
): string[] {
  switch (type) {
    case "hook.denied": {
      const action = stringValue(event, "semanticAction", "unknown action");
      const target = optionalString(event, "target");
      const tool = optionalString(event, "toolName");
      return [
        ...section("Decision", "<b>Blocked</b>"),
        ...section("Action", clean(telegramActionLabel(action), 100)),
        ...(target === undefined ? [] : section("Target", clean(target, 120))),
        ...section("Reason", clean(reason(event), 300)),
        ...(tool === undefined ? [] : section("Tool", `<code>${clean(tool, 80)}</code>`)),
      ];
    }
    case "run.finished": {
      const model = `${clean(stringValue(event, "model", "Unknown model"), 80)} / ${clean(stringValue(event, "effort", "Unknown effort"), 30)}`;
      return [
        ...section("Result", clean(stringValue(event, "status", "UNKNOWN"), 40)),
        ...section("Model", model),
        ...section(
          "Usage",
          `Input: ${optionalNumber(event, "inputTokens") ?? 0} tokens`,
          `Output: ${optionalNumber(event, "outputTokens") ?? 0} tokens`,
        ),
        ...runwayLines(event),
      ];
    }
    case "run.checkpoint":
      return [
        ...section("Reason", clean(stringValue(event, "reason", "Checkpoint created"), 160)),
        ...section("Reset", clean(stringValue(event, "resetAt", "UNKNOWN"), 80)),
        ...section(
          "Resume",
          `<code>axiomgate mission resume ${clean(stringValue(event, "missionId", "<id>"), 80)}</code>`,
        ),
      ];
    case "verification.completed":
      return [
        ...section("Result", clean(stringValue(event, "status", "UNKNOWN"), 40)),
        ...section(
          "Checks",
          `Completed: ${optionalNumber(event, "checkCount") ?? 0}`,
          `Findings: ${optionalNumber(event, "findingCount") ?? 0}`,
        ),
        ...section("Model", phaseModel(context, "verify") ?? "Not recorded"),
        ...section("Meaning", "Required evidence was evaluated against the current workspace revision."),
      ];
    case "remediation.completed":
      return [
        ...section("Result", clean(stringValue(event, "status", "UNKNOWN"), 40)),
        ...section("Finding", clean(stringValue(event, "findingId", "Unknown finding"), 100)),
        ...section("Model", phaseModel(context, "remediate") ?? "Not recorded"),
        ...section("Meaning", "The affected checks were rerun after the governed fix."),
      ];
    case "proof.completed":
      return [
        ...section("Outcome", clean(stringValue(event, "outcome", "UNKNOWN"), 40)),
        ...section("Proof", `${optionalNumber(event, "criteriaCount") ?? 0} criteria proven`),
        ...section("Meaning", "The receipt is ready for offline integrity verification."),
      ];
    case "runway.usage":
      return [
        ...runwayLines(event),
        ...section("Alert", `Usage reached the configured ${usageThreshold}% notification threshold.`),
      ];
    case "runway.reserve.warning":
      return [
        ...section("Warning", clean(stringValue(event, "message", "Verification reserve is at risk."), 260)),
        ...section("Next step", "Preserve capacity for verification. This warning does not block the mission."),
      ];
    case "runway.banked_reset.expiring":
      return [
        ...section("Available", `${optionalNumber(event, "bankedResetCount") ?? "UNKNOWN"} banked resets`),
        ...section("Expiry", clean(stringValue(event, "resetExpiresAt", stringValue(event, "message", "UNKNOWN")), 220)),
        ...section("Action", "Activation is never automatic."),
      ];
    case "runway.recommendation":
      return [
        ...section("Signal", clean(stringValue(event, "signal", "Repeated work pattern"), 120)),
        ...section("Recommendation", clean(stringValue(event, "recommendation", "Pause and diagnose"), 160)),
      ];
    default:
      return section("Update", clean(stringValue(event, "message", "See the local mission record for details."), 240));
  }
}

export function stageNotificationFromEvent(
  event: Readonly<Record<string, unknown>>,
  mode: TelegramNotifyMode,
  usageThreshold = 80,
  context?: TelegramStageContext,
): TelegramStageNotification | undefined {
  if (mode !== "all") return undefined;
  const rawType = typeof event.type === "string"
    ? event.type
    : event.source === "hook" && event.decision === "DENY"
      ? "hook.denied"
      : undefined;
  if (rawType === undefined || EVENT_LABELS[rawType] === undefined) return undefined;
  if (
    rawType === "runway.usage" &&
    (typeof event.usedPercent !== "number" || event.usedPercent < usageThreshold)
  ) return undefined;
  const key = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  return {
    key,
    text: [
      EVENT_LABELS[rawType],
      "",
      ...missionLines(event, context),
      ...eventLines(rawType, event, context, usageThreshold),
      `<i>${clean(time(event.ts), 80)}</i>`,
    ].join("\n").replace(/\n{3,}/gu, "\n\n").trim(),
  };
}
