import { redactSensitiveText } from "../../evidence/index.js";
import type { MissionSnapshot } from "../hook/index.js";
import type { ApprovalRequestRecord } from "../approval-store.js";

const ACTION_LABELS: Readonly<Record<string, string>> = {
  "repository.read": "Read repository",
  "file.modify": "Modify files",
  "branch.create": "Create branch",
  "pull_request.create": "Create pull request",
  "preview.deploy": "Deploy preview",
  "production.deploy": "Deploy production",
  "verification.run": "Run verification",
};

export function telegramActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? `Unknown action (${action})`;
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function truncateTelegramText(value: string, limit: number): string {
  const characters = [...value];
  return characters.length <= limit
    ? value
    : `${characters.slice(0, Math.max(0, limit - 1)).join("")}…`;
}

function safe(value: string, limit: number): string {
  return escapeTelegramHtml(truncateTelegramText(redactSensitiveText(value), limit));
}

function identity(snapshot: MissionSnapshot, action: string): string {
  if (action.includes("deploy")) {
    return snapshot.identity.vercelUser.status === "RESOLVED"
      ? `${snapshot.identity.vercelUser.value} (Vercel)`
      : "UNAVAILABLE (Vercel)";
  }
  return snapshot.identity.githubLogin.status === "RESOLVED"
    ? `${snapshot.identity.githubLogin.value} (GitHub)`
    : "UNAVAILABLE (GitHub)";
}

function target(record: ApprovalRequestRecord): string {
  const requestTarget = record.request.target;
  return requestTarget.project ?? `${requestTarget.owner}/${requestTarget.repo}`;
}

function grantMinutes(record: ApprovalRequestRecord): number {
  return Math.max(
    0,
    Math.ceil((Date.parse(record.expiresAt) - Date.parse(record.createdAt)) / 60_000),
  );
}

export interface ApprovalCard {
  readonly text: string;
  readonly replyMarkup: {
    readonly inline_keyboard: readonly (readonly {
      readonly text: string;
      readonly callback_data: string;
    }[])[];
  };
}

export function renderApprovalCard(
  snapshot: MissionSnapshot,
  record: ApprovalRequestRecord,
  callbackRef: string,
): ApprovalCard {
  const command = record.displayCommand ?? "Command text unavailable; hash remains authoritative";
  const redactedCommand = redactSensitiveText(command);
  const commandLabel = redactedCommand === command
    ? redactedCommand
    : `[redacted] ${redactedCommand}`;
  const workspace = snapshot.contract.projectProfileId
    .split(/[\\/]/u)
    .filter(Boolean)
    .at(-1) ?? snapshot.contract.projectProfileId;
  const text = [
    "🛡️ <b>AxiomGate — approval required</b>",
    "",
    `<b>Mission</b>  <code>${safe(snapshot.contract.id, 40)}</code> — “${safe(snapshot.contract.objective, 80)}”`,
    `<b>Action</b>   <code>${safe(record.request.semanticAction, 60)}</code> — ${safe(telegramActionLabel(record.request.semanticAction), 80)}`,
    `<b>Target:</b> ${safe(target(record), 100)}`,
    `<b>As:</b> ${safe(identity(snapshot, record.request.semanticAction), 80)}`,
    `<b>Workspace:</b> ${safe(workspace, 100)}`,
    `<b>Command:</b> <code>${escapeTelegramHtml(truncateTelegramText(commandLabel, 120))}</code>`,
    `<b>Hash:</b> <code>${escapeTelegramHtml(record.request.rawCommandHash.slice(0, 19))}…</code> — approval binds to this exact command`,
    `<b>Risk:</b> ${safe(record.request.risk, 20)} — ${safe(record.reasons.join("; "), 180)}`,
    `<b>Grant:</b> single use — expires in ${grantMinutes(record)}m (${safe(new Date(record.expiresAt).toLocaleString(), 60)})`,
  ].join("\n");
  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "Approve once", callback_data: `ag:${callbackRef}:a` },
          { text: "Deny", callback_data: `ag:${callbackRef}:d` },
        ],
        [{ text: "Details", callback_data: `ag:${callbackRef}:i` }],
      ],
    },
  };
}

export function renderApprovalDetails(
  snapshot: MissionSnapshot,
  record: ApprovalRequestRecord,
): string {
  return [
    "🛡️ <b>AxiomGate — approval details</b>",
    `<b>Request:</b> <code>${safe(record.request.id, 80)}</code>`,
    `<b>Boundary:</b> ${safe(record.request.intentBoundaryRequired, 40)} (mission ${safe(snapshot.contract.intentBoundary, 40)})`,
    `<b>Workspace:</b> ${safe(snapshot.contract.projectProfileId.split(/[\\/]/u).filter(Boolean).at(-1) ?? snapshot.contract.projectProfileId, 100)}`,
    `<b>Requested:</b> ${safe(record.createdAt, 40)}`,
    `<b>Command hash:</b> <code>${escapeTelegramHtml(record.request.rawCommandHash)}</code>`,
    `<b>Evidence event:</b> <code>${safe(record.evidenceEventId ?? "UNAVAILABLE", 100)}</code>`,
    `<b>Reasons:</b> ${safe(record.reasons.join("; "), 500)}`,
  ].join("\n");
}

export type ApprovalOutcome = "APPROVED" | "DENIED" | "EXPIRED" | "CONSUMED";

export function renderApprovalOutcome(
  originalText: string,
  outcome: ApprovalOutcome,
  detail: string,
): string {
  const icon = outcome === "APPROVED" || outcome === "CONSUMED" ? "✅" : "⛔";
  return `${originalText}\n\n${icon} <b>${outcome}</b> · ${safe(detail, 160)}`;
}
