import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { redactSensitiveText } from "../../evidence/index.js";
import { approve, deny, getApprovalRequest, listPending } from "../approval-store.js";
import { loadMissionSnapshot } from "../hook/index.js";
import type { TelegramClient, TelegramUpdate } from "./client.js";
import type { TelegramConfig } from "./config.js";
import { maskTelegramValue } from "./config.js";
import { stageNotificationFromEvent } from "./notifications.js";
import {
  renderApprovalCard,
  renderApprovalDetails,
  renderApprovalOutcome,
  renderOutcomeButtons,
  type ApprovalOutcome,
} from "./render.js";
import {
  parseTelegramCallback,
  readTelegramState,
  telegramCallbackRef,
  telegramChatKey,
  writeTelegramState,
  type TelegramCardState,
  type TelegramState,
} from "./state.js";

export interface TelegramRelayResult {
  readonly cardsSent: number;
  readonly notificationsSent: number;
  readonly failures: readonly string[];
}

function missionDirectories(projectPath: string): string[] {
  const root = join(resolve(projectPath), ".axiomgate", "missions");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^msn_[A-Za-z0-9_-]+$/u.test(entry.name))
    .map((entry) => join(root, entry.name));
}

function safeFailure(error: unknown): string {
  return redactSensitiveText(error instanceof Error ? error.message : String(error));
}

function appendRelayEvent(projectPath: string, event: Record<string, unknown>): void {
  const directory = join(resolve(projectPath), ".axiomgate");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "telegram-events.jsonl");
  appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
}

function outcomeFor(record: ReturnType<typeof getApprovalRequest>, now: Date): ApprovalOutcome | undefined {
  if (record === undefined) return undefined;
  if (record.status === "DENIED") return "DENIED";
  if (record.status === "APPROVED") {
    return record.approval?.consumedAt === null ? "APPROVED" : "CONSUMED";
  }
  return Date.parse(record.expiresAt) <= now.getTime() ? "EXPIRED" : undefined;
}

async function editCardsForRequest(
  projectPath: string,
  config: TelegramConfig,
  client: TelegramClient,
  state: TelegramState,
  missionId: string,
  requestId: string,
  outcome: ApprovalOutcome,
  detail: string,
): Promise<TelegramState> {
  const updated: TelegramCardState[] = [];
  for (const card of state.cards) {
    const canAdvanceConsumed = card.outcome === "APPROVED" && outcome === "CONSUMED";
    if (
      card.missionId !== missionId ||
      card.requestId !== requestId ||
      (card.outcome !== undefined && !canAdvanceConsumed)
    ) {
      updated.push(card);
      continue;
    }
    const chatId = config.chatIds.find((candidate) => telegramChatKey(candidate) === card.chatKey);
    if (chatId !== undefined) {
      const missionDir = join(resolve(projectPath), ".axiomgate", "missions", missionId);
      const loaded = loadMissionSnapshot(missionDir);
      const record = getApprovalRequest(missionDir, requestId);
      if (loaded.status === "VALID" && record !== undefined) {
        await client.editMessageText(
          chatId,
          card.messageId,
          renderApprovalOutcome(loaded.snapshot, record, outcome, detail),
          renderOutcomeButtons(card.ref, outcome),
        );
      }
    }
    updated.push({ ...card, outcome, updatedAt: new Date().toISOString() });
  }
  return { ...state, cards: updated };
}

function consumedRunId(missionDir: string, consumedAt: string | null | undefined): string {
  if (consumedAt === null || consumedAt === undefined) return "run unavailable";
  const runsDir = join(missionDir, "runs");
  if (!existsSync(runsDir)) return "run unavailable";
  const consumed = Date.parse(consumedAt);
  for (const name of readdirSync(runsDir).filter((candidate) => /^run_[A-Za-z0-9_-]+\.json$/u.test(candidate))) {
    try {
      const run = JSON.parse(readFileSync(join(runsDir, name), "utf8")) as Record<string, unknown>;
      const started = typeof run.startedAt === "string" ? Date.parse(run.startedAt) : Number.NaN;
      const ended = typeof run.endedAt === "string" ? Date.parse(run.endedAt) : Number.NaN;
      if (Number.isFinite(started) && Number.isFinite(ended) && consumed >= started && consumed <= ended) {
        return typeof run.id === "string" ? run.id : name.slice(0, -5);
      }
    } catch {
      // A malformed run record is not allowed to break approval reconciliation.
    }
  }
  return "run unavailable";
}

