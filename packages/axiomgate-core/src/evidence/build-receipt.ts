import { z } from "zod";

import { ActionRequestSchema } from "../guard/index.js";
import {
  AcceptanceVerdictSchema,
  IsoDateTimeSchema,
  Sha256Schema,
} from "../mission/index.js";

const TokenUsageSchema = z.strictObject({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  reasoning: z.number().int().nonnegative(),
});

const PermissionQuadSchema = z.strictObject({
  requested: z.string(),
  approved: z.string(),
  applied: z.string(),
  observed: z.string(),
});

export const BuildReceiptSchema = z.strictObject({
  missionId: z.string().min(1),
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
      effort: z.enum(["low", "medium", "high"]),
      tokens: TokenUsageSchema,
    }),
  ),
  capacityLedger: z.strictObject({
    estimated: z.record(z.string(), z.unknown()),
    actual: z.record(z.string(), z.unknown()),
    sourceLabels: z.record(z.string(), z.unknown()),
  }),
  actions: z.array(ActionRequestSchema),
  permissionQuad: PermissionQuadSchema,
  criteria: z.array(
    z.strictObject({
      id: z.string().min(1),
      verdict: AcceptanceVerdictSchema,
      evidenceIds: z.array(z.string().min(1)),
    }),
  ),
  findings: z.array(z.unknown()),
  waivers: z.array(z.unknown()),
  outcome: z.enum(["COMPLETE", "INCOMPLETE", "ABORTED"]),
  evidenceChainHead: Sha256Schema,
  limitations: z.array(z.string()),
  generatedAt: IsoDateTimeSchema,
});

export type BuildReceipt = z.infer<typeof BuildReceiptSchema>;
