import { z } from "zod";

import {
  IntentBoundarySchema,
  IsoDateTimeSchema,
  RiskSchema,
  Sha256Schema,
} from "../mission/index.js";

export const ActionRequestSchema = z.strictObject({
  id: z.string().min(1),
  missionId: z.string().min(1),
  semanticAction: z.string().min(1),
  mechanism: z.string().min(1),
  target: z.strictObject({
    type: z.string().min(1),
    owner: z.string().min(1),
    repo: z.string().min(1),
    verifiedOwnership: z.boolean(),
    branch: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
  }),
  identity: z.strictObject({
    githubLogin: z.string().min(1),
    vercelUser: z.string().min(1).optional(),
    source: z.string().min(1),
  }),
  rawCommandHash: Sha256Schema,
  intentBoundaryRequired: IntentBoundarySchema,
  risk: RiskSchema,
  rollback: z.string().min(1),
  decision: z.enum(["ALLOW", "DENY", "AWAITING_APPROVAL", "EXPIRED"]),
  requestedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;
