import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ActionRequestSchema,
  ApprovalRequestRecordSchema,
  approve,
  consumeApproval,
  createApprovalRequest,
  deny,
  listPending,
} from "../src/index.js";

const directories: string[] = [];
const NOW = "2026-07-15T15:00:00.000Z";
const COMMAND_HASH = `sha256:${"a".repeat(64)}`;

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function missionDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "axiomgate-approval-"));
  directories.push(directory);
  return directory;
}

function actionRequest(id = "act_preview", hash = COMMAND_HASH) {
  return ActionRequestSchema.parse({
    id,
    missionId: "msn_hook",
    semanticAction: "preview.deploy",
    mechanism: "vercel_cli",
    target: {
      type: "github_repo",
      owner: "mokimeow",
      repo: "AxiomGate",
      project: "axiomgate-preview",
      verifiedOwnership: true,
    },
    identity: {
      githubLogin: "mokimeow",
      vercelUser: "mokimeow",
      source: "gh api user",
    },
    rawCommandHash: hash,
    intentBoundaryRequired: "DEPLOY_PREVIEW",
    risk: "high",
    rollback: "remove preview deployment",
    decision: "AWAITING_APPROVAL",
    requestedAt: NOW,
    expiresAt: "2026-07-15T15:15:00.000Z",
  });
}

describe("approval file flow", () => {
  it("consumes an exact bound command once and records consumedAt", () => {
    const directory = missionDir();
    createApprovalRequest(directory, actionRequest(), ["approval required"], {
      now: () => new Date(NOW),
    });
    expect(
      approve(directory, "act_preview", {
        approver: "fixture-user",
        now: () => new Date("2026-07-15T15:01:00.000Z"),
      }).status,
    ).toBe("APPROVED");

    expect(
      consumeApproval(directory, "act_preview", COMMAND_HASH, {
        now: () => new Date("2026-07-15T15:02:00.000Z"),
      }).status,
    ).toBe("CONSUMED");
    const record = ApprovalRequestRecordSchema.parse(
      JSON.parse(
        readFileSync(
          join(directory, "approvals", "act_preview.json"),
          "utf8",
        ),
      ),
    );
    expect(record.approval?.consumedAt).toBe("2026-07-15T15:02:00.000Z");

    expect(
      consumeApproval(directory, "act_preview", COMMAND_HASH, {
        now: () => new Date("2026-07-15T15:03:00.000Z"),
      }).status,
    ).toBe("NOT_AUTHORIZED");
  });

  it("rejects a mutated command hash without consuming approval", () => {
    const directory = missionDir();
    createApprovalRequest(directory, actionRequest(), ["approval required"], {
      now: () => new Date(NOW),
    });
    approve(directory, "act_preview", {
      approver: "fixture-user",
      now: () => new Date("2026-07-15T15:01:00.000Z"),
    });

    const result = consumeApproval(
      directory,
      "act_preview",
      `sha256:${"b".repeat(64)}`,
      { now: () => new Date("2026-07-15T15:02:00.000Z") },
    );
    expect(result.status).toBe("NOT_AUTHORIZED");
    expect(result.reason).toContain("hash");
  });

  it("rejects an expired approval", () => {
    const directory = missionDir();
    createApprovalRequest(directory, actionRequest(), ["approval required"], {
      now: () => new Date(NOW),
      ttlMs: 1_000,
    });
    approve(directory, "act_preview", {
      approver: "fixture-user",
      now: () => new Date("2026-07-15T15:00:00.500Z"),
    });

    expect(
      consumeApproval(directory, "act_preview", COMMAND_HASH, {
        now: () => new Date("2026-07-15T15:00:02.000Z"),
      }).status,
    ).toBe("NOT_AUTHORIZED");
  });

  it("rejects an approval for another action request", () => {
    const directory = missionDir();
    createApprovalRequest(directory, actionRequest(), ["approval required"], {
      now: () => new Date(NOW),
    });
    approve(directory, "act_preview", {
      approver: "fixture-user",
      now: () => new Date("2026-07-15T15:01:00.000Z"),
    });

    expect(
      consumeApproval(directory, "act_other", COMMAND_HASH, {
        now: () => new Date("2026-07-15T15:02:00.000Z"),
      }).status,
    ).toBe("NOT_AUTHORIZED");
  });

  it("lists pending requests and removes an explicitly denied request", () => {
    const directory = missionDir();
    createApprovalRequest(directory, actionRequest(), ["preview needs approval"], {
      now: () => new Date(NOW),
    });
    expect(listPending(directory, { now: () => new Date(NOW) })).toHaveLength(1);

    expect(
      deny(directory, "act_preview", {
        approver: "fixture-user",
        now: () => new Date("2026-07-15T15:01:00.000Z"),
      }).status,
    ).toBe("DENIED");
    expect(listPending(directory, { now: () => new Date(NOW) })).toHaveLength(0);
  });
});
