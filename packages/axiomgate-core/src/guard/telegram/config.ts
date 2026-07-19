import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type TelegramNotifyMode = "all" | "approvals" | "off";

export interface TelegramConfig {
  readonly token: string;
  readonly chatIds: readonly string[];
  readonly notify: TelegramNotifyMode;
  readonly notifyUsagePercent: number;
  readonly source: "environment" | ".local/telegram.env";
}

export type TelegramConfigResult =
  | { readonly status: "CONFIGURED"; readonly config: TelegramConfig }
  | { readonly status: "UNAVAILABLE"; readonly reason: string };

export interface TelegramConfigOptions {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly readFile?: (path: string) => string;
}

const BOT_TOKEN_PATTERN = /^\d{5,20}:[A-Za-z0-9_-]{20,}$/u;
const CHAT_ID_PATTERN = /^-?\d+$/u;

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseTelegramEnvFile(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!/^TELEGRAM_(?:BOT_TOKEN|CHAT_ID|NOTIFY|NOTIFY_USAGE_PCT)$/u.test(key)) {
      continue;
    }
    parsed[key] = unquote(trimmed.slice(separator + 1));
  }
  return parsed;
}

function positivePercentage(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) return 80;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100
    ? parsed
    : undefined;
}

export function maskTelegramValue(value: string): string {
  return value.length <= 4 ? "***" : `***${value.slice(-4)}`;
}

export function readTelegramConfig(
  options: TelegramConfigOptions = {},
): TelegramConfigResult {
  const env = options.env ?? process.env;
  const cwd = resolve(options.cwd ?? process.cwd());
  const projectEnvPath = resolve(cwd, ".local", "telegram.env");
  const invocationEnvPath = resolve(process.cwd(), ".local", "telegram.env");
  const envPath = existsSync(projectEnvPath)
    ? projectEnvPath
    : options.env === undefined && existsSync(invocationEnvPath)
      ? invocationEnvPath
      : projectEnvPath;
  const fileValues = existsSync(envPath)
    ? parseTelegramEnvFile(
        (options.readFile ?? ((path) => readFileSync(path, "utf8")))(envPath),
      )
    : {};
  const value = (name: string): string | undefined => {
    const direct = env[name]?.trim();
    return direct === undefined || direct.length === 0
      ? fileValues[name]
      : direct;
  };
  const tokenValue = value("TELEGRAM_BOT_TOKEN");
  const token = tokenValue?.replace(/^bot(?=\d+:)/iu, "");
  const rawChatIds = value("TELEGRAM_CHAT_ID");
  if (token === undefined || rawChatIds === undefined) {
    return {
      status: "UNAVAILABLE",
      reason:
        "set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the environment or ignored .local/telegram.env",
    };
  }
  if (!BOT_TOKEN_PATTERN.test(token)) {
    return { status: "UNAVAILABLE", reason: "TELEGRAM_BOT_TOKEN is malformed" };
  }
  const chatIds = [...new Set(rawChatIds.split(",").map((item) => item.trim()))]
    .filter(Boolean);
  if (chatIds.length === 0 || chatIds.some((chatId) => !CHAT_ID_PATTERN.test(chatId))) {
    return {
      status: "UNAVAILABLE",
      reason: "TELEGRAM_CHAT_ID must be a comma-separated numeric allowlist",
    };
  }
  const rawNotify = value("TELEGRAM_NOTIFY") ?? "all";
  if (rawNotify !== "all" && rawNotify !== "approvals" && rawNotify !== "off") {
    return {
      status: "UNAVAILABLE",
      reason: "TELEGRAM_NOTIFY must be all, approvals, or off",
    };
  }
  const notifyUsagePercent = positivePercentage(
    value("TELEGRAM_NOTIFY_USAGE_PCT"),
  );
  if (notifyUsagePercent === undefined) {
    return {
      status: "UNAVAILABLE",
      reason: "TELEGRAM_NOTIFY_USAGE_PCT must be greater than 0 and at most 100",
    };
  }
  return {
    status: "CONFIGURED",
    config: {
      token,
      chatIds,
      notify: rawNotify,
      notifyUsagePercent,
      source:
        env.TELEGRAM_BOT_TOKEN?.trim() === token
          ? "environment"
          : ".local/telegram.env",
    },
  };
}

export function renderTelegramConfigSummary(result: TelegramConfigResult): string {
  if (result.status === "UNAVAILABLE") return `UNAVAILABLE (${result.reason})`;
  return `configured token=${maskTelegramValue(result.config.token)} chats=${result.config.chatIds
    .map(maskTelegramValue)
    .join(",")} notify=${result.config.notify} source=${result.config.source}`;
}
