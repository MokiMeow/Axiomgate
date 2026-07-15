import { z } from "zod";

import { IsoDateTimeSchema, Sha256Schema } from "../mission/index.js";

export const EvidenceSchema = z.strictObject({
  id: z.string().min(1),
  missionId: z.string().min(1),
  criterionId: z.string().min(1),
  source: z.enum(["command", "api", "hook"]),
  command: z.string().min(1),
  exitCode: z.number().int(),
  outputHash: Sha256Schema,
  outputRef: z.string().min(1),
  capturedAt: IsoDateTimeSchema,
  freshForCommit: z.string().min(1),
  label: z.enum(["LIVE", "SANDBOX", "REPLAY"]),
  redacted: z.boolean(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
