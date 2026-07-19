import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ApprovalOutcome } from "./render.js";

export interface TelegramCardState {
  readonly ref: string;
  readonly missionId: string;
  readonly requestId: string;
  readonly chatKey: string;
  readonly messageId: number;
  readonly cardText: string;
  readonly sentAt: string;
  readonly updatedAt?: string;
  readonly outcome?: ApprovalOutcome;
}

export interface TelegramState {
  readonly version: 1;
  readonly nextUpdateOffset: number;
  readonly cards: readonly TelegramCardState[];
  readonly notifiedKeys: readonly string[];
}

export const EMPTY_TELEGRAM_STATE: TelegramState = {
  version: 1,
  nextUpdateOffset: 0,
  cards: [],
  notifiedKeys: [],
};

export function telegramStatePath(projectPath: string): string {
  return join(projectPath, ".axiomgate", "telegram-state.json");
}

export function telegramChatKey(chatId: string): string {
  return `sha256:${createHash("sha256").update(chatId).digest("hex")}`;
}

export function telegramCallbackRef(missionId: string, requestId: string): string {
  return createHash("sha256")
    .update(`${missionId}\0${requestId}`)
    .digest("base64url")
    .slice(0, 18);
}

export function parseTelegramCallback(
  value: string | undefined,
): { readonly ref: string; readonly verb: "a" | "d" | "i" } | undefined {
  if (value === undefined || Buffer.byteLength(value, "utf8") > 64) return undefined;
  const matched = /^ag:([A-Za-z0-9_-]{12,24}):(a|d|i)$/u.exec(value);
  return matched === null
    ? undefined
    : { ref: matched[1]!, verb: matched[2] as "a" | "d" | "i" };
}

function isState(value: unknown): value is TelegramState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  return object.version === 1 && Number.isSafeInteger(object.nextUpdateOffset) &&
    Array.isArray(object.cards) && Array.isArray(object.notifiedKeys);
}

export function readTelegramState(projectPath: string): TelegramState {
  const path = telegramStatePath(projectPath);
  if (!existsSync(path)) return EMPTY_TELEGRAM_STATE;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return isState(parsed) ? parsed : EMPTY_TELEGRAM_STATE;
  } catch {
    return EMPTY_TELEGRAM_STATE;
  }
}

export function writeTelegramState(projectPath: string, state: TelegramState): void {
  const path = telegramStatePath(projectPath);
  mkdirSync(dirname(path), { recursive: true });
  const normalized: TelegramState = {
    version: 1,
    nextUpdateOffset: Math.max(0, Math.floor(state.nextUpdateOffset)),
    cards: [...state.cards],
    notifiedKeys: [...state.notifiedKeys].slice(-2_000),
  };
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}
