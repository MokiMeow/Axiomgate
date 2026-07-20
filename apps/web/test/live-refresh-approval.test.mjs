import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  approve,
  consumeApproval,
  createApprovalRequest,
  listPending,
} from "@axiomgate/core";
import {
  contentChanged,
  contentHash,
  resolvePollInterval,
} from "../public/refresh.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("canonical approval live refresh", () => {
  it("detects a Telegram/CLI-style approval consumption within one poll cycle", () => {
    const root = mkdtempSync(join(tmpdir(), "axiomgate-dashboard-refresh-"));
    roots.push(root);
    const missionDir = join(root, "msn_refresh_fixture");
    const now = new Date("2026-07-20T10:00:00.000Z");
    const commandHash = `sha256:${"a".repeat(64)}`;
    createApprovalRequest(
      missionDir,
      {
        id: "act_refresh_fixture",
        missionId: "msn_refresh_fixture",
        semanticAction: "pull_request.create",
        mechanism: "gh cli",
        target: {
          type: "github_repo",
          owner: "sample-owner",
          repo: "sample-refresh",
          verifiedOwnership: true,
          branch: "agent/refresh",
        },
        identity: { githubLogin: "sample-owner", source: "fixture" },
        rawCommandHash: commandHash,
        intentBoundaryRequired: "PUBLISH",
        risk: "medium",
        rollback: "Close the fixture pull request",
        decision: "AWAITING_APPROVAL",
        requestedAt: now.toISOString(),
        expiresAt: "2026-07-20T10:15:00.000Z",
      },
      ["Fixture policy requires one-time approval"],
      { now: () => now, ttlMs: 15 * 60 * 1_000 },
    );

    const before = { approvals: listPending(missionDir, { now: () => now }) };
    const beforeHash = contentHash(before);
    expect(before.approvals).toHaveLength(1);

    expect(
      approve(missionDir, "act_refresh_fixture", {
        approver: "telegram-user-…1234",
        surface: "telegram",
        now: () => new Date("2026-07-20T10:01:00.000Z"),
      }).status,
    ).toBe("APPROVED");
    expect(
      consumeApproval(missionDir, "act_refresh_fixture", commandHash, {
        now: () => new Date("2026-07-20T10:02:00.000Z"),
      }).status,
    ).toBe("CONSUMED");

    const after = {
      approvals: listPending(missionDir, {
        now: () => new Date("2026-07-20T10:02:00.000Z"),
      }),
    };
    expect(after.approvals).toHaveLength(0);
    expect(contentChanged(beforeHash, after).changed).toBe(true);
    expect(resolvePollInterval(undefined, false)).toBe(3_000);
  });
});
