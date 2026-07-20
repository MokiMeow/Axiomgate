import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ActionRequestSchema,
  approve,
  consumeApproval,
  createMissionSnapshot,
  createTelegramClient,
  createApprovalRequest,
  escapeTelegramHtml,
  generateHookConfig,
  getApprovalRequest,
  hashContract,
  parseTelegramCallback,
  processTelegramUpdate,
  readTelegramConfig,
  readTelegramState,
  reconcileApprovalCards,
  renderApprovalCard,
  renderTelegramConfigSummary,
  sendPendingApprovalCards,
  sendStageNotifications,
  stageNotificationFromEvent,
  telegramActionLabel,
  telegramCallbackRef,
  telegramChatKey,
  watchTelegram,
  writeMissionSnapshot,
  writeTelegramState,
  type IdentityReport,
  type MissionContract,
  type TelegramClient,
  type TelegramConfig,
  type TelegramUpdate,
} from "../src/index.js";

const projects: string[] = [];
const NOW = "2026-07-20T10:00:00.000Z";
const CHAT = "123456789";
const GROUP = "-1009876543210";
const USER = "2468013579";
const HASH = `sha256:${"a".repeat(64)}`;

afterEach(() => {
  for (const project of projects.splice(0)) rmSync(project, { recursive: true, force: true });
});

function project(): string {
  const path = mkdtempSync(join(tmpdir(), "axiomgate-telegram-"));
  projects.push(path);
  return path;
}

function identity(): IdentityReport {
  return {
    githubLogin: { status: "RESOLVED", value: "mokimeow", source: "gh api user", confidence: "HIGH", capturedAt: NOW },
    gitRemotes: { status: "RESOLVED", value: [], source: "git remote -v", confidence: "HIGH", capturedAt: NOW },
    vercelUser: { status: "RESOLVED", value: "mokimeow", source: "vercel whoami", confidence: "HIGH", capturedAt: NOW },
    vercelProject: { status: "RESOLVED", value: { projectId: "prj_demo", orgId: "team_demo", projectName: "preview" }, source: ".vercel/project.json", confidence: "HIGH", capturedAt: NOW },
  };
}

function contract(objective = "Deploy a governed preview"): MissionContract {
  const draft = {
    id: "msn_telegram",
    version: 1,
    hash: `sha256:${"0".repeat(64)}`,
    objective,
    projectProfileId: "target-app",
    intentBoundary: "DEPLOY_PREVIEW" as const,
    acceptanceCriteria: [], constraints: [], nonGoals: [],
    actionPolicy: [{ action: "preview.deploy", decision: "REQUIRE_APPROVAL" as const }],
    modelPlan: [
      { phase: "build", model: "gpt-5.6-sol", effort: "high" as const, rationale: "fixture" },
      { phase: "remediate", model: "gpt-5.6-terra", effort: "medium" as const, rationale: "fixture" },
      { phase: "verify", model: "gpt-5.6-terra", effort: "high" as const, rationale: "fixture" },
    ],
    budgetPolicy: { reservePercent: 20 }, status: "ACTIVE", createdAt: NOW, updatedAt: NOW,
  };
  return { ...draft, hash: hashContract(draft) };
}

function setup(objective?: string, count = 1, displayCommand = "vercel deploy <hostile>& --name token-safe"): { projectPath: string; missionDir: string } {
  const projectPath = project();
  const missionDir = join(projectPath, ".axiomgate", "missions", "msn_telegram");
  const mission = contract(objective);
  const hook = generateHookConfig(missionDir, { cliEntryPath: "cli.js", nodePath: "node" });
  writeMissionSnapshot(missionDir, createMissionSnapshot({ contract: mission, policy: mission.actionPolicy, identity: identity(), hookConfigHash: hook.configHash }));
  for (let index = 0; index < count; index += 1) {
    const id = `act_preview_${index}`;
    createApprovalRequest(missionDir, ActionRequestSchema.parse({
      id, missionId: "msn_telegram", semanticAction: "preview.deploy", mechanism: "vercel_cli",
      target: { type: "vercel_project", owner: "mokimeow", repo: "AxiomGate", project: "preview", verifiedOwnership: true },
      identity: { githubLogin: "mokimeow", vercelUser: "mokimeow", source: "gh api user" },
      rawCommandHash: index === 0 ? HASH : `sha256:${String(index).padStart(64, "b").slice(-64)}`,
      intentBoundaryRequired: "DEPLOY_PREVIEW", risk: "high", rollback: "remove preview", decision: "AWAITING_APPROVAL",
      requestedAt: NOW, expiresAt: "2026-07-20T10:15:00.000Z",
    }), ["policy requires explicit approval"], { now: () => new Date(NOW), displayCommand, evidenceEventId: `ev_${id}` });
  }
  return { projectPath, missionDir };
}

