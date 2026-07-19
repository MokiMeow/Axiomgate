import { redactSensitiveText } from "../../evidence/index.js";
import type { TelegramConfig } from "./config.js";

export interface TelegramMessage {
  readonly message_id: number;
  readonly chat?: { readonly id: string | number };
}

export interface TelegramCallbackQuery {
  readonly id: string;
  readonly from: { readonly id: string | number };
  readonly data?: string;
  readonly message?: {
    readonly message_id: number;
    readonly chat: { readonly id: string | number };
  };
}

export interface TelegramUpdate {
  readonly update_id: number;
  readonly callback_query?: TelegramCallbackQuery;
}

export interface TelegramBotIdentity {
  readonly id: string | number;
  readonly is_bot: boolean;
  readonly username?: string;
  readonly first_name?: string;
}

export interface TelegramClient {
  readonly getMe: () => Promise<TelegramBotIdentity>;
  readonly sendMessage: (
    chatId: string,
    text: string,
    replyMarkup?: unknown,
  ) => Promise<TelegramMessage>;
  readonly editMessageText: (
    chatId: string,
    messageId: number,
    text: string,
    replyMarkup?: unknown,
  ) => Promise<void>;
  readonly answerCallbackQuery: (
    callbackQueryId: string,
    text?: string,
  ) => Promise<void>;
  readonly getUpdates: (
    offset: number,
    timeoutSeconds: number,
  ) => Promise<readonly TelegramUpdate[]>;
}

export interface TelegramClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

interface TelegramResponse<T> {
  readonly ok: boolean;
  readonly result?: T;
  readonly description?: string;
  readonly error_code?: number;
  readonly parameters?: { readonly retry_after?: number };
}

export class TelegramApiError extends Error {
  readonly method: string;
  readonly status: number | undefined;

  constructor(method: string, message: string, status?: number) {
    super(message);
    this.name = "TelegramApiError";
    this.method = method;
    this.status = status;
  }
}

function safeErrorText(value: unknown, token: string): string {
  const text = value instanceof Error ? value.message : String(value);
  return redactSensitiveText(text.replaceAll(token, "[REDACTED_TELEGRAM_TOKEN]"));
}

function retryable(status: number | undefined): boolean {
  return status === undefined || status === 429 || status >= 500;
}

export function createTelegramClient(
  config: TelegramConfig,
  options: TelegramClientOptions = {},
): TelegramClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxAttempts = options.maxAttempts ?? 3;
  const sleep = options.sleep ?? ((milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)));

  async function call<T>(
    method: string,
    payload: Readonly<Record<string, unknown>>,
    requestTimeoutMs = timeoutMs,
  ): Promise<T> {
    let lastError: TelegramApiError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetchImpl(
          `https://api.telegram.org/bot${config.token}/${method}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as TelegramResponse<T>;
        if (response.ok && body.ok && body.result !== undefined) {
          return body.result;
        }
        const description = safeErrorText(
          body.description ?? "Telegram API request failed",
          config.token,
        );
        lastError = new TelegramApiError(
          method,
          `${method} failed${body.error_code === undefined ? "" : ` (${body.error_code})`}: ${description}`,
          response.status,
        );
        if (!retryable(response.status) || attempt === maxAttempts) break;
        const retrySeconds = Math.min(body.parameters?.retry_after ?? attempt, 5);
        await sleep(retrySeconds * 1_000);
      } catch (error) {
        lastError = new TelegramApiError(
          method,
          `${method} unavailable: ${safeErrorText(error, config.token)}`,
        );
        if (attempt === maxAttempts) break;
        await sleep(Math.min(attempt * 250, 1_000));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new TelegramApiError(method, `${method} failed`);
  }

  return {
    getMe: () => call<TelegramBotIdentity>("getMe", {}),
    sendMessage: (chatId, text, replyMarkup) =>
      call<TelegramMessage>("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup === undefined ? {} : { reply_markup: replyMarkup }),
      }),
    editMessageText: async (chatId, messageId, text, replyMarkup) => {
      await call<TelegramMessage | true>("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup === undefined ? {} : { reply_markup: replyMarkup }),
      });
    },
    answerCallbackQuery: async (callbackQueryId, text) => {
      await call<true>("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        ...(text === undefined ? {} : { text: [...text].slice(0, 200).join("") }),
      });
    },
    getUpdates: (offset, timeoutSeconds) =>
      call<readonly TelegramUpdate[]>(
        "getUpdates",
        {
          offset,
          timeout: timeoutSeconds,
          allowed_updates: ["callback_query"],
        },
        Math.max(requestTimeoutMsForPoll(timeoutSeconds), timeoutMs),
      ),
  };
}

function requestTimeoutMsForPoll(timeoutSeconds: number): number {
  return Math.max(1, timeoutSeconds + 5) * 1_000;
}
