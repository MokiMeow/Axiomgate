import { z } from "zod";

import {
  ApprovalSchema,
  ActionRequestSchema,
} from "../guard/index.js";
import {
  AcceptanceVerdictSchema,
  IsoDateTimeSchema,
  MissionContractSchema,
  ReasoningEffortSchema,
  Sha256Schema,
} from "../mission/index.js";
import { VerificationFindingSchema } from "../verification/types.js";
import { EvidenceSchema } from "./evidence.js";
import { PermissionQuadSchema, WaiverSchema } from "./verdict.js";

export const TokenUsageSchema = z.strictObject({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  reasoning: z.number().int().nonnegative(),
});

export const ChainedEvidenceSchema = z.strictObject({
  record: EvidenceSchema,
  previousHash: Sha256Schema,
  hash: Sha256Schema,
});

export type ChainedEvidence = z.infer<typeof ChainedEvidenceSchema>;

export const ReceiptActionSchema = z.strictObject({
  request: ActionRequestSchema.nullable(),
  approval: ApprovalSchema.nullable(),
  permissionQuad: PermissionQuadSchema,
});

const AggregatePermissionQuadSchema = z.strictObject({
  requested: z.string(),
  approved: z.string(),
  applied: z.string(),
  observed: z.string(),
});

export const BuildReceiptSchema = z.strictObject({
  schemaVersion: z.literal(1),
  missionId: z.string().min(1),
  contract: MissionContractSchema,
  contractHash: Sha256Schema,
  repo: z.strictObject({
    remote: z.string().min(1),
    branch: z.string().min(1),
    commit: z.string().min(1),
  }),
  identities: z.strictObject({
    github: z.string().min(1),
    vercel: z.string().min(1),
  }),
  modelUsage: z.array(
    z.strictObject({
      phase: z.string().min(1),
      model: z.string().min(1),
      effort: ReasoningEffortSchema,
      tokens: TokenUsageSchema,
    }),
  ),
  capacityLedger: z.strictObject({
    estimated: z.record(z.string(), z.unknown()),
    actual: z.record(z.string(), z.unknown()),
    sourceLabels: z.record(z.string(), z.unknown()),
  }),
  actions: z.array(ReceiptActionSchema),
  permissionQuad: AggregatePermissionQuadSchema,
  criteria: z.array(
    z.strictObject({
      id: z.string().min(1),
      verdict: AcceptanceVerdictSchema,
      evidenceIds: z.array(z.string().min(1)),
      evidenceHashes: z.array(Sha256Schema),
    }),
  ),
  findings: z.array(VerificationFindingSchema),
  waivers: z.array(WaiverSchema),
  outcome: z.enum(["COMPLETE", "INCOMPLETE", "ABORTED"]),
  evidenceRecords: z.array(ChainedEvidenceSchema),
  evidenceChainHead: Sha256Schema,
  limitations: z.array(z.string()),
  generatedAt: IsoDateTimeSchema,
});

export type BuildReceipt = z.infer<typeof BuildReceiptSchema>;
