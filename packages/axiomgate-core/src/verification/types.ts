import { z } from "zod";

export const VerificationCheckStateSchema = z.enum([
  "PASS",
  "FAIL",
  "BLOCKED",
  "UNKNOWN",
  "SKIPPED",
]);

export type VerificationCheckState = z.infer<
  typeof VerificationCheckStateSchema
>;

export const VerificationCheckSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.string().min(1),
  criterionIds: z.array(z.string().min(1)).min(1),
  required: z.boolean(),
  status: VerificationCheckStateSchema,
  reason: z.string().min(1).optional(),
  evidenceIds: z.array(z.string().min(1)).optional(),
  findingIds: z.array(z.string().min(1)).optional(),
});

export type VerificationCheck = z.infer<typeof VerificationCheckSchema>;

export const VerificationOverallSchema = z.enum([
  "PASS",
  "FAIL",
  "BLOCKED",
  "UNKNOWN",
]);

export type VerificationOverall = z.infer<typeof VerificationOverallSchema>;

export const VerificationPlanSchema = z.strictObject({
  missionId: z.string().min(1),
  workspace: z.string().min(1),
  diffHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  changedFiles: z.array(z.string()),
  checks: z.array(VerificationCheckSchema),
});

export type VerificationPlan = z.infer<typeof VerificationPlanSchema>;

export const VerificationEventSchema = z.strictObject({
  type: z.enum([
    "verification.started",
    "verification.check.completed",
    "verification.completed",
  ]),
  ts: z.iso.datetime({ offset: true }),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  checkId: z.string().min(1).optional(),
  status: z.union([VerificationCheckStateSchema, VerificationOverallSchema]),
  message: z.string().min(1),
});

export type VerificationEvent = z.infer<typeof VerificationEventSchema>;

export const VerificationFindingSchema = z.strictObject({
  id: z.string().min(1),
  checkId: z.string().min(1),
  criterionIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low", "unknown"]),
  status: z.enum(["candidate", "validated", "resolved"]),
  cve: z.string().min(1).optional(),
  advisory: z.string().min(1).optional(),
  ecosystem: z.string().min(1).optional(),
  package: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  fixedVersion: z.string().min(1).optional(),
  reachability: z.enum(["reachable", "likely_unused", "unknown"]).optional(),
});

export type VerificationFinding = z.infer<typeof VerificationFindingSchema>;

export const VerificationRunSchema = z.strictObject({
  id: z.string().min(1),
  missionId: z.string().min(1),
  workspace: z.string().min(1),
  commit: z.string().min(1),
  diffHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).nullable(),
  overall: VerificationOverallSchema,
  checks: z.array(VerificationCheckSchema),
  findings: z.array(VerificationFindingSchema),
  events: z.array(VerificationEventSchema),
});

export type VerificationRun = z.infer<typeof VerificationRunSchema>;
