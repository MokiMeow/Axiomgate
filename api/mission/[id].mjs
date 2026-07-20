import {
  hostedMission,
  methodNotAllowed,
  sendJson,
} from "../../apps/web/hosting/demo-data.mjs";

export default function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  const requestedId = Array.isArray(req.query?.id)
    ? req.query.id[0]
    : req.query?.id;
  const mission = hostedMission(requestedId);
  if (mission === null) {
    return sendJson(res, 404, { error: "sample mission not found" });
  }
  return sendJson(res, 200, mission);
}
