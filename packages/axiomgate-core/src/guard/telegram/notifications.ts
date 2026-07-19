import { createHash } from "node:crypto";

import { redactSensitiveText } from "../../evidence/index.js";
import type { TelegramNotifyMode } from "./config.js";
import { escapeTelegramHtml } from "./render.js";

export interface TelegramStageNotification {
  readonly key: string;
  readonly text: string;
}

const EVENT_LABELS: Readonly<Record<string, string>> = {
  "hook.denied": "⛔ Guard denied an action",
  "run.finished": "🏁 Governed run finished",
  "run.checkpoint": "⏸️ Run checkpointed",
  "verification.completed": "🔍 Verification completed",
  "remediation.completed": "🛠️ Remediation completed",
  "proof.completed": "🧾 Proof receipt generated",
  "runway.usage": "📊 Runway usage threshold reached",
  "runway.reserve.warning": "⚠️ Verification reserve warning",
  "runway.banked_reset.expiring": "⏳ Banked reset expires soon",
  "runway.recommendation": "🔁 Runway loop signal",
};

function stringValue(event: Readonly<Record<string, unknown>>, key: string, fallback: string): string {
  return typeof event[key] === "string" ? event[key] as string : fallback;
}

function numberValue(event: Readonly<Record<string, unknown>>, key: string): number {
  return typeof event[key] === "number" && Number.isFinite(event[key]) ? event[key] as number : 0;
}

function compactMessage(
  type: string,
  event: Readonly<Record<string, unknown>>,
  usageThreshold: number,
): string {
  const reason = Array.isArray(event.reasons)
    ? event.reasons.find((item): item is string => typeof item === "string") ?? "policy denied"
    : stringValue(event, "message", "policy denied");
  switch (type) {
    case "hook.denied":
      return `[blocked] ${stringValue(event, "semanticAction", "unknown action")} on ${stringValue(event, "target", stringValue(event, "commandHash", "unknown target"))} — ${reason}`;
    case "run.finished":
      return `${stringValue(event, "runId", "run_unknown").slice(0, 18)} — ${stringValue(event, "status", "UNKNOWN")} — ${stringValue(event, "model", "unknown model")}/${stringValue(event, "effort", "unknown effort")} — ${numberValue(event, "inputTokens")} in/${numberValue(event, "outputTokens")} out`;
    case "run.checkpoint":
      return `[paused] ${stringValue(event, "reason", "checkpoint")} — resets ${stringValue(event, "resetAt", "UNKNOWN")} — resume: axiomgate mission resume ${stringValue(event, "missionId", "<id>")}`;
    case "verification.completed":
      return `${numberValue(event, "checkCount")} checks — ${stringValue(event, "status", "UNKNOWN")} (${numberValue(event, "findingCount")} findings)`;
    case "remediation.completed":
      return `remediation ${stringValue(event, "findingId", "unknown finding")} — ${stringValue(event, "status", "UNKNOWN")}`;
    case "proof.completed":
      return `${numberValue(event, "criteriaCount")} criteria proven — receipt ${stringValue(event, "chainHead", stringValue(event, "outputRef", "UNKNOWN")).slice(0, 24)}`;
    case "runway.usage":
      return `weekly usage ${numberValue(event, "usedPercent")}% crossed ${usageThreshold}%`;
    case "runway.reserve.warning":
      return `verification reserve — ${stringValue(event, "message", "reserve at risk")}`;
    case "runway.banked_reset.expiring":
      return `banked reset expiring — ${stringValue(event, "message", "within 72h")}`;
    case "runway.recommendation":
      return `consider: ${stringValue(event, "recommendation", "pause and diagnose")}`;
    default:
      return stringValue(event, "message", "See the local mission record for details.");
  }
}

export function stageNotificationFromEvent(
  event: Readonly<Record<string, unknown>>,
  mode: TelegramNotifyMode,
  usageThreshold = 80,
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
  const ts = typeof event.ts === "string" ? event.ts : "time unavailable";
  const missionId = typeof event.missionId === "string" ? event.missionId : "unknown mission";
  const message = compactMessage(rawType, event, usageThreshold);
  const normalized = escapeTelegramHtml(redactSensitiveText(message));
  const key = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  return {
    key,
    text: `${EVENT_LABELS[rawType]}\nMission: ${missionId}\n${normalized}\n${ts}`,
  };
}