export async function reconcileApprovalCards(
  projectPath: string,
  config: TelegramConfig,
  client: TelegramClient,
  options: { readonly now?: () => Date } = {},
): Promise<void> {
  let state = readTelegramState(projectPath);
  const now = (options.now ?? (() => new Date()))();
  const requests = new Map<string, TelegramCardState>();
  for (const card of state.cards) requests.set(`${card.missionId}\0${card.requestId}`, card);
  for (const card of requests.values()) {
    const missionDir = join(resolve(projectPath), ".axiomgate", "missions", card.missionId);
    const record = getApprovalRequest(missionDir, card.requestId);
    const outcome = outcomeFor(record, now);
    if (outcome === undefined || card.outcome === outcome) continue;
    const detail = outcome === "CONSUMED"
      ? `consumed by ${consumedRunId(missionDir, record?.approval?.consumedAt)}`
      : outcome === "APPROVED"
        ? `approved via ${record?.approval?.surface ?? "unknown surface"}`
        : outcome === "DENIED"
          ? `denied via ${record?.deniedSurface ?? "unknown surface"}`
          : `unapproved at ${now.toLocaleString()}`;
    state = await editCardsForRequest(
      projectPath,
      config,
      client,
      state,
      card.missionId,
      card.requestId,
      outcome,
      detail,
    );
    writeTelegramState(projectPath, state);
  }
}

export async function sendPendingApprovalCards(
  projectPath: string,
  config: TelegramConfig,
  client: TelegramClient,
  options: { readonly now?: () => Date } = {},
): Promise<TelegramRelayResult> {
  if (config.notify === "off") return { cardsSent: 0, notificationsSent: 0, failures: [] };
  let state = readTelegramState(projectPath);
  let cardsSent = 0;
  const failures: string[] = [];
  for (const missionDir of missionDirectories(projectPath)) {
    const loaded = loadMissionSnapshot(missionDir);
    if (loaded.status === "INVALID") continue;
    for (const record of listPending(missionDir, options)) {
      const ref = telegramCallbackRef(record.request.missionId, record.request.id);
      for (const chatId of config.chatIds) {
        const chatKey = telegramChatKey(chatId);
        if (state.cards.some((card) => card.ref === ref && card.chatKey === chatKey)) continue;
        const card = renderApprovalCard(loaded.snapshot, record, ref);
        try {
          const message = await client.sendMessage(chatId, card.text, card.replyMarkup);
          state = {
            ...state,
            cards: [...state.cards, {
              ref,
              missionId: record.request.missionId,
              requestId: record.request.id,
              chatKey,
              messageId: message.message_id,
              cardText: card.text,
              sentAt: (options.now ?? (() => new Date()))().toISOString(),
            }],
          };
          writeTelegramState(projectPath, state);
          cardsSent += 1;
        } catch (error) {
          failures.push(safeFailure(error));
        }
      }
    }
  }
  return { cardsSent, notificationsSent: 0, failures };
}

export async function processTelegramUpdate(
  projectPath: string,
  config: TelegramConfig,
  client: TelegramClient,
  update: TelegramUpdate,
  options: { readonly now?: () => Date } = {},
): Promise<void> {
  const callback = update.callback_query;
  if (callback === undefined) return;
  const chatId = String(callback.message?.chat.id ?? callback.from.id);
  if (!config.chatIds.includes(chatId)) {
    appendRelayEvent(projectPath, {
      type: "telegram.callback.unauthorized",
      ts: (options.now ?? (() => new Date()))().toISOString(),
      chat: maskTelegramValue(chatId),
    });
    return;
  }
  const parsed = parseTelegramCallback(callback.data);
  if (parsed === undefined) {
    await client.answerCallbackQuery(callback.id, "Invalid or stale AxiomGate action");
    return;
  }
  let state = readTelegramState(projectPath);
  const card = state.cards.find((candidate) => candidate.ref === parsed.ref && candidate.chatKey === telegramChatKey(chatId));
  if (card === undefined) {
    await client.answerCallbackQuery(callback.id, "Approval reference not found");
    return;
  }
  const missionDir = join(resolve(projectPath), ".axiomgate", "missions", card.missionId);
  const loaded = loadMissionSnapshot(missionDir);
  const record = getApprovalRequest(missionDir, card.requestId);
  if (loaded.status === "INVALID" || record === undefined) {
    await client.answerCallbackQuery(callback.id, "Mission or approval record unavailable");
    return;
  }
  if (parsed.verb === "i") {
    await client.answerCallbackQuery(callback.id, "Details sent");
    await client.sendMessage(chatId, renderApprovalDetails(loaded.snapshot, record));
    return;
  }
  const existingOutcome = outcomeFor(record, (options.now ?? (() => new Date()))());
  if (existingOutcome !== undefined) {
    const surface = record.approval?.surface ?? record.deniedSurface ?? "canonical store";
    await client.answerCallbackQuery(
      callback.id,
      existingOutcome === "EXPIRED"
        ? "expired - re-run to request again"
        : `already decided (${existingOutcome.toLowerCase()}) by ${surface}`,
    );
    state = await editCardsForRequest(projectPath, config, client, state, card.missionId, card.requestId, existingOutcome, existingOutcome === "EXPIRED" ? "unapproved after expiry" : `already decided by ${surface}`);
    writeTelegramState(projectPath, state);
    return;
  }
  const actor = `telegram:${maskTelegramValue(chatId)}`;
  const decidedAt = (options.now ?? (() => new Date()))();
  const actorOptions = {
    approver: actor,
    surface: "telegram" as const,
    ...(options.now === undefined ? {} : { now: options.now }),
  };
  const mutation = parsed.verb === "a"
    ? approve(missionDir, card.requestId, actorOptions)
    : deny(missionDir, card.requestId, actorOptions);
  if (mutation.status === "REJECTED") {
    await client.answerCallbackQuery(callback.id, `Already decided: ${mutation.reason}`);
    return;
  }
  const outcome: ApprovalOutcome = mutation.status;
  await client.answerCallbackQuery(callback.id, outcome === "APPROVED" ? "Approved once" : "Denied");
  state = await editCardsForRequest(
    projectPath,
    config,
    client,
    state,
    card.missionId,
    card.requestId,
    outcome,
    outcome === "APPROVED"
      ? `once by ${actor} at ${decidedAt.toLocaleString()}`
      : `by ${actor} at ${decidedAt.toLocaleString()} — recorded as evidence`,
  );
  writeTelegramState(projectPath, state);
  appendRelayEvent(projectPath, {
    type: `telegram.approval.${outcome.toLowerCase()}`,
    ts: (options.now ?? (() => new Date()))().toISOString(),
    missionId: card.missionId,
    actionRequestId: card.requestId,
    actor,
  });
}

