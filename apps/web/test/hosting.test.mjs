import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { verifyBuildReceipt } from "@axiomgate/core";
import approveHandler from "../../../api/approve.mjs";
import capacityHandler from "../../../api/capacity.mjs";
import missionHandler from "../../../api/mission/[id].mjs";
import missionsHandler from "../../../api/missions.mjs";
import { hostedMission } from "../hosting/demo-data.mjs";

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
    expect(list).toMatchObject({
      status: 200,
      body: {
        demo: true,
        count: 1,
        missions: [{ id: "msn_demo_lockout", label: "SAMPLE", status: "COMPLETE" }],
      },
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

  it("ships an intact synthetic receipt hash chain", () => {
    expect(verifyBuildReceipt(hostedMission().receipt)).toMatchObject({
      valid: true,
    });
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
