import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import approveHandler from "../../../api/approve.mjs";
import capacityHandler from "../../../api/capacity.mjs";
import missionHandler from "../../../api/mission/[id].mjs";
import missionsHandler from "../../../api/missions.mjs";

function invoke(handler, { method = "GET", query = {} } = {}) {
  return new Promise((resolveResponse, reject) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      end(body = "") {
        try {
          resolveResponse({ status: this.statusCode, body: body ? JSON.parse(body) : null });
        } catch (error) {
          reject(error);
        }
      },
    };
    handler({ method, query }, res);
  });
}

const checks = [];
function check(name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  checks.push(`PASS ${name}: ${detail}`);
}

const landing = await readFile(resolve("apps/web/public/index.html"), "utf8");
const dashboard = await readFile(resolve("apps/web/public/dashboard/index.html"), "utf8");
check("GET /", landing.includes("AxiomGate"), "landing static entry found");
check("GET /dashboard", dashboard.includes("missionList"), "dashboard static entry found");

const missions = await invoke(missionsHandler);
check(
  "GET /api/missions",
  missions.status === 200 && missions.body.demo === true && missions.body.missions[0]?.label === "SAMPLE",
  "one explicitly labelled SAMPLE mission",
);

const detail = await invoke(missionHandler, { query: { id: "msn_demo_lockout" } });
check(
  "GET /api/mission/:id",
  detail.status === 200 && detail.body.receipt?.outcome === "COMPLETE",
  "curated mission and COMPLETE receipt returned",
);

const capacity = await invoke(capacityHandler);
check(
  "GET /api/capacity",
  capacity.status === 200 && capacity.body.source === "sample" && capacity.body.capacity?.label === "SAMPLE CAPACITY",
  "capacity is explicitly SAMPLE",
);

const approval = await invoke(approveHandler, { method: "POST" });
check(
  "POST /api/approve",
  approval.status === 409 && approval.body.ok === false,
  "hosted demo remains read-only",
);

console.log(checks.join("\n"));
