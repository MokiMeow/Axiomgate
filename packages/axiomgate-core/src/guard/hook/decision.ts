import { createHash } from "node:crypto";

import { z } from "zod";

import { stableStringify } from "../../mission/index.js";
import { ActionRequestSchema, type ActionRequest } from "../action-request.js";
import {
  consumeApproval,
  createApprovalRequest,
} from "../approval-store.js";
import { evaluatePolicy } from "../policy/index.js";
import { classifyHookPayload } from "./classifier.js";
import type { HookConfigOptions } from "./config.js";
import {
  appendHookEvent,
  HookDecisionEventSchema,
  type HookDecisionEvent,
} from "./events.js";
import { verifyEnforcement, type MissionSnapshot } from "./snapshot.js";

const HookPayloadSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string().min(1),
  tool_name: z.string().min(1),
  tool_input: z.record(z.string(), z.unknown()),
  tool_use_id: z.string().min(1),
  cwd: z.string().min(1),
});

export type HookDecisionOutput =
  | {
      readonly hookSpecificOutput: {
        readonly hookEventName: string;
        readonly permissionDecision: "allow";
      };
    }
  | {
      readonly hookSpecificOutput: {
        readonly hookEventName: string;
        readonly permissionDecision: "deny";
        readonly permissionDecisionReason: string;
      };
    };

export interface ProcessHookOptions {
  readonly configOptions?: HookConfigOptions;
  readonly now?: () => Date;
}

export interface HookProcessResult {
  readonly output: HookDecisionOutput;
  readonly event: HookDecisionEvent;
  readonly request?: ActionRequest;
}

class HookRefusal extends Error {}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function parseGitHubRemote(url: string): { owner: string; repo: string } | undefined {
  const https = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/iu.exec(
    url,
  );
  const ssh = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/iu.exec(url);
  const match = https ?? ssh;
  return match === null
    ? undefined
    : { owner: match[1]!, repo: match[2]! };
}

function requestTarget(snapshot: MissionSnapshot) {
  if (snapshot.identity.gitRemotes.status !== "RESOLVED") {
    throw new HookRefusal("fail-closed: Git remote identity is unavailable");
  }

  const remote = snapshot.identity.gitRemotes.value
    .filter((entry) => entry.direction === "fetch")
    .map((entry) => parseGitHubRemote(entry.url))
    .find((entry) => entry !== undefined);
  if (remote === undefined) {
    throw new HookRefusal("fail-closed: GitHub target is unavailable");
  }

  return {
    type: "github_repo",
    owner: remote.owner,
    repo: remote.repo,
    verifiedOwnership: false,
    ...(snapshot.identity.vercelProject.status === "RESOLVED" &&
    snapshot.identity.vercelProject.value.projectName !== undefined
      ? { project: snapshot.identity.vercelProject.value.projectName }
      : {}),
  };
}

function actionRequest(
  snapshot: MissionSnapshot,
  payload: z.infer<typeof HookPayloadSchema>,
  classified: ReturnType<typeof classifyHookPayload>,
  now: Date,
): ActionRequest {
  if (snapshot.identity.githubLogin.status !== "RESOLVED") {
    throw new HookRefusal("fail-closed: GitHub identity is unavailable");
  }

  const commandHash = sha256(classified.command);
  const target = requestTarget(snapshot);
  const requestId = createHash("sha256")
    .update(
      stableStringify({
        missionId: snapshot.contract.id,
        semanticAction: classified.semanticAction,
        mechanism: classified.mechanism,
        commandHash,
        target,
      }),
      "utf8",
    )
    .digest("hex")
    .slice(0, 24);
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1_000).toISOString();

  return ActionRequestSchema.parse({
    id: `act_${requestId}`,
    missionId: snapshot.contract.id,
    semanticAction: classified.semanticAction,
    mechanism: classified.mechanism,
    target,
    identity: {
      githubLogin: snapshot.identity.githubLogin.value,
      ...(snapshot.identity.vercelUser.status === "RESOLVED"
        ? { vercelUser: snapshot.identity.vercelUser.value }
        : {}),
      source: snapshot.identity.githubLogin.source,
    },
    rawCommandHash: commandHash,
    intentBoundaryRequired: classified.intentBoundaryRequired,
    risk: classified.risk,
    rollback: classified.rollback,
    decision: "AWAITING_APPROVAL",
    requestedAt: now.toISOString(),
    expiresAt,
  });
}

