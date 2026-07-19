import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createApprovalRequest,
  createMission,
  listPending,
  missionDirectory,
  writeMissionReceipt,
  type CommandResult,
  type IdentityReport,
} from "@axiomgate/core";
import {
  AXIOMGATE_MCP_TOOLS,
  handleMcpMessage,
} from "../src/mcp.js";

function identity(): IdentityReport {
  const capturedAt = "2026-07-19T12:00:00.000Z";
  return {
    githubLogin: {
      status: "RESOLVED",
      value: "fixture-user",
      source: "gh api user",
      confidence: "HIGH",
      capturedAt,
    },
    gitRemotes: {
      status: "RESOLVED",
      value: [],
      source: "git remote -v",
      confidence: "HIGH",
      capturedAt,
    },
    vercelUser: {
      status: "UNAVAILABLE",
      source: "vercel whoami",
      reason: "fixture",
      capturedAt,
    },
    vercelProject: {
      status: "UNAVAILABLE",
      source: ".vercel/project.json",
      reason: "fixture",
      capturedAt,
    },
  };
}

function commandResult(command: string, args: readonly string[]): CommandResult {
  return {
    command,
    args,
    status: "SUCCESS",
    exitCode: 0,
    stdout: command === "git" && args[0] === "branch" ? "main\n" : "fixture\n",
    stderr: "",
    durationMs: 1,
  };
}

function toolPayload(response: Awaited<ReturnType<typeof handleMcpMessage>>): unknown {
  const result = response?.result as { content?: { text?: string }[] } | undefined;
  return JSON.parse(result?.content?.[0]?.text ?? "null") as unknown;
}

describe("AxiomGate MCP protocol", () => {
  it("handshakes, lists six tools, and rejects malformed requests without throwing", async () => {
    const initialized = await handleMcpMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    });
    expect(initialized?.result).toMatchObject({
      protocolVersion: "2025-06-18",
      serverInfo: { name: "axiomgate" },
    });

    const listed = await handleMcpMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    expect((listed?.result as { tools: unknown[] }).tools).toHaveLength(6);
    expect(AXIOMGATE_MCP_TOOLS.map((tool) => tool.name)).toContain(
      "axiomgate_receipt_verify",
    );
    expect(
      AXIOMGATE_MCP_TOOLS.find((tool) => tool.name === "axiomgate_mission_status")
        ?.annotations.readOnlyHint,
    ).toBe(true);

    const malformed = await handleMcpMessage({ nope: true });
    expect(malformed?.error).toMatchObject({ code: -32600 });
  });

  it("reuses mission, receipt, runway, and approval core paths", async () => {
    const project = mkdtempSync(join(tmpdir(), "axiomgate-mcp-"));
    try {
      const created = createMission(
        project,
        { objective: "Prove MCP governance state" },
        {
          id: "msn_mcp_fixture",
          now: () => new Date("2026-07-19T12:00:00.000Z"),
          resolveIdentity: identity,
          hookConfigOptions: {
            cliEntryPath: join(project, "cli.js"),
            nodePath: process.execPath,
          },
        },
      );
      const dependencies = {
        currentRevision: () => "HEAD",
        actor: () => "mcp-fixture",
        runwayCapacity: async () => ({ status: "UNKNOWN" as const, reason: "fixture" }),
      };
      const missionList = await handleMcpMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "axiomgate_mission_list",
          arguments: { project },
        },
      }, dependencies);
      expect(toolPayload(missionList)).toEqual([
        expect.objectContaining({ id: created.contract.id, gate: "INCOMPLETE" }),
      ]);

      const status = await handleMcpMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "axiomgate_mission_status",
          arguments: { project, missionId: created.contract.id },
        },
      }, dependencies);
      expect(toolPayload(status)).toMatchObject({
        mission: { id: created.contract.id },
        gate: { outcome: "INCOMPLETE" },
      });

      const receipt = writeMissionReceipt(project, created.contract.id, "json", {
        currentRevision: "HEAD",
        now: () => new Date("2026-07-19T12:05:00.000Z"),
        runner: commandResult,
      });
      const verified = await handleMcpMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "axiomgate_receipt_verify",
          arguments: { file: receipt.path },
        },
      }, dependencies);
      expect(toolPayload(verified)).toMatchObject({ valid: true });

      const runway = await handleMcpMessage({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "axiomgate_runway_status", arguments: {} },
      }, dependencies);
      expect(toolPayload(runway)).toEqual({ status: "UNKNOWN", reason: "fixture" });

      createApprovalRequest(
        created.missionDir,
        {
          id: "act_mcp_fixture",
          missionId: created.contract.id,
          semanticAction: "preview.deploy",
          mechanism: "vercel_cli",
          target: {
            type: "vercel_project",
            owner: "fixture-user",
            repo: "fixture",
            project: "fixture-preview",
            verifiedOwnership: true,
          },
          identity: {
            githubLogin: "fixture-user",
            source: "fixture",
          },
          rawCommandHash: `sha256:${"a".repeat(64)}`,
          intentBoundaryRequired: "DEPLOY_PREVIEW",
          risk: "high",
          rollback: "remove preview",
          decision: "AWAITING_APPROVAL",
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
        ["fixture approval"],
      );
      const approved = await handleMcpMessage({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "axiomgate_approve",
          arguments: {
            project,
            missionId: created.contract.id,
            approvalId: "act_mcp_fixture",
            decision: "approve",
          },
        },
      }, dependencies);
      expect(toolPayload(approved)).toMatchObject({
        status: "APPROVED",
        record: { approval: { surface: "mcp", approver: "mcp-fixture" } },
      });
      expect(listPending(missionDirectory(project, created.contract.id))).toHaveLength(0);
      expect(
        JSON.parse(
          readFileSync(join(created.missionDir, "approvals", "act_mcp_fixture.json"), "utf8"),
        ),
      ).toMatchObject({ approval: { surface: "mcp" } });

      createApprovalRequest(
        created.missionDir,
        {
          id: "act_mcp_deny",
          missionId: created.contract.id,
          semanticAction: "pull_request.create",
          mechanism: "gh_cli",
          target: {
            type: "github_repo",
            owner: "fixture-user",
            repo: "fixture",
            verifiedOwnership: true,
          },
          identity: { githubLogin: "fixture-user", source: "fixture" },
          rawCommandHash: `sha256:${"b".repeat(64)}`,
          intentBoundaryRequired: "PUBLISH",
          risk: "high",
          rollback: "close pull request",
          decision: "AWAITING_APPROVAL",
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
        ["fixture denial"],
      );
      const denied = await handleMcpMessage({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "axiomgate_approve",
          arguments: {
            project,
            missionId: created.contract.id,
            approvalId: "act_mcp_deny",
            decision: "deny",
          },
        },
      }, dependencies);
      expect(toolPayload(denied)).toMatchObject({
        status: "DENIED",
        record: { deniedSurface: "mcp", deniedBy: "mcp-fixture" },
      });
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
