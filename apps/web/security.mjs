import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const MISSION_ID = /^msn_[A-Za-z0-9_-]+$/u;

export function isPathWithin(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function resolveStaticPath(publicDir, urlPath) {
  const key = urlPath.length > 1 ? urlPath.replace(/\/+$/, "") : urlPath;
  const candidate = resolve(publicDir, key.replace(/^\/+/, ""));
  return isPathWithin(publicDir, candidate) ? candidate : null;
}

export function resolveApprovalDirectory(missionsDir, missionId) {
  if (typeof missionId !== "string" || !MISSION_ID.test(missionId)) {
    return null;
  }
  const candidate = join(missionsDir, missionId, "approvals");
  return isPathWithin(missionsDir, candidate) ? candidate : null;
}

export function resolveMissionDirectory(missionsDir, missionId) {
  if (typeof missionId !== "string" || !MISSION_ID.test(missionId)) {
    return null;
  }
  const candidate = join(missionsDir, missionId);
  return isPathWithin(missionsDir, candidate) ? candidate : null;
}

export function validateApprovalIntent(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "request body must be an object" };
  }
  const { missionId, actionRequestId, decision } = body;
  if (typeof missionId !== "string" || !MISSION_ID.test(missionId)) {
    return { ok: false, reason: "invalid missionId" };
  }
  if (
    typeof actionRequestId !== "string" ||
    !/^act_[A-Za-z0-9_-]+$/u.test(actionRequestId)
  ) {
    return { ok: false, reason: "invalid actionRequestId" };
  }
  if (decision !== "approve" && decision !== "deny") {
    return { ok: false, reason: "decision must be approve or deny" };
  }
  return { ok: true, value: { missionId, actionRequestId, decision } };
}

export function isAllowedDashboardOrigin(origin, port) {
  if (origin === undefined) return true;
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      parsed.port === String(port)
    );
  } catch {
    return false;
  }
}

export function existingApprovalDirectory(missionsDir, missionId) {
  const dir = resolveApprovalDirectory(missionsDir, missionId);
  return dir !== null && existsSync(dir) ? dir : null;
}

export function applyDashboardApproval(missionDir, intent, mutations) {
  const options = { approver: "dashboard-user", surface: "dashboard" };
  const result =
    intent.decision === "approve"
      ? mutations.approve(missionDir, intent.actionRequestId, options)
      : mutations.deny(missionDir, intent.actionRequestId, options);
  if (result.status === "REJECTED") {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, status: result.status, record: result.record };
}

export function isPendingApproval(record, now = Date.now()) {
  return (
    record !== null &&
    typeof record === "object" &&
    record.status === "PENDING" &&
    typeof record.expiresAt === "string" &&
    Number.isFinite(Date.parse(record.expiresAt)) &&
    Date.parse(record.expiresAt) > now
  );
}
