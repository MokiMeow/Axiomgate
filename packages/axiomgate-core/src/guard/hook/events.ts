import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { Sha256Schema } from "../../mission/index.js";

export const HookDecisionEventSchema = z.strictObject({
  source: z.literal("hook"),
  ts: z.iso.datetime({ offset: true }),
  hookEvent: z.string().min(1),
  toolName: z.string().min(1),
  commandHash: Sha256Schema,
  semanticAction: z.string().min(1),
  decision: z.enum(["ALLOW", "DENY"]),
  reasons: z.array(z.string().min(1)).min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
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
