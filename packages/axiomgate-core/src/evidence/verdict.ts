import { z } from "zod";

import {
  MissionContractSchema,
  AcceptanceCriterionSchema,
  AcceptanceVerdictSchema,
  type MissionContract,
} from "../mission/index.js";
import {
  ActionRequestSchema,
  ApprovalSchema,
  HookDecisionEventSchema,
  type ActionRequest,
  type Approval,
  type HookDecisionEvent,
} from "../guard/index.js";
import { EvidenceSchema, type Evidence } from "./evidence.js";

export const CriterionVerdictResultSchema = z.strictObject({
  criterionId: z.string().min(1),
  verdict: AcceptanceVerdictSchema,
  evidenceIds: z.array(z.string().min(1)),
  missingEvidenceTypes: z.array(z.string().min(1)),
  reasons: z.array(z.string().min(1)),
});

export type CriterionVerdictResult = z.infer<
  typeof CriterionVerdictResultSchema
>;

export const WaiverSchema = z.strictObject({
  criterionId: z.string().min(1),
  reason: z.string().min(1),
  approver: z.string().min(1),
  riskAccepted: z.string().min(1),
  ts: z.iso.datetime({ offset: true }),
});

export type Waiver = z.infer<typeof WaiverSchema>;

export const PermissionQuadSchema = z.strictObject({
  actionRequestId: z.string().min(1).optional(),
  semanticAction: z.string().min(1),
  commandHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  requested: z.boolean(),
  approved: z.boolean(),
  applied: z.boolean(),
  observed: z.boolean(),
  mismatch: z.boolean(),
  reasons: z.array(z.string().min(1)),
});

export type PermissionQuad = z.infer<typeof PermissionQuadSchema>;

const CriterionGateResultSchema = CriterionVerdictResultSchema.extend({
  waiver: WaiverSchema.optional(),
}).strict();

export const CompletionGateResultSchema = z.strictObject({
  missionId: z.string().min(1),
  outcome: z.enum(["COMPLETE", "INCOMPLETE"]),
  criteria: z.array(CriterionGateResultSchema),
  waivers: z.array(WaiverSchema),
  permissionQuads: z.array(PermissionQuadSchema),
  blockingReasons: z.array(z.string().min(1)),
  permissionMismatches: z.array(z.string().min(1)),
});

export type CompletionGateResult = z.infer<
  typeof CompletionGateResultSchema
>;

function normalizedEvidenceTypes(evidence: Evidence): Set<string> {
  const command = evidence.command.toLowerCase();
  const types = new Set<string>(["command"]);
  if (evidence.source === "hook") types.add("hook_decision");
  if (evidence.source === "api") types.add("api_response");
  if (/\b(?:test|vitest|jest|pytest)\b/u.test(command)) {
    for (const type of ["test", "test_result", "unit_test", "integration_test", "regression_test"]) {
      types.add(type);
    }
  }
  if (/\b(?:build|tsc)\b/u.test(command)) types.add("build");
  if (/\bgit\s+(?:diff|status|rev-parse)\b/u.test(command)) {
    types.add("diff");
    types.add("git_state");
  }
  if (/\b(?:patchpilot|dependency.scan|npm audit|pip-audit)\b/u.test(command)) {
    types.add("security_scan");
    types.add("dependency_scan");
  }
  if (/\b(?:gitleaks|secret.scan|builtin-secret-scan)\b/u.test(command)) {
    types.add("secret_scan");
    types.add("security_scan");
  }
  return types;
}

export function computeCriterionVerdict(
  criterionInput: MissionContract["acceptanceCriteria"][number],
  evidenceInputs: readonly Evidence[],
  currentRevision: string,
): CriterionVerdictResult {
  const criterion = AcceptanceCriterionSchema.parse(criterionInput);
  const evidence = evidenceInputs.map((record) => EvidenceSchema.parse(record));
  const matching = evidence.filter(
    (record) =>
      record.criterionId === criterion.id &&
      record.freshForCommit === currentRevision,
  );
  const evidenceIds: string[] = [];
  const missingEvidenceTypes: string[] = [];
  const reasons: string[] = [];
  const failedTypes: string[] = [];
  const blockedTypes: string[] = [];
  const unknownTypes: string[] = [];
  for (const requiredType of criterion.evidenceTypes) {
    const typed = matching.filter((record) =>
      normalizedEvidenceTypes(record).has(requiredType),
    );
    const successful = typed.find((record) => record.exitCode === 0);
    if (successful !== undefined) {
      evidenceIds.push(successful.id);
      reasons.push(
        `Fresh successful evidence satisfies ${requiredType}: ${successful.id}`,
      );
    } else if (typed.length === 0) {
      missingEvidenceTypes.push(requiredType);
    } else {
      evidenceIds.push(...typed.map((record) => record.id));
      if (typed.some((record) => record.exitCode === 124)) {
        blockedTypes.push(requiredType);
        reasons.push(`Evidence execution was blocked for ${requiredType}`);
      } else if (typed.some((record) => record.exitCode === 127)) {
        unknownTypes.push(requiredType);
        reasons.push(`Evidence mechanism was unavailable for ${requiredType}`);
      } else {
        failedTypes.push(requiredType);
        reasons.push(`Fresh evidence failed for ${requiredType}`);
      }
    }
  }
  const verdict = failedTypes.length > 0
    ? "FAIL"
    : blockedTypes.length > 0
      ? "BLOCKED"
      : unknownTypes.length > 0
        ? "UNKNOWN"
        : missingEvidenceTypes.length > 0
          ? "UNVERIFIED"
          : "PASS";
  return CriterionVerdictResultSchema.parse({
    criterionId: criterion.id,
    verdict,
    evidenceIds: [...new Set(evidenceIds)],
    missingEvidenceTypes,
    reasons:
      reasons.length > 0
        ? reasons
        : [`Missing fresh successful evidence: ${missingEvidenceTypes.join(", ")}`],
  });
}

