import {
  hostedMissions,
  hostedMissionSummary,
  methodNotAllowed,
  sendJson,
} from "../apps/web/hosting/demo-data.mjs";

export default function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  const missions = hostedMissions();
  return sendJson(res, 200, {
    workspace: "hosted-demo",
    demo: true,
    count: missions.length,
    missions: missions.map(hostedMissionSummary),
  });
}
