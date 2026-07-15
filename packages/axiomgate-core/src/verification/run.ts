import { randomUUID } from "node:crypto";

import {
  VerificationRunSchema,
  type VerificationPlan,
  type VerificationRun,
} from "./types.js";

export interface CreateVerificationRunOptions {
  readonly id?: string;
  readonly now?: () => Date;
}

export function createVerificationRun(
  plan: VerificationPlan,
  commit: string,
  options: CreateVerificationRunOptions = {},
): VerificationRun {
  const startedAt = (options.now ?? (() => new Date()))().toISOString();
  const id =
    options.id ?? `verify_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  return VerificationRunSchema.parse({
    id,
    missionId: plan.missionId,
    workspace: plan.workspace,
    commit,
    diffHash: plan.diffHash,
    startedAt,
    endedAt: null,
    overall: "UNKNOWN",
    checks: plan.checks,
    findings: [],
    events: [
      {
        type: "verification.started",
        ts: startedAt,
        missionId: plan.missionId,
        runId: id,
        status: "UNKNOWN",
        message: `Verification started with ${plan.checks.length} required checks`,
      },
    ],
  });
}
