import { methodNotAllowed, sendJson } from "../apps/web/hosting/demo-data.mjs";

export default function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  return sendJson(res, 409, {
    ok: false,
    demo: true,
    error: "Approvals are local-only in the hosted demo. Run the dashboard against a governed workspace to approve an action.",
  });
}
