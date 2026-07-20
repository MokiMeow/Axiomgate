import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { verifyBuildReceipt } from "@axiomgate/core";
import approveHandler from "../../../api/approve.mjs";
import capacityHandler from "../../../api/capacity.mjs";
import missionHandler from "../../../api/mission/[id].mjs";
import missionsHandler from "../../../api/missions.mjs";
import { hostedMission, hostedMissions } from "../hosting/demo-data.mjs";

function invoke(handler, { method = "GET", query = {} } = {}) {
  const headers = new Map();
  return new Promise((resolveResponse) => {
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        headers.set(name.toLowerCase(), value);
      },
      end(body = "") {
        resolveResponse({
          status: this.statusCode,
          headers,
          body: body ? JSON.parse(body) : null,
        });
      },
    };
    handler({ method, query }, res);
  });
}

describe("Vercel hosted demo surface", () => {
  it("serves the landing and dashboard static entry points", async () => {
    const landing = await readFile(resolve("apps/web/public/index.html"), "utf8");
    const dashboard = await readFile(
      resolve("apps/web/public/dashboard/index.html"),
      "utf8",
    );
    expect(landing).toContain("AxiomGate");
    expect(dashboard).toContain("missionList");
  });

  it("serves a clearly labelled, complete sample mission", async () => {
    const list = await invoke(missionsHandler);
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ demo: true, count: 8 });
    expect(list.body.missions[0]).toMatchObject({
      id: "msn_demo_lockout",
      label: "SAMPLE",
      status: "COMPLETE",
    });

    const detail = await invoke(missionHandler, {
      query: { id: "msn_demo_lockout" },
    });
    expect(detail.body.sampleNotice).toContain("DEMO DATA");
    expect(detail.body.receipt.outcome).toBe("COMPLETE");
    expect(detail.body.contract.acceptanceCriteria).toHaveLength(5);
    expect(detail.body.verifications.map((run) => run.overall)).toEqual([
      "FAIL",
      "PASS",
    ]);
    expect(detail.body.findings[0]).toMatchObject({
      package: "lodash",
      status: "resolved",
    });
  });

  it("ships eight internally consistent synthetic missions", () => {
    const missions = hostedMissions();
    expect(missions).toHaveLength(8);
    expect(new Set(missions.map((mission) => mission.id)).size).toBe(8);
    for (const mission of missions) {
      expect(mission.label).toBe("SAMPLE");
      expect(verifyBuildReceipt(mission.receipt)).toMatchObject({ valid: true });
      const verdicts = mission.receipt.criteria.map((criterion) => criterion.verdict);
      const allProven = verdicts.every((verdict) => verdict === "PASS" || verdict === "WAIVED");
      expect(mission.receipt.outcome === "COMPLETE").toBe(allProven);
      if (mission.contract.status === "COMPLETE") {
        expect(mission.receipt.outcome).toBe("COMPLETE");
      }
    }
    const blockedReceipt = hostedMission("msn_demo_rate_limit_gate").receipt;
    expect(blockedReceipt.outcome).toBe("INCOMPLETE");
    expect(blockedReceipt.criteria.some((criterion) => criterion.verdict === "UNVERIFIED")).toBe(true);
    const waivedReceipt = hostedMission("msn_demo_secret_waiver").receipt;
    expect(waivedReceipt.outcome).toBe("COMPLETE");
    expect(waivedReceipt.criteria.some((criterion) => criterion.verdict === "WAIVED")).toBe(true);
    expect(hostedMission("msn_demo_awaiting_approval").approvals).toHaveLength(1);
  });

  it("labels hosted capacity SAMPLE without a live-account claim", async () => {
    const response = await invoke(capacityHandler);
    expect(response).toMatchObject({
      status: 200,
      body: {
        demo: true,
        source: "sample",
        capacity: { kind: "sample", label: "SAMPLE CAPACITY", source: "sample" },
      },
    });
    expect(response.body.capacity).not.toHaveProperty("messageCount");
  });

  it("keeps hosted approvals read-only", async () => {
    const response = await invoke(approveHandler, { method: "POST" });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      demo: true,
      error: "Approvals are local-only in the hosted demo. Run the dashboard against a governed workspace to approve an action.",
    });
  });
});