function config(chatIds: readonly string[] = [CHAT], userIds?: readonly string[]): TelegramConfig {
  return {
    token: `${"123456"}:${"x".repeat(35)}`,
    chatIds,
    ...(userIds === undefined ? {} : { userIds }),
    notify: "all",
    notifyUsagePercent: 80,
    source: "environment",
  };
}

class FakeClient implements TelegramClient {
  readonly sent: Array<{ chatId: string; text: string; markup?: unknown; id: number }> = [];
  readonly edits: Array<{ chatId: string; id: number; text: string; markup?: unknown }> = [];
  readonly answers: string[] = [];
  updates: readonly TelegramUpdate[] = [];
  failSend = false;
  getMe = async () => ({ id: 1, is_bot: true, username: "axiom_fixture_bot" });
  sendMessage = async (chatId: string, text: string, markup?: unknown) => {
    if (this.failSend) throw new Error("network unavailable");
    const id = this.sent.length + 1;
    this.sent.push({ chatId, text, ...(markup === undefined ? {} : { markup }), id });
    return { message_id: id };
  };
  editMessageText = async (chatId: string, id: number, text: string, markup?: unknown) => {
    this.edits.push({ chatId, id, text, ...(markup === undefined ? {} : { markup }) });
  };
  answerCallbackQuery = async (_id: string, text?: string) => { this.answers.push(text ?? ""); };
  getUpdates = async () => this.updates;
}

async function sentCard(projectPath: string, client: FakeClient): Promise<{ ref: string; callback: TelegramUpdate }> {
  await sendPendingApprovalCards(projectPath, config(), client, { now: () => new Date(NOW) });
  const state = readTelegramState(projectPath);
  const ref = state.cards[0]!.ref;
  return { ref, callback: callbackUpdate(ref) };
}

function callbackUpdate(
  ref: string,
  options: {
    readonly chatId?: string;
    readonly chatType?: "private" | "group" | "supergroup" | "channel";
    readonly userId?: string;
    readonly verb?: "a" | "d" | "i";
  } = {},
): TelegramUpdate {
  return {
    update_id: 1,
    callback_query: {
      id: "cb_1",
      from: { id: options.userId ?? CHAT },
      data: `ag:${ref}:${options.verb ?? "a"}`,
      message: {
        message_id: 1,
        chat: {
          id: options.chatId ?? CHAT,
          type: options.chatType ?? "private",
        },
      },
    },
  };
}

