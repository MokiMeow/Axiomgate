import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  isAllowedDashboardOrigin,
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
    const publicDir = join("C:", "workspace", "public");
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
});
