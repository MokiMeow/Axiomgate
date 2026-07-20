import {
  hostedCapacity,
  methodNotAllowed,
  sendJson,
} from "../apps/web/hosting/demo-data.mjs";

export default function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  return sendJson(res, 200, {
    capacity: hostedCapacity(),
    source: "sample",
    demo: true,
  });
}
