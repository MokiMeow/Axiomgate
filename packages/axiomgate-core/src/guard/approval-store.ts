import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { IsoDateTimeSchema } from "../mission/index.js";
import { ActionRequestSchema, type ActionRequest } from "./action-request.js";
import {
  ApprovalSchema,
  ApprovalSurfaceSchema,
  type Approval,
} from "./approval.js";

const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1_000;
const REQUEST_ID_PATTERN = /^act_[A-Za-z0-9_-]+$/u;

export const ApprovalRequestRecordSchema = z.strictObject({
  request: ActionRequestSchema,
  reasons: z.array(z.string().min(1)).min(1),
  status: z.enum(["PENDING", "APPROVED", "DENIED"]),
  createdAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  approval: ApprovalSchema.nullable(),
  deniedAt: IsoDateTimeSchema.nullable(),
  deniedBy: z.string().min(1).nullable(),
  deniedSurface: ApprovalSurfaceSchema.nullable().optional(),
});

export type ApprovalRequestRecord = z.infer<
  typeof ApprovalRequestRecordSchema
>;

interface ClockOptions {
  readonly now?: () => Date;
}

interface CreateApprovalOptions extends ClockOptions {
  readonly ttlMs?: number;
}

interface ApprovalActorOptions extends ClockOptions {
  readonly approver: string;
  readonly surface?: Approval["surface"];
}

export type ApprovalMutationResult =
  | {
      readonly status: "APPROVED" | "DENIED";
      readonly record: ApprovalRequestRecord;
    }
  | { readonly status: "REJECTED"; readonly reason: string };

export type ApprovalConsumptionResult =
  | { readonly status: "CONSUMED"; readonly record: ApprovalRequestRecord }
  | { readonly status: "NOT_AUTHORIZED"; readonly reason: string };

function approvalsDirectory(missionDir: string): string {
  return join(missionDir, "approvals");
}

function assertRequestId(requestId: string): void {
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new Error("invalid action request id");
  }
}

function recordPath(missionDir: string, requestId: string): string {
  assertRequestId(requestId);
  return join(approvalsDirectory(missionDir), `${requestId}.json`);
}

function readRecord(missionDir: string, requestId: string): ApprovalRequestRecord {
  return ApprovalRequestRecordSchema.parse(
    JSON.parse(readFileSync(recordPath(missionDir, requestId), "utf8")),
  );
}

function writeRecord(
  missionDir: string,
  requestId: string,
  record: ApprovalRequestRecord,
): void {
  writeFileSync(
    recordPath(missionDir, requestId),
    `${JSON.stringify(ApprovalRequestRecordSchema.parse(record), null, 2)}\n`,
    "utf8",
  );
}

function withRecordLock<T>(
  missionDir: string,
  requestId: string,
  operation: () => T,
): T {
  assertRequestId(requestId);
  mkdirSync(approvalsDirectory(missionDir), { recursive: true });
  const lockPath = join(approvalsDirectory(missionDir), `${requestId}.lock`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(lockPath, "wx");
    return operation();
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
      rmSync(lockPath, { force: true });
    }
  }
}

function rejectionReason(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "approval record unavailable";
}

function pendingRecord(
  request: ActionRequest,
  reasons: readonly string[],
  now: Date,
  ttlMs: number,
): ApprovalRequestRecord {
  return ApprovalRequestRecordSchema.parse({
    request,
    reasons: [...reasons],
    status: "PENDING",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    approval: null,
    deniedAt: null,
    deniedBy: null,
    deniedSurface: null,
  });
}

export function createApprovalRequest(
  missionDir: string,
  request: ActionRequest,
  reasons: readonly string[],
  options: CreateApprovalOptions = {},
): ApprovalRequestRecord {
  assertRequestId(request.id);
  mkdirSync(approvalsDirectory(missionDir), { recursive: true });
  const path = recordPath(missionDir, request.id);
  const now = (options.now ?? (() => new Date()))();
  const ttlMs = options.ttlMs ?? DEFAULT_APPROVAL_TTL_MS;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("approval TTL must be positive");
  }
  if (existsSync(path)) {
    return withRecordLock(missionDir, request.id, () => {
      const existing = readRecord(missionDir, request.id);
      const active = Date.parse(existing.expiresAt) > now.getTime();
      const isReusable =
        (existing.status === "PENDING" && active) ||
        (existing.status === "APPROVED" &&
          active &&
          existing.approval?.consumedAt === null) ||
        existing.status === "DENIED";
      if (isReusable) {
        return existing;
      }

      const renewed = pendingRecord(request, reasons, now, ttlMs);
      writeRecord(missionDir, request.id, renewed);
      return renewed;
    });
  }

  const record = pendingRecord(request, reasons, now, ttlMs);

  try {
    writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    return record;
  } catch (error) {
    if (existsSync(path)) {
      return readRecord(missionDir, request.id);
    }
    throw error;
  }
}

