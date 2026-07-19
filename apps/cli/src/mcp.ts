import { createInterface } from "node:readline";
import { userInfo } from "node:os";
import { resolve } from "node:path";

import {
  approve,
  currentCommit,
  deny,
  listMissionSummaries,
  listPending,
  loadMissionStatus,
  missionDirectory,
  resolveRunwayCapacity,
  verifyReceiptFile,
  type RunwayCapacity,
} from "@axiomgate/core";

type JsonRpcId = string | number | null;
type JsonObject = Readonly<Record<string, unknown>>;

interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: unknown;
}

interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

export interface McpServerDependencies {
  readonly currentRevision?: (project: string) => string;
  readonly runwayCapacity?: (project: string) => Promise<RunwayCapacity>;
  readonly actor?: () => string;
}

const PROTOCOL_VERSION = "2025-06-18";

export const AXIOMGATE_MCP_TOOLS = [
  {
    name: "axiomgate_mission_list",
    description: "List governed AxiomGate missions and their proof-gate outcomes.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { project: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "axiomgate_mission_status",
    description: "Read a mission proof table and completion-gate result from stored evidence.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        missionId: { type: "string" },
        project: { type: "string" },
      },
      required: ["missionId"],
      additionalProperties: false,
    },
  },
  {
    name: "axiomgate_receipt_verify",
    description: "Verify an AxiomGate Build Receipt offline, including its evidence hash chain.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { file: { type: "string" } },
      required: ["file"],
      additionalProperties: false,
    },
  },
  {
    name: "axiomgate_runway_status",
    description: "Read source-labelled Codex capacity without inventing unavailable values.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "axiomgate_approvals_list",
    description: "List unexpired pending approvals for a governed mission.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        missionId: { type: "string" },
        project: { type: "string" },
      },
      required: ["missionId"],
      additionalProperties: false,
    },
  },
  {
    name: "axiomgate_approve",
    description: "Record an auditable MCP approval or denial; the hook remains the enforcement point.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        approvalId: { type: "string" },
        missionId: { type: "string" },
        decision: { type: "string", enum: ["approve", "deny"] },
        project: { type: "string" },
      },
      required: ["approvalId", "missionId", "decision"],
      additionalProperties: false,
    },
  },
] as const;

function response(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function toolResult(value: unknown, isError = false): unknown {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function asObject(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function stringArgument(
  args: JsonObject,
  name: string,
  required = true,
): string | undefined {
  const value = args[name];
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function projectArgument(args: JsonObject): string {
  return resolve(stringArgument(args, "project", false) ?? process.cwd());
}

function statusProjection(project: string, missionId: string, revision: string) {
  const status = loadMissionStatus(project, missionId, { currentRevision: revision });
  return {
    mission: {
      id: status.contract.id,
      objective: status.contract.objective,
      boundary: status.contract.intentBoundary,
      contractHash: status.contract.hash,
      currentRevision: status.currentRevision,
    },
    criteria: status.gate.criteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      verdict: criterion.verdict,
      evidenceIds: criterion.evidenceIds,
      ...(criterion.waiver === undefined ? {} : { waiver: criterion.waiver }),
    })),
    gate: {
      outcome: status.gate.outcome,
      blockingReasons: status.gate.blockingReasons,
      permissionMismatches: status.gate.permissionMismatches,
    },
  };
}

async function callTool(
  name: string,
  rawArguments: unknown,
  dependencies: McpServerDependencies,
): Promise<unknown> {
  const args = asObject(rawArguments ?? {}, "arguments");
  const revision = dependencies.currentRevision ?? currentCommit;
  if (name === "axiomgate_mission_list") {
    const project = projectArgument(args);
    return listMissionSummaries(project, { currentRevision: revision(project) });
  }
  if (name === "axiomgate_mission_status") {
    const project = projectArgument(args);
    return statusProjection(project, stringArgument(args, "missionId")!, revision(project));
  }
  if (name === "axiomgate_receipt_verify") {
    return verifyReceiptFile(resolve(stringArgument(args, "file")!));
  }
  if (name === "axiomgate_runway_status") {
    return (dependencies.runwayCapacity ?? resolveRunwayCapacity)(process.cwd());
  }
  if (name === "axiomgate_approvals_list") {
    const project = projectArgument(args);
    return listPending(missionDirectory(project, stringArgument(args, "missionId")!));
  }
  if (name === "axiomgate_approve") {
    const project = projectArgument(args);
    const missionDir = missionDirectory(project, stringArgument(args, "missionId")!);
    const approvalId = stringArgument(args, "approvalId")!;
    const decision = stringArgument(args, "decision")!;
    if (decision !== "approve" && decision !== "deny") {
      throw new Error("decision must be approve or deny");
    }
    const actor = (dependencies.actor ?? (() => userInfo().username))();
    return decision === "approve"
      ? approve(missionDir, approvalId, { approver: actor, surface: "mcp" })
      : deny(missionDir, approvalId, { approver: actor, surface: "mcp" });
  }
  throw new Error(`unknown tool: ${name}`);
}

function parseRequest(value: unknown): JsonRpcRequest | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.jsonrpc !== "2.0" ||
    typeof candidate.method !== "string" ||
    (candidate.id !== undefined &&
      candidate.id !== null &&
      typeof candidate.id !== "string" &&
      typeof candidate.id !== "number")
  ) {
    return undefined;
  }
  return candidate as unknown as JsonRpcRequest;
}

export async function handleMcpMessage(
  value: unknown,
  dependencies: McpServerDependencies = {},
): Promise<JsonRpcResponse | undefined> {
  const request = parseRequest(value);
  if (request === undefined) return rpcError(null, -32600, "Invalid Request");
  const id = request.id ?? null;
  if (request.method === "notifications/initialized") return undefined;
  if (request.id === undefined) return undefined;
  if (request.method === "initialize") {
    return response(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "axiomgate", version: "0.0.0" },
      instructions: "Use AxiomGate tools to inspect governed mission evidence and record bounded approvals. Never claim completion unless the proof gate is COMPLETE.",
    });
  }
  if (request.method === "ping") return response(id, {});
  if (request.method === "tools/list") {
    return response(id, { tools: AXIOMGATE_MCP_TOOLS });
  }
  if (request.method === "tools/call") {
    try {
      const params = asObject(request.params, "params");
      const name = stringArgument(params, "name")!;
      return response(
        id,
        toolResult(await callTool(name, params.arguments, dependencies)),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown tool error";
      return response(id, toolResult({ error: message }, true));
    }
  }
  return rpcError(id, -32601, "Method not found", { method: request.method });
}

export async function runMcpServer(
  dependencies: McpServerDependencies = {},
): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim().length === 0) continue;
    let output: JsonRpcResponse | undefined;
    try {
      output = await handleMcpMessage(JSON.parse(line) as unknown, dependencies);
    } catch (error) {
      output = rpcError(
        null,
        -32700,
        "Parse error",
        error instanceof Error ? error.message : "invalid JSON",
      );
    }
    if (output !== undefined) process.stdout.write(`${JSON.stringify(output)}\n`);
  }
}
