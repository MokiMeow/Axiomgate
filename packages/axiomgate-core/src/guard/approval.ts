import { z } from "zod";

import { IsoDateTimeSchema, Sha256Schema } from "../mission/index.js";

export const ApprovalSurfaceSchema = z.enum([
  "dashboard",
  "cli",
  "telegram",
  "mcp",
]);

export const ApprovalSchema = z.strictObject({
  id: z.string().min(1),
  actionRequestId: z.string().min(1),
  boundCommandHash: Sha256Schema,
  surface: ApprovalSurfaceSchema,
  approver: z.string().min(1),
  singleUse: z.boolean(),
  grantedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  consumedAt: IsoDateTimeSchema.nullable(),
});

export type Approval = z.infer<typeof ApprovalSchema>;
