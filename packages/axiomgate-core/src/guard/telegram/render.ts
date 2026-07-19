import { redactSensitiveText } from "../../evidence/index.js";
import type { ApprovalRequestRecord } from "../approval-store.js";
import type { MissionSnapshot } from "../hook/index.js";

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
  return escapeTelegramHtml(
    truncateTelegramText(redactSensitiveText(value), limit),
  );
}

function workspaceLeaf(snapshot: MissionSnapshot): string {
  return snapshot.contract.projectProfileId
    .split(/[\\/]/u)
    .filter(Boolean)
    .at(-1) ?? snapshot.contract.projectProfileId;
}

function identity(snapshot: MissionSnapshot, action: string): string {
  if (action.includes("deploy")) {
    return snapshot.identity.vercelUser.status === "RESOLVED"
      ? `${snapshot.identity.vercelUser.value} (Vercel)`
      : "Unavailable (Vercel)";
  }
  return snapshot.identity.githubLogin.status === "RESOLVED"
    ? `${snapshot.identity.githubLogin.value} (GitHub)`
    : "Unavailable (GitHub)";
}

function target(record: ApprovalRequestRecord): string {
  const requestTarget = record.request.target;
  return requestTarget.project ?? `${requestTarget.owner}/${requestTarget.repo}`;
}

function commandLabel(record: ApprovalRequestRecord): string {
  const command =
    record.displayCommand ??
    "Command unavailable. The stored hash remains authoritative.";
  const redacted = redactSensitiveText(command);
  return redacted === command ? redacted : `[redacted] ${redacted}`;
}

function grantMinutes(record: ApprovalRequestRecord): number {
  return Math.max(
    0,
    Math.ceil(
      (Date.parse(record.expiresAt) - Date.parse(record.createdAt)) / 60_000,
    ),
  );
}

function reasonLines(record: ApprovalRequestRecord): string[] {
  return record.reasons.map((reason) => `• ${safe(reason, 240)}`);
}

export interface TelegramInlineButton {
  readonly text: string;
  readonly callback_data: string;
}

export interface TelegramReplyMarkup {
  readonly inline_keyboard: readonly (readonly TelegramInlineButton[])[];
}

export interface ApprovalCard {
  readonly text: string;
  readonly replyMarkup: TelegramReplyMarkup;
}

export type ApprovalOutcome =
  | "APPROVED"
  | "DENIED"
  | "EXPIRED"
  | "CONSUMED";

export function renderApprovalButtons(callbackRef: string): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Approve once", callback_data: `ag:${callbackRef}:a` },
        { text: "Deny", callback_data: `ag:${callbackRef}:d` },
      ],
      [{ text: "Details", callback_data: `ag:${callbackRef}:i` }],
    ],
  };
}

export function renderOutcomeButtons(
  callbackRef: string,
): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [{ text: "Details", callback_data: `ag:${callbackRef}:i` }],
    ],
  };
}

export function renderApprovalCard(
  snapshot: MissionSnapshot,
  record: ApprovalRequestRecord,
  callbackRef: string,
): ApprovalCard {
  const text = [
    "🛡️ <b>Approval required</b>",
    "",
    "<b>Mission</b>",
    `<code>${safe(snapshot.contract.id, 40)}</code>`,
    `"${safe(snapshot.contract.objective, 80)}"`,
    "",
    "<b>Action</b>",
    safe(telegramActionLabel(record.request.semanticAction), 80),
    `<code>${safe(record.request.semanticAction, 60)}</code>`,
    "",
    "<b>Target</b>",
    safe(target(record), 100),
    "",
    "<b>Identity</b>",
    safe(identity(snapshot, record.request.semanticAction), 80),
    "",
    "<b>Workspace</b>",
    safe(workspaceLeaf(snapshot), 100),
    "",
    "<b>Command</b>",
    `<code>${escapeTelegramHtml(truncateTelegramText(commandLabel(record), 120))}</code>`,
    "",
    "<b>Exact binding</b>",
    `<code>${escapeTelegramHtml(record.request.rawCommandHash.slice(0, 19))}…</code>`,
    "Approves only the command shown above.",
    "",
    `<b>Risk</b>  ${safe(record.request.risk.toUpperCase(), 20)}`,
    ...reasonLines(record),
    "",
    "<b>Grant</b>",
    `One use • expires in ${grantMinutes(record)} min`,
    safe(new Date(record.expiresAt).toLocaleString(), 60),
  ].join("\n");
  return { text, replyMarkup: renderApprovalButtons(callbackRef) };
}

export function renderApprovalDetails(
  snapshot: MissionSnapshot,
  record: ApprovalRequestRecord,
): string {
  return [
    "🔎 <b>Approval details</b>",
    "",
    "<b>Mission</b>",
    `<code>${safe(snapshot.contract.id, 40)}</code>`,
    "",
    "<b>Request</b>",
    `<code>${safe(record.request.id, 80)}</code>`,
    "",
    "<b>Policy reasons</b>",
    ...reasonLines(record),
    "",
    "<b>Requested</b>",
    safe(record.createdAt, 40),
    "",
    "<b>Intent boundary</b>",
    `Action: ${safe(record.request.intentBoundaryRequired, 40)}`,
    `Mission: ${safe(snapshot.contract.intentBoundary, 40)}`,
    "",
    "<b>Workspace</b>",
    safe(workspaceLeaf(snapshot), 100),
    "",
    "<b>Full command hash</b>",
    `<code>${escapeTelegramHtml(record.request.rawCommandHash)}</code>`,
    "",
    "<b>Evidence event</b>",
    `<code>${safe(record.evidenceEventId ?? "Unavailable", 100)}</code>`,
  ].join("\n");
}

export function renderApprovalOutcome(
  snapshot: MissionSnapshot,
  record: ApprovalRequestRecord,
  outcome: ApprovalOutcome,
  detail: string,
): string {
  const presentation =
    outcome === "APPROVED"
      ? { icon: "✅", title: "Approved once" }
      : outcome === "CONSUMED"
        ? { icon: "✅", title: "Command consumed" }
        : outcome === "DENIED"
          ? { icon: "⛔", title: "Denied" }
          : { icon: "⌛", title: "Expired" };
  return [
    `${presentation.icon} <b>${presentation.title}</b>`,
    safe(detail, 180),
    "",
    "<b>Mission</b>",
    `<code>${safe(snapshot.contract.id, 40)}</code>`,
    safe(snapshot.contract.objective, 80),
    "",
    "<b>Action</b>",
    `${safe(telegramActionLabel(record.request.semanticAction), 80)}  •  <code>${safe(record.request.semanticAction, 60)}</code>`,
    "",
    "<b>Target</b>",
    safe(target(record), 100),
    "",
    "<b>Exact binding</b>",
    `<code>${escapeTelegramHtml(record.request.rawCommandHash.slice(0, 19))}…</code>`,
  ].join("\n");
}
