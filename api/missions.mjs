import {
  hostedMissionSummary,
  methodNotAllowed,
  sendJson,
} from "../apps/web/hosting/demo-data.mjs";

export default function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  const mission = hostedMissionSummary();
  return sendJson(res, 200, {
    workspace: "hosted-demo",
    demo: true,
    count: 1,
    missions: [mission],
  });
}