function allowOutput(hookEventName: string): HookDecisionOutput {
  return {
    hookSpecificOutput: { hookEventName, permissionDecision: "allow" },
  };
}

function denyOutput(
  reasons: readonly string[],
  hookEventName: string,
): HookDecisionOutput {
  return {
    hookSpecificOutput: {
      hookEventName,
      permissionDecision: "deny",
      permissionDecisionReason: reasons.join("; "),
    },
  };
}

function looseMetadata(rawInput: string) {
  try {
    const value: unknown = JSON.parse(rawInput);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }
    const record = value as Record<string, unknown>;
    return {
      sessionId:
        typeof record.session_id === "string" ? record.session_id : undefined,
      hookEvent:
        typeof record.hook_event_name === "string"
          ? record.hook_event_name
          : undefined,
      toolName:
        typeof record.tool_name === "string" ? record.tool_name : undefined,
    };
  } catch {
    return {};
  }
}

export function processHookInvocation(
  rawInput: string,
  missionDir: string,
  options: ProcessHookOptions = {},
): HookProcessResult {
  const loose = looseMetadata(rawInput);
  let missionId = "unknown";
  let sessionId = loose.sessionId ?? "unknown";
  let hookEvent = loose.hookEvent ?? "unknown";
  let toolName = loose.toolName ?? "unknown";
  let commandHash = sha256("");
  let semanticAction = "UNKNOWN";
  let reasons: readonly string[] = ["fail-closed: hook decision unavailable"];
  let decision: "ALLOW" | "DENY" = "DENY";
  let request: ActionRequest | undefined;
  let timestamp = new Date().toISOString();

  try {
    let payload: z.infer<typeof HookPayloadSchema>;
    try {
      payload = HookPayloadSchema.parse(JSON.parse(rawInput));
    } catch {
      throw new HookRefusal("fail-closed: malformed hook input");
    }

    sessionId = payload.session_id;
    hookEvent = payload.hook_event_name;
    toolName = payload.tool_name;
    const classified = classifyHookPayload(payload);
    semanticAction = classified.semanticAction;
    commandHash = sha256(classified.command);
    const verified = verifyEnforcement(missionDir, options.configOptions);
    if (verified.status === "REFUSED") {
      throw new HookRefusal(
        `fail-closed: mission snapshot invalid: ${verified.reason}`,
      );
    }

    missionId = verified.snapshot.contract.id;
    const now = (options.now ?? (() => new Date()))();
    timestamp = now.toISOString();
    request = actionRequest(verified.snapshot, payload, classified, now);
    const evaluation = evaluatePolicy({
      policy: verified.snapshot.policy,
      missionBoundary: verified.snapshot.contract.intentBoundary,
      request,
      identity: verified.snapshot.identity,
    });
    reasons = evaluation.reasons;

    if (evaluation.decision === "ALLOW") {
      decision = "ALLOW";
    } else if (evaluation.decision === "REQUIRE_APPROVAL") {
      createApprovalRequest(missionDir, request, evaluation.reasons, {
        now: () => now,
      });
      const approval = consumeApproval(
        missionDir,
        request.id,
        request.rawCommandHash,
        { now: () => now },
      );
      if (approval.status === "CONSUMED") {
        decision = "ALLOW";
        reasons = [...evaluation.reasons, "single-use CLI approval consumed"];
      } else {
        reasons = [
          ...evaluation.reasons,
          approval.reason,
          `approval required - run: axiomgate approve ${request.id}`,
        ];
      }
    }
  } catch (error) {
    reasons = [
      error instanceof HookRefusal
        ? error.message
        : `fail-closed: internal hook error: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
    ];
    decision = "DENY";
  }

  let event = HookDecisionEventSchema.parse({
    source: "hook",
    ts: timestamp,
    hookEvent,
    toolName,
    commandHash,
    semanticAction,
    decision,
    reasons: [...reasons],
    missionId,
    sessionId,
  });
  let output =
    decision === "ALLOW"
      ? allowOutput(hookEvent)
      : denyOutput(reasons, hookEvent);

  try {
    appendHookEvent(missionDir, event);
  } catch (error) {
    reasons = [
      `fail-closed: event persistence failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    ];
    decision = "DENY";
    event = { ...event, decision, reasons: [...reasons] };
    output = denyOutput(reasons, hookEvent);
  }

  return { output, event, ...(request === undefined ? {} : { request }) };
}