function readEvents(missionDir: string): Record<string, unknown>[] {
  const path = join(missionDir, "events.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/u).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as Record<string, unknown>]; } catch { return []; }
  });
}

export async function sendStageNotifications(
  projectPath: string,
  config: TelegramConfig,
  client: TelegramClient,
  limit = 20,
): Promise<number> {
  if (config.notify !== "all") return 0;
  let state = readTelegramState(projectPath);
  let sent = 0;
  let suppressed = 0;
  for (const missionDir of missionDirectories(projectPath)) {
    for (const event of readEvents(missionDir)) {
      const notification = stageNotificationFromEvent(event, config.notify, config.notifyUsagePercent);
      if (notification === undefined || state.notifiedKeys.includes(notification.key)) continue;
      if (sent >= limit) { suppressed += 1; continue; }
      for (const chatId of config.chatIds) await client.sendMessage(chatId, notification.text);
      state = { ...state, notifiedKeys: [...state.notifiedKeys, notification.key] };
      sent += 1;
    }
  }
  if (suppressed > 0) {
    for (const chatId of config.chatIds) await client.sendMessage(chatId, `AxiomGate: ${suppressed} additional notifications suppressed for this watch session.`);
  }
  writeTelegramState(projectPath, state);
  return sent;
}

export async function watchTelegram(
  projectPath: string,
  config: TelegramConfig,
  client: TelegramClient,
  options: { readonly signal?: AbortSignal; readonly pollSeconds?: number; readonly once?: boolean } = {},
): Promise<TelegramRelayResult> {
  let totalCards = 0;
  let totalNotifications = 0;
  const failures: string[] = [];
  do {
    const cards = await sendPendingApprovalCards(projectPath, config, client);
    totalCards += cards.cardsSent;
    failures.push(...cards.failures);
    try { await reconcileApprovalCards(projectPath, config, client); }
    catch (error) { failures.push(safeFailure(error)); }
    if (totalNotifications < 20) {
      try {
        totalNotifications += await sendStageNotifications(
          projectPath,
          config,
          client,
          20 - totalNotifications,
        );
      } catch (error) { failures.push(safeFailure(error)); }
    }
    let state = readTelegramState(projectPath);
    try {
      const updates = await client.getUpdates(state.nextUpdateOffset, options.pollSeconds ?? 20);
      for (const update of updates) {
        await processTelegramUpdate(projectPath, config, client, update);
        state = { ...readTelegramState(projectPath), nextUpdateOffset: Math.max(state.nextUpdateOffset, update.update_id + 1) };
        writeTelegramState(projectPath, state);
      }
    } catch (error) { failures.push(safeFailure(error)); }
    if (options.once === true) break;
  } while (options.signal?.aborted !== true);
  return { cardsSent: totalCards, notificationsSent: totalNotifications, failures };
}
