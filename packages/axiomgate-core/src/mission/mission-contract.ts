import { z } from "zod";

import { IntentBoundarySchema } from "./intent-boundary.js";
import { IsoDateTimeSchema, Sha256Schema } from "./primitives.js";
import { PersistedReasoningEffortSchema } from "./reasoning-effort.js";

export const RiskSchema = z.enum(["low", "medium", "high", "critical"]);

export const AcceptanceVerdictSchema = z.enum([
  "UNVERIFIED",
  "PASS",
  "FAIL",
  "BLOCKED",
  "WAIVED",
  "UNKNOWN",
]);

export const AcceptanceCriterionSchema = z.strictObject({
  id: z.string().min(1),
  statement: z.string().min(1),
  risk: RiskSchema,
  evidenceTypes: z.array(z.string().min(1)),
  verdict: AcceptanceVerdictSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export const ActionPolicyDecisionSchema = z.enum([
  "ALLOW",
  "DENY",
  "REQUIRE_APPROVAL",
  "UNAVAILABLE",
  "UNKNOWN",
]);

export const ActionPolicyEntrySchema = z.strictObject({
  action: z.string().min(1),
  decision: ActionPolicyDecisionSchema,
  restrict: z.record(z.string(), z.unknown()).optional(),
});

export const ModelPlanEntrySchema = z.strictObject({
  phase: z.string().min(1),
  model: z.string().min(1),
  effort: PersistedReasoningEffortSchema,
  rationale: z.string().min(1),
  multiAgent: z.literal(false).optional(),
  capabilityNote: z.string().min(1).optional(),
});

export const BudgetPolicySchema = z.strictObject({
  reservePercent: z.number().int().min(0).max(100),
});

export const MissionContractSchema = z.strictObject({
  id: z.string().min(1),
  version: z.number().int().positive(),
  hash: Sha256Schema,
  objective: z.string().min(1),
  projectProfileId: z.string().min(1),
  intentBoundary: IntentBoundarySchema,
  acceptanceCriteria: z.array(AcceptanceCriterionSchema),
  constraints: z.array(z.string()),
  nonGoals: z.array(z.string()),
  actionPolicy: z.array(ActionPolicyEntrySchema),
  modelPlan: z.array(ModelPlanEntrySchema),
  budgetPolicy: BudgetPolicySchema.optional(),
  status: z.string().min(1),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export type MissionContract = z.infer<typeof MissionContractSchema>;