function consequential(action: string): boolean {
  return action !== "repository.read" && action !== "verification.run";
}

export function assemblePermissionQuads(
  missionInput: MissionContract,
  actionRequestInputs: readonly ActionRequest[],
  approvalInputs: readonly Approval[],
  hookEventInputs: readonly HookDecisionEvent[],
  evidenceInputs: readonly Evidence[],
  currentRevision: string,
): PermissionQuad[] {
  const mission = MissionContractSchema.parse(missionInput);
  const requests = actionRequestInputs.map((value) => ActionRequestSchema.parse(value));
  const approvals = approvalInputs.map((value) => ApprovalSchema.parse(value));
  const hookEvents = hookEventInputs
    .map((value) => HookDecisionEventSchema.parse(value))
    .filter((event) => event.missionId === mission.id && consequential(event.semanticAction));
  const evidence = evidenceInputs.map((value) => EvidenceSchema.parse(value));
  const commandHashes = new Set([
    ...requests.filter((request) => consequential(request.semanticAction)).map((request) => request.rawCommandHash),
    ...hookEvents.map((event) => event.commandHash),
  ]);

  return [...commandHashes].sort().map((commandHash) => {
    const request = requests.find((candidate) => candidate.rawCommandHash === commandHash);
    const hook = hookEvents.find((candidate) => candidate.commandHash === commandHash);
    const semanticAction = request?.semanticAction ?? hook?.semanticAction;
    if (semanticAction === undefined) {
      throw new Error(`Permission quad action is unavailable for ${commandHash}`);
    }
    const policy = mission.actionPolicy.find((entry) => entry.action === semanticAction);
    const approval = approvals.find(
      (candidate) =>
        candidate.boundCommandHash === commandHash &&
        (request === undefined || candidate.actionRequestId === request.id),
    );
    const requested = request !== undefined || hook !== undefined;
    const approved = policy?.decision === "ALLOW" ||
      (approval !== undefined && approval.consumedAt !== null);
    const applied = hook?.decision === "ALLOW";
    const observed = hook !== undefined && evidence.some(
      (record) =>
        record.missionId === mission.id &&
        record.freshForCommit === currentRevision &&
        record.exitCode === 0 &&
        Date.parse(record.capturedAt) >= Date.parse(hook.ts),
    );
    const reasons: string[] = [];
    if (applied && !approved) reasons.push("action was applied without approval");
    if (approved && !applied) reasons.push("approved action was not applied");
    if (applied && !observed) reasons.push("applied action lacks post-action observation");
    return PermissionQuadSchema.parse({
      ...(request === undefined ? {} : { actionRequestId: request.id }),
      semanticAction,
      commandHash,
      requested,
      approved,
      applied,
      observed,
      mismatch: reasons.length > 0,
      reasons,
    });
  });
}

export interface CompletionGateOptions {
  readonly waivers?: readonly Waiver[];
  readonly permissionQuads?: readonly PermissionQuad[];
}

export function completionGate(
  missionInput: MissionContract,
  evidence: readonly Evidence[],
  currentRevision: string,
  options: CompletionGateOptions = {},
): CompletionGateResult {
  const mission = MissionContractSchema.parse(missionInput);
  const waivers = (options.waivers ?? []).map((value) => WaiverSchema.parse(value));
  const permissionQuads = (options.permissionQuads ?? []).map((value) =>
    PermissionQuadSchema.parse(value),
  );
  const criteria = mission.acceptanceCriteria.map((criterion) => {
    const waiver = waivers.find((candidate) => candidate.criterionId === criterion.id);
    const result = computeCriterionVerdict(criterion, evidence, currentRevision);
    return CriterionGateResultSchema.parse(
      waiver === undefined
        ? result
        : { ...result, verdict: "WAIVED", waiver },
    );
  });
  const blockingReasons = criteria
    .filter((criterion) => criterion.verdict !== "PASS" && criterion.verdict !== "WAIVED")
    .map(
      (criterion) =>
        `${criterion.criterionId} is ${criterion.verdict}: ${criterion.reasons.join("; ")}`,
    );
  const permissionMismatches = permissionQuads
    .filter((quad) => quad.mismatch)
    .map((quad) => `${quad.semanticAction} ${quad.commandHash}: ${quad.reasons.join("; ")}`);
  return CompletionGateResultSchema.parse({
    missionId: mission.id,
    outcome:
      blockingReasons.length === 0
        ? "COMPLETE"
        : "INCOMPLETE",
    criteria,
    waivers,
    permissionQuads,
    blockingReasons,
    permissionMismatches,
  });
}