describe("Telegram approval relay", () => {
  it("accepts an allowlisted private-chat callback and records the masked actor", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const { callback } = await sentCard(projectPath, client);
    await processTelegramUpdate(projectPath, config(), client, callback, { now: () => new Date("2026-07-20T10:01:00.000Z") });
    const record = getApprovalRequest(missionDir, "act_preview_0");
    expect(record?.status).toBe("APPROVED");
    expect(record?.approval).toMatchObject({
      surface: "telegram",
      singleUse: true,
      boundCommandHash: HASH,
      approver: "telegram:user=***6789;chat=private",
    });
    expect(client.edits[0]?.text).toContain("Approved once");
    expect(client.edits[0]?.text).not.toContain("sha256:");
    expect(client.edits[0]?.text).not.toMatch(/[\u2014\u2013]/u);
    const outcomeMarkup = client.edits[0]?.markup as { inline_keyboard: Array<Array<{ text: string }>> };
    expect(outcomeMarkup.inline_keyboard.flat().map((button) => button.text)).toEqual(["Details"]);
    await processTelegramUpdate(projectPath, config(), client, callback, { now: () => new Date("2026-07-20T10:02:00.000Z") });
    expect(client.answers.at(-1)).toContain("already decided");
  });

  it("rejects a group callback when no user allowlist is configured", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const groupConfig = config([GROUP]);
    await sendPendingApprovalCards(projectPath, groupConfig, client, { now: () => new Date(NOW) });
    const ref = readTelegramState(projectPath).cards[0]!.ref;
    await processTelegramUpdate(
      projectPath,
      groupConfig,
      client,
      callbackUpdate(ref, { chatId: GROUP, chatType: "group", userId: USER }),
    );
    expect(getApprovalRequest(missionDir, "act_preview_0")?.status).toBe("PENDING");
    expect(client.answers).toContain("approvals require a private chat or an allowlisted user");
    const log = readFileSync(join(projectPath, ".axiomgate", "telegram-events.jsonl"), "utf8");
    expect(log).toContain("private_chat_required");
    expect(log).not.toContain(GROUP);
    expect(log).not.toContain(USER);
  });

  it("accepts a matching allowlisted actor in an allowlisted group", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const groupConfig = config([GROUP], [USER]);
    await sendPendingApprovalCards(projectPath, groupConfig, client, { now: () => new Date(NOW) });
    const ref = readTelegramState(projectPath).cards[0]!.ref;
    await processTelegramUpdate(
      projectPath,
      groupConfig,
      client,
      callbackUpdate(ref, { chatId: GROUP, chatType: "group", userId: USER }),
      { now: () => new Date("2026-07-20T10:01:00.000Z") },
    );
    expect(getApprovalRequest(missionDir, "act_preview_0")?.approval?.approver).toBe(
      "telegram:user=***3579;chat=group",
    );
  });

  it("rejects a non-allowlisted actor even inside an allowlisted group", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const intruder = "1357924680";
    const groupConfig = config([GROUP], [USER]);
    await sendPendingApprovalCards(projectPath, groupConfig, client, { now: () => new Date(NOW) });
    const ref = readTelegramState(projectPath).cards[0]!.ref;
    await processTelegramUpdate(
      projectPath,
      groupConfig,
      client,
      callbackUpdate(ref, { chatId: GROUP, chatType: "group", userId: intruder }),
    );
    expect(getApprovalRequest(missionDir, "act_preview_0")?.status).toBe("PENDING");
    expect(client.answers).toContain("approvals require a private chat or an allowlisted user");
    const log = readFileSync(join(projectPath, ".axiomgate", "telegram-events.jsonl"), "utf8");
    expect(log).toContain("actor_not_allowlisted");
    expect(log).not.toContain(intruder);
    expect(log).not.toContain(USER);
  });

  it("edits an approved card to consumed with the stored run id", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const { callback } = await sentCard(projectPath, client);
    await processTelegramUpdate(projectPath, config(), client, callback, { now: () => new Date("2026-07-20T10:01:00.000Z") });
    expect(consumeApproval(missionDir, "act_preview_0", HASH, { now: () => new Date("2026-07-20T10:02:00.000Z") }).status).toBe("CONSUMED");
    mkdirSync(join(missionDir, "runs"), { recursive: true });
    writeFileSync(join(missionDir, "runs", "run_fixture.json"), JSON.stringify({ id: "run_fixture", startedAt: "2026-07-20T10:01:30.000Z", endedAt: "2026-07-20T10:02:30.000Z" }));
    await reconcileApprovalCards(projectPath, config(), client, { now: () => new Date("2026-07-20T10:03:00.000Z") });
    expect(client.edits.at(-1)?.text).toContain("Command consumed");
    expect(client.edits.at(-1)?.text).toContain("run_fixture");
    expect(client.edits.at(-1)?.text).not.toContain("sha256:");
  });

  it("denies through the canonical store", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const { ref, callback } = await sentCard(projectPath, client);
    const denyUpdate = { ...callback, callback_query: { ...callback.callback_query!, data: `ag:${ref}:d` } };
    await processTelegramUpdate(projectPath, config(), client, denyUpdate, { now: () => new Date("2026-07-20T10:01:00.000Z") });
    expect(getApprovalRequest(missionDir, "act_preview_0")).toMatchObject({
      status: "DENIED",
      deniedBy: "telegram:user=***6789;chat=private",
      deniedSurface: "telegram",
    });
  });

  it("renders every normative card field and sends redacted details", async () => {
    const { projectPath } = setup(); const client = new FakeClient();
    const { ref, callback } = await sentCard(projectPath, client);
    const card = client.sent[0]!;
    for (const field of ["Approval needed", "Mission", "Deploy a governed preview", "Action", "Deploy preview", "Target", "preview", "Identity", "mokimeow (Vercel)", "Workspace", "target-app", "Command", "Why approval is needed", "Risk", "Approval", "One use only", "bound to the exact command"]) {
      expect(card.text).toContain(field);
    }
    expect(card.text).not.toMatch(/[\u2014\u2013]/u);
    expect(card.text).not.toContain("sha256:");
    expect(card.text).not.toContain("msn_telegram");
    const markup = card.markup as { inline_keyboard: Array<Array<{ text: string }>> };
    expect(markup.inline_keyboard.flat().map((button) => button.text)).toEqual(["Approve once", "Deny", "Details"]);
    await processTelegramUpdate(projectPath, config(), client, { ...callback, callback_query: { ...callback.callback_query!, data: `ag:${ref}:i` } });
    const details = client.sent.at(-1)?.text ?? "";
    for (const field of ["Deploy a governed preview", "policy requires explicit approval", "Timing", "DEPLOY_PREVIEW", "target-app", "Audit reference", "msn_telegram", "act_preview_0"]) expect(details).toContain(field);
    expect(details).not.toContain(HASH);
    expect(details).not.toContain("sha256:");
    expect(details).not.toMatch(/[\u2014\u2013]/u);
  });

  it("expires without granting authority", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const { callback } = await sentCard(projectPath, client);
    await processTelegramUpdate(projectPath, config(), client, callback, { now: () => new Date("2026-07-20T10:16:00.000Z") });
    expect(getApprovalRequest(missionDir, "act_preview_0")?.status).toBe("PENDING");
    expect(client.edits[0]?.text).toContain("Expired");
  });

  it("sends and independently binds multiple pending approvals", async () => {
    const { projectPath } = setup(undefined, 2); const client = new FakeClient();
    const result = await sendPendingApprovalCards(projectPath, config(), client, { now: () => new Date(NOW) });
    expect(result.cardsSent).toBe(2);
    expect(new Set(readTelegramState(projectPath).cards.map((card) => card.ref)).size).toBe(2);
  });

  it("loses safely to a CLI decision race and does not double decide", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const { callback } = await sentCard(projectPath, client);
    approve(missionDir, "act_preview_0", { approver: "cli-user", now: () => new Date("2026-07-20T10:00:30.000Z") });
    await processTelegramUpdate(projectPath, config(), client, callback);
    expect(getApprovalRequest(missionDir, "act_preview_0")?.approval?.approver).toBe("cli-user");
    expect(client.answers[0]).toContain("already decided");
  });

  it("ignores an unauthorized forwarded callback and persists only a masked chat", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    const { callback } = await sentCard(projectPath, client);
    const intruder = "987654321";
    await processTelegramUpdate(projectPath, config(), client, { ...callback, callback_query: { ...callback.callback_query!, from: { id: intruder }, message: { message_id: 1, chat: { id: intruder, type: "private" } } } });
    expect(getApprovalRequest(missionDir, "act_preview_0")?.status).toBe("PENDING");
    const log = readFileSync(join(projectPath, ".axiomgate", "telegram-events.jsonl"), "utf8");
    expect(log).not.toContain(intruder); expect(log).toContain("***4321");
  });

  it("bounds send failure without changing the approval", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient(); client.failSend = true;
    const result = await sendPendingApprovalCards(projectPath, config(), client, { now: () => new Date(NOW) });
    expect(result.failures).toEqual(["network unavailable"]);
    expect(getApprovalRequest(missionDir, "act_preview_0")?.status).toBe("PENDING");
  });

  it("escapes hostile text and keeps callback data short", async () => {
    const { projectPath } = setup("<b>steal & destroy</b>"); const client = new FakeClient();
    await sendPendingApprovalCards(projectPath, config(), client, { now: () => new Date(NOW) });
    expect(client.sent[0]?.text).toContain("&lt;b&gt;steal &amp; destroy&lt;/b&gt;");
    expect(client.sent[0]?.text).not.toContain("<hostile>");
    const markup = client.sent[0]?.markup as { inline_keyboard: Array<Array<{ callback_data: string }>> };
    expect(Buffer.byteLength(markup.inline_keyboard[0]![0]!.callback_data)).toBeLessThanOrEqual(64);
  });

  it("truncates long display text while preserving the full bound hash", async () => {
    const { projectPath, missionDir } = setup("x".repeat(500)); const client = new FakeClient();
    await sendPendingApprovalCards(projectPath, config(), client, { now: () => new Date(NOW) });
    expect(client.sent[0]?.text).toContain("…");
    const record = getApprovalRequest(missionDir, "act_preview_0");
    expect(record?.request.rawCommandHash).toBe(HASH);
    expect(consumeApproval(missionDir, "act_preview_0", HASH).status).toBe("NOT_AUTHORIZED");
  });

  it("marks a redacted command without revealing the credential", async () => {
    const credential = `${"123456"}:${"q".repeat(35)}`;
    const { projectPath } = setup(undefined, 1, `deploy --token ${credential}`); const client = new FakeClient();
    await sendPendingApprovalCards(projectPath, config(), client, { now: () => new Date(NOW) });
    expect(client.sent[0]?.text).toContain("[redacted]");
    expect(client.sent[0]?.text).not.toContain(credential);
  });

  it("persists getUpdates offset so callbacks are not replayed", async () => {
    const { projectPath } = setup(); const client = new FakeClient();
    await sendPendingApprovalCards(projectPath, config(), client, { now: () => new Date(NOW) });
    const ref = readTelegramState(projectPath).cards[0]!.ref;
    client.updates = [{ update_id: 41, callback_query: { id: "cb", from: { id: CHAT }, data: `ag:${ref}:d`, message: { message_id: 1, chat: { id: CHAT, type: "private" } } } }];
    await watchTelegram(projectPath, config(), client, { once: true });
    expect(readTelegramState(projectPath).nextUpdateOffset).toBe(42);
  });
});

