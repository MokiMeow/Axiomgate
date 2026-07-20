import { readFileSync } from "node:fs";

const missions = Object.freeze(
  JSON.parse(readFileSync(new URL("../sample/missions.json", import.meta.url), "utf8")),
);
const capacity = Object.freeze(
  JSON.parse(readFileSync(new URL("../sample/capacity.json", import.meta.url), "utf8")),
);

export function hostedMissions() {
  return structuredClone(missions);
}

export function hostedCapacity() {
  return structuredClone(capacity);
}

export function hostedMission(id) {
  const mission = missions.find((candidate) => candidate.id === id);
  return mission === undefined ? null : structuredClone(mission);
}

export function hostedMissionSummary(mission) {
  return {
    id: mission.id,
    objective: mission.contract.objective,
    intentBoundary: mission.contract.intentBoundary,
    status: mission.contract.status,
    label: "SAMPLE",
    criteria: mission.contract.acceptanceCriteria.length,
    denials: mission.denials.length,
    pendingApprovals: mission.approvals.length,
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
