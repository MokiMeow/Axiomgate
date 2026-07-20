import { readFileSync } from "node:fs";

const mission = Object.freeze(
  JSON.parse(readFileSync(new URL("../sample/mission.json", import.meta.url), "utf8")),
);
const capacity = Object.freeze(
  JSON.parse(readFileSync(new URL("../sample/capacity.json", import.meta.url), "utf8")),
);

export function hostedMission() {
  return structuredClone(mission);
}

export function hostedCapacity() {
  return structuredClone(capacity);
}

export function hostedMissionSummary() {
  return {
    id: mission.id,
    objective: mission.contract.objective,
    intentBoundary: mission.contract.intentBoundary,
    status: mission.contract.status,
    label: "SAMPLE",
    criteria: mission.contract.acceptanceCriteria.length,
    denials: mission.denials.length,
    pendingApprovals: 0,
  };
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=0, s-maxage=300");
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res, allowed = "GET") {
  res.setHeader("allow", allowed);
  sendJson(res, 405, { error: `method not allowed; use ${allowed}` });
}