describe("Telegram rendering, configuration, and notifications", () => {
  it("defines semantic labels for all demo actions", () => {
    for (const action of ["repository.read", "file.modify", "branch.create", "pull_request.create", "preview.deploy", "production.deploy", "verification.run"]) {
      expect(telegramActionLabel(action)).not.toContain("Unknown");
    }
  });

  it("parses only allowlisted environment keys and masks configuration", () => {
    const token = `${"654321"}:${"z".repeat(35)}`;
    const result = readTelegramConfig({ cwd: project(), env: { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: `${CHAT},-${CHAT}`, TELEGRAM_USER_ID: `${USER},1357924680`, TELEGRAM_NOTIFY: "approvals" } });
    expect(result.status).toBe("CONFIGURED");
    expect(JSON.stringify(result).includes(token)).toBe(true);
    expect(result.status === "CONFIGURED" ? result.config.userIds : undefined).toEqual([USER, "1357924680"]);
    const summary = renderTelegramConfigSummary(result);
    expect(summary).toContain("users=***3579,***4680");
    expect(summary).not.toContain(token);
    expect(summary).not.toContain(USER);
    expect(escapeTelegramHtml("<&>\"")).toBe("&lt;&amp;&gt;&quot;");
  });

  it("reports private-only mode without exposing a token or full identifier", () => {
    const token = `${"654321"}:${"z".repeat(35)}`;
    const result = readTelegramConfig({ cwd: project(), env: { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: CHAT } });
    const summary = renderTelegramConfigSummary(result);
    expect(summary).toContain("users=private-only");
    expect(summary).not.toContain(token);
    expect(summary).not.toContain(CHAT);
  });

  it("rejects a malformed user allowlist instead of weakening actor checks", () => {
    const token = `${"654321"}:${"z".repeat(35)}`;
    const result = readTelegramConfig({
      cwd: project(),
      env: {
        TELEGRAM_BOT_TOKEN: token,
        TELEGRAM_CHAT_ID: CHAT,
        TELEGRAM_USER_ID: `${USER},not-a-user`,
      },
    });
    expect(result).toEqual({
      status: "UNAVAILABLE",
      reason: "TELEGRAM_USER_ID must be a comma-separated positive numeric allowlist",
    });
  });

  it("redacts token-shaped API failures and never persists credentials", async () => {
    const token = `${"123456"}:${"s".repeat(35)}`;
    const api = createTelegramClient({ ...config(), token }, { maxAttempts: 1, fetchImpl: async () => { throw new Error(`failed ${token}`); } });
    await expect(api.getMe()).rejects.not.toThrow(token);
  });

  it("bounds transient Telegram retries", async () => {
    let attempts = 0;
    const api = createTelegramClient(config(), {
      maxAttempts: 3,
      sleep: async () => undefined,
      fetchImpl: async () => {
        attempts += 1;
        return new Response(JSON.stringify({ ok: false, error_code: 503, description: "busy" }), { status: 503, headers: { "content-type": "application/json" } });
      },
    });
    await expect(api.getMe()).rejects.toThrow("busy");
    expect(attempts).toBe(3);
  });

  it("maps stage events, respects approvals-only, and deduplicates event keys", () => {
    const event = { type: "verification.completed", ts: NOW, missionId: "msn_telegram", message: "PASS" };
    expect(stageNotificationFromEvent(event, "approvals")).toBeUndefined();
    expect(stageNotificationFromEvent(event, "all")).toEqual(stageNotificationFromEvent(event, "all"));
    for (const type of ["hook.denied", "run.finished", "run.checkpoint", "remediation.completed", "proof.completed", "runway.reserve.warning", "runway.banked_reset.expiring", "runway.recommendation"]) {
      expect(stageNotificationFromEvent({ type, ts: NOW, missionId: "msn_telegram", message: "fixture" }, "all")?.text).toBeTruthy();
    }
    expect(stageNotificationFromEvent({ type: "runway.usage", ts: NOW, missionId: "msn_telegram", usedPercent: 79 }, "all", 80)).toBeUndefined();
    expect(stageNotificationFromEvent({ type: "runway.usage", ts: NOW, missionId: "msn_telegram", usedPercent: 80 }, "all", 80)?.text).toContain("80%");
  });

  it("renders readable real-workspace stage cards without hashes or dash-separated prose", () => {
    const context = {
      objective: "Add brute-force lockout to the login endpoint",
      workspace: "target-app-live",
      boundary: "MODIFY_LOCAL",
      modelPlan: contract().modelPlan,
    };
    const guard = stageNotificationFromEvent(
      {
        source: "hook",
        decision: "DENY",
        ts: NOW,
        missionId: "msn_telegram",
        semanticAction: "production.deploy",
        toolName: "Bash",
        commandHash: HASH,
        reasons: ["Production deployment is outside the mission boundary"],
      },
      "all",
      80,
      context,
    )!.text;
    expect(guard).toContain("Action blocked");
    expect(guard).toContain("Add brute-force lockout");
    expect(guard).toContain("target-app-live");
    expect(guard).toContain("Production deployment is outside");
    expect(guard).not.toContain(HASH);

    const verification = stageNotificationFromEvent(
      { type: "verification.completed", ts: NOW, missionId: "msn_telegram", status: "PASS", checkCount: 4, findingCount: 0 },
      "all",
      80,
      context,
    )!.text;
    expect(verification).toContain("Verification complete");
    expect(verification).toContain("gpt-5.6-terra / High");
    expect(verification).toContain("Required evidence was evaluated");

    const proof = stageNotificationFromEvent(
      { type: "proof.completed", ts: NOW, missionId: "msn_telegram", outcome: "COMPLETE", criteriaCount: 4, chainHead: HASH, outputRef: "C:/private/receipt.json" },
      "all",
      80,
      context,
    )!.text;
    expect(proof).toContain("Proof receipt ready");
    expect(proof).toContain("ready for offline integrity verification");
    expect(proof).not.toContain(HASH);
    expect(proof).not.toContain("C:/private");

    const run = stageNotificationFromEvent(
      {
        type: "run.finished",
        ts: NOW,
        missionId: "msn_telegram",
        status: "SUCCESS",
        model: "gpt-5.6-luna",
        effort: "light",
        inputTokens: 100,
        outputTokens: 5,
        runwayUsedPercent: 12,
        runwayRemainingPercent: 88,
        runwayResetsAt: "2026-07-25T03:25:05.000Z",
        runwayPlanType: "pro",
        bankedResetCount: 0,
        runwaySource: "codex-app-server/high",
      },
      "all",
      80,
      context,
    )!.text;
    for (const field of ["Run complete", "gpt-5.6-luna / light", "Used: <b>12%</b>", "Remaining: <b>88%</b>", "Banked resets: 0", "Plan: pro", "codex-app-server/high"]) {
      expect(run).toContain(field);
    }
    for (const text of [guard, verification, proof, run]) {
      expect(text).not.toMatch(/[\u2014\u2013]/u);
      expect(text).not.toContain("sha256:");
    }
  });

  it("deduplicates stage pushes and caps a watch-session batch at twenty", async () => {
    const { projectPath, missionDir } = setup(); const client = new FakeClient();
    for (let index = 0; index < 25; index += 1) {
      appendFileSync(join(missionDir, "events.jsonl"), `${JSON.stringify({ type: "proof.completed", ts: NOW, missionId: "msn_telegram", criteriaCount: index, chainHead: `sha256:${String(index).padStart(64, "a")}` })}\n`);
    }
    expect(await sendStageNotifications(projectPath, config(), client, 20)).toBe(20);
    expect(client.sent).toHaveLength(21);
    expect(client.sent.at(-1)?.text).toContain("5 additional notifications suppressed");
    const before = client.sent.length;
    expect(await sendStageNotifications(projectPath, config(), client, 20)).toBe(5);
    expect(client.sent.length - before).toBe(5);
    expect(await sendStageNotifications(projectPath, config(), client, 20)).toBe(0);
  });

  it("parses only bounded callback references and hashes chat identifiers", () => {
    const ref = telegramCallbackRef("msn_telegram", "act_preview_0");
    expect(parseTelegramCallback(`ag:${ref}:a`)).toEqual({ ref, verb: "a" });
    expect(parseTelegramCallback(`ag:${"x".repeat(70)}:a`)).toBeUndefined();
    expect(telegramChatKey(CHAT)).not.toContain(CHAT);
  });

  it("does not persist bot tokens in relay state", async () => {
    const { projectPath } = setup(); const client = new FakeClient(); const configured = config();
    await sendPendingApprovalCards(projectPath, configured, client, { now: () => new Date(NOW) });
    const persisted = readFileSync(join(projectPath, ".axiomgate", "telegram-state.json"), "utf8");
    expect(persisted).not.toContain(configured.token);
    expect(persisted).not.toContain(CHAT);
    writeTelegramState(projectPath, readTelegramState(projectPath));
  });
});