export function listPending(
  missionDir: string,
  options: ClockOptions = {},
): ApprovalRequestRecord[] {
  const directory = approvalsDirectory(missionDir);
  if (!existsSync(directory)) {
    return [];
  }
  const now = (options.now ?? (() => new Date()))().getTime();
  return readdirSync(directory)
    .filter((name) => /^act_[A-Za-z0-9_-]+\.json$/u.test(name))
    .map((name) =>
      ApprovalRequestRecordSchema.parse(
        JSON.parse(readFileSync(join(directory, name), "utf8")),
      ),
    )
    .filter(
      (record) =>
        record.status === "PENDING" && Date.parse(record.expiresAt) > now,
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function approve(
  missionDir: string,
  requestId: string,
  options: ApprovalActorOptions,
): ApprovalMutationResult {
  try {
    return withRecordLock(missionDir, requestId, () => {
      const record = readRecord(missionDir, requestId);
      const now = (options.now ?? (() => new Date()))();
      if (record.status !== "PENDING") {
        return {
          status: "REJECTED",
          reason: `request is ${record.status.toLowerCase()}`,
        };
      }
      if (Date.parse(record.expiresAt) <= now.getTime()) {
        return { status: "REJECTED", reason: "approval request expired" };
      }

      const approved = ApprovalRequestRecordSchema.parse({
        ...record,
        status: "APPROVED",
        approval: {
          id: `apr_${requestId.slice(4)}`,
          actionRequestId: requestId,
          boundCommandHash: record.request.rawCommandHash,
          surface: options.surface ?? "cli",
          approver: options.approver,
          singleUse: true,
          grantedAt: now.toISOString(),
          expiresAt: record.expiresAt,
          consumedAt: null,
        },
      });
      writeRecord(missionDir, requestId, approved);
      return { status: "APPROVED", record: approved };
    });
  } catch (error) {
    return { status: "REJECTED", reason: rejectionReason(error) };
  }
}

export function deny(
  missionDir: string,
  requestId: string,
  options: ApprovalActorOptions,
): ApprovalMutationResult {
  try {
    return withRecordLock(missionDir, requestId, () => {
      const record = readRecord(missionDir, requestId);
      if (record.status !== "PENDING") {
        return {
          status: "REJECTED",
          reason: `request is ${record.status.toLowerCase()}`,
        };
      }
      const now = (options.now ?? (() => new Date()))();
      const denied = ApprovalRequestRecordSchema.parse({
        ...record,
        status: "DENIED",
        deniedAt: now.toISOString(),
        deniedBy: options.approver,
        deniedSurface: options.surface ?? "cli",
      });
      writeRecord(missionDir, requestId, denied);
      return { status: "DENIED", record: denied };
    });
  } catch (error) {
    return { status: "REJECTED", reason: rejectionReason(error) };
  }
}

export function consumeApproval(
  missionDir: string,
  actionRequestId: string,
  commandHash: string,
  options: ClockOptions = {},
): ApprovalConsumptionResult {
  try {
    return withRecordLock(missionDir, actionRequestId, () => {
      const record = readRecord(missionDir, actionRequestId);
      const approval = record.approval;
      const now = (options.now ?? (() => new Date()))();
      if (record.status !== "APPROVED" || approval === null) {
        return { status: "NOT_AUTHORIZED", reason: "request is not approved" };
      }
      if (approval.actionRequestId !== actionRequestId) {
        return {
          status: "NOT_AUTHORIZED",
          reason: "approval is bound to another request",
        };
      }
      if (approval.boundCommandHash !== commandHash) {
        return {
          status: "NOT_AUTHORIZED",
          reason: "approval command hash does not match",
        };
      }
      if (Date.parse(approval.expiresAt) <= now.getTime()) {
        return { status: "NOT_AUTHORIZED", reason: "approval expired" };
      }
      if (!approval.singleUse || approval.consumedAt !== null) {
        return { status: "NOT_AUTHORIZED", reason: "approval was already consumed" };
      }

      const consumed = ApprovalRequestRecordSchema.parse({
        ...record,
        approval: { ...approval, consumedAt: now.toISOString() },
      });
      writeRecord(missionDir, actionRequestId, consumed);
      return { status: "CONSUMED", record: consumed };
    });
  } catch (error) {
    return { status: "NOT_AUTHORIZED", reason: rejectionReason(error) };
  }
}
