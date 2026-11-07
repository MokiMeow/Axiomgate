import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyDashboardApproval,
  isAllowedDashboardHost,
  isAllowedDashboardOrigin,
  isPendingApproval,
  isPathWithin,
  resolveApprovalDirectory,
  resolveStaticPath,
  validateApprovalIntent,
} from "../security.mjs";

describe("local dashboard security boundaries", () => {
  const root = join("C:", "workspace", ".axiomgate", "missions");

  it("confines valid mission approval paths to the missions directory", () => {
    const path = resolveApprovalDirectory(root, "msn_fixture_01");
    expect(path).not.toBeNull();
    expect(isPathWithin(root, path)).toBe(true);
  });

  it.each(["..", "../outside", "msn_a/../../../outside", "mission"]) (
    "rejects traversal-shaped mission id %s",
    (missionId) => {
      expect(resolveApprovalDirectory(root, missionId)).toBeNull();
    },
  );

  it("rejects static paths outside the public root, including sibling prefixes", () => {
    const publicDir = resolve("workspace", "public");
    expect(resolveStaticPath(publicDir, "/../public-secrets/token.txt")).toBeNull();
    expect(resolveStaticPath(publicDir, "/dashboard/index.html")).toBe(
      join(publicDir, "dashboard", "index.html"),
    );
  });

  it("requires an exact, typed approval intent", () => {
    expect(
      validateApprovalIntent({
        missionId: "msn_fixture",
        actionRequestId: "act_fixture",
        decision: "approve",
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateApprovalIntent({
        missionId: "../outside",
        actionRequestId: "act_fixture",
        decision: "approve",
      }),
    ).toEqual({ ok: false, reason: "invalid missionId" });
    expect(
      validateApprovalIntent({
        missionId: "msn_fixture",
        actionRequestId: "act_fixture",
        decision: "maybe",
      }),
    ).toEqual({ ok: false, reason: "decision must be approve or deny" });
  });

  it("accepts only same-port loopback browser origins", () => {
    expect(isAllowedDashboardOrigin(undefined, 4319)).toBe(true);
    expect(isAllowedDashboardOrigin("http://localhost:4319", 4319)).toBe(true);
    expect(isAllowedDashboardOrigin("http://127.0.0.1:4319", 4319)).toBe(true);
    expect(isAllowedDashboardOrigin("https://attacker.example", 4319)).toBe(false);
    expect(isAllowedDashboardOrigin("http://localhost:9999", 4319)).toBe(false);
  });

  it("accepts exact local Host headers including the default HTTP port", () => {
    expect(isAllowedDashboardHost("localhost:4319", 4319)).toBe(true);
    expect(isAllowedDashboardHost("LOCALHOST:4319", 4319)).toBe(true);
    expect(isAllowedDashboardHost("127.0.0.1:4319", 4319)).toBe(true);
    expect(isAllowedDashboardHost("localhost", 80)).toBe(true);
    expect(isAllowedDashboardHost("localhost:80", 80)).toBe(true);
    expect(isAllowedDashboardOrigin("http://localhost", 80)).toBe(true);
  });

  it.each([
    undefined, null, ["localhost:4319"], "", "localhost", "localhost:9999",
    "localhost:4319.attacker.example", "localhost.:4319", "127.1:4319",
    "2130706433:4319", "attacker.example:4319", "localhost:4319@attacker.example",
    "localhost:4319/path", "localhost:4319,attacker.example",
  ])("rejects untrusted or ambiguous Host %s", (host) => {
    expect(isAllowedDashboardHost(host, 4319)).toBe(false);
  });

  it.each([
    null, ["http://localhost:4319"], "null", "http://localhost:4319/",
    "http://user@localhost:4319", "http://localhost:4319?query",
    "http://localhost:4319#fragment", "http://127.1:4319",
    "http://2130706433:4319", "http://localhost:04319", "https://localhost:4319",
  ])("rejects non-serialized or untrusted Origin %s", (origin) => {
    expect(isAllowedDashboardOrigin(origin, 4319)).toBe(false);
  });

  it("routes web decisions through the canonical approval mutations", () => {
    const calls = [];
    const mutations = {
      approve: (...args) => {
        calls.push(["approve", ...args]);
        return { status: "APPROVED", record: { id: "apr_fixture" } };
      },
      deny: () => ({ status: "DENIED", record: { id: "apr_denied" } }),
    };
    expect(
      applyDashboardApproval(
        "C:/workspace/.axiomgate/missions/msn_fixture",
        {
          missionId: "msn_fixture",
          actionRequestId: "act_fixture",
          decision: "approve",
        },
        mutations,
      ),
    ).toMatchObject({ ok: true, status: "APPROVED" });
    expect(calls).toEqual([
      [
        "approve",
        "C:/workspace/.axiomgate/missions/msn_fixture",
        "act_fixture",
        { approver: "dashboard-user", surface: "dashboard" },
      ],
    ]);
  });

  it("does not report success when the canonical store rejects a request", () => {
    expect(
      applyDashboardApproval(
        "C:/workspace/.axiomgate/missions/msn_fixture",
        {
          missionId: "msn_fixture",
          actionRequestId: "act_fixture",
          decision: "approve",
        },
        {
          approve: () => ({ status: "REJECTED", reason: "approval request expired" }),
          deny: () => ({ status: "REJECTED", reason: "unused" }),
        },
      ),
    ).toEqual({ ok: false, reason: "approval request expired" });
  });

  it("shows only active pending approvals", () => {
    const now = Date.parse("2026-07-20T10:00:00.000Z");
    expect(
      isPendingApproval(
        { status: "PENDING", expiresAt: "2026-07-20T10:01:00.000Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isPendingApproval(
        { status: "APPROVED", expiresAt: "2026-07-20T10:01:00.000Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isPendingApproval(
        { status: "DENIED", expiresAt: "2026-07-20T10:01:00.000Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isPendingApproval(
        { status: "PENDING", expiresAt: "2026-07-20T09:59:00.000Z" },
        now,
      ),
    ).toBe(false);
  });
});
