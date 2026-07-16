import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { Sha256Schema } from "../../mission/index.js";
import { EvidenceSchema, type Evidence } from "../../evidence/index.js";

export const HookDecisionEventSchema = z.strictObject({
  source: z.literal("hook"),
  ts: z.iso.datetime({ offset: true }),
  hookEvent: z.string().min(1),
  toolName: z.string().min(1),
  commandHash: Sha256Schema,
  semanticAction: z.string().min(1),
  decision: z.enum(["ALLOW", "DENY", "DEFER"]),
  reasons: z.array(z.string().min(1)).min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  effectiveReviewer: z.string().min(1).optional(),
  reviewerDisposition: z
    .enum(["AXIOMGATE", "CODEX_NATIVE", "EXPLICIT_APPROVAL"])
    .optional(),
});

export type HookDecisionEvent = z.infer<typeof HookDecisionEventSchema>;

export function appendHookEvent(
  missionDir: string,
  event: HookDecisionEvent,
): void {
  const parsed = HookDecisionEventSchema.parse(event);
  mkdirSync(missionDir, { recursive: true });
  appendFileSync(
    join(missionDir, "events.jsonl"),
    `${JSON.stringify(parsed)}\n`,
    "utf8",
  );
}

export function appendTargetEvidence(
  missionDir: string,
  evidence: Evidence,
): void {
  const parsed = EvidenceSchema.parse(evidence);
  mkdirSync(missionDir, { recursive: true });
  appendFileSync(
    join(missionDir, "events.jsonl"),
    `${JSON.stringify(parsed)}\n`,
    "utf8",
  );
}
