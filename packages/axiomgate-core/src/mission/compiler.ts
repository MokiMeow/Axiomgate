import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hashContract } from "./hash.js";
import { IntentBoundarySchema, type IntentBoundary } from "./intent-boundary.js";
import {
  MissionContractSchema,
  RiskSchema,
  type MissionContract,
} from "./mission-contract.js";

const MissionCriterionInputSchema = z.strictObject({
  id: z.string().trim().min(1).optional(),
  statement: z.string().trim().min(1),
  risk: RiskSchema.optional(),
  evidenceTypes: z.array(z.string().trim().min(1)).min(1),
});

const CompileMissionInputSchema = z.strictObject({
  objective: z.string().trim().min(1),
  boundary: IntentBoundarySchema.optional(),
  projectProfileId: z.string().trim().min(1).optional(),
  criteria: z.array(MissionCriterionInputSchema).min(3).max(6).optional(),
});

export interface MissionCriterionInput {
  readonly id?: string | undefined;
  readonly statement: string;
  readonly risk?: z.infer<typeof RiskSchema> | undefined;
  readonly evidenceTypes: readonly string[];
}

export interface CompileMissionInput {
  readonly objective: string;
  readonly boundary?: IntentBoundary;
  readonly projectProfileId?: string;
  readonly criteria?: readonly MissionCriterionInput[];
}

export interface CompileMissionOptions {
  readonly id?: string;
  readonly now?: () => Date;
}

export interface MissionConflict {
  readonly status: "CONFLICT";
  readonly action: string;
  readonly reason: string;
  readonly requiresUserEdit: true;
}

export interface MissionCompilation {
  readonly contract: MissionContract;
  readonly conflicts: readonly MissionConflict[];
}

export function parseMissionCriteria(value: unknown): MissionCriterionInput[] {
  return z.array(MissionCriterionInputSchema).min(3).max(6).parse(value);
}

const DEFAULT_ACTION_POLICY: MissionContract["actionPolicy"] = [
  { action: "repository.read", decision: "ALLOW" },
  { action: "file.modify", decision: "ALLOW" },
  {
    action: "branch.create",
    decision: "ALLOW",
    restrict: { branchPrefix: "agent/" },
  },
  { action: "pull_request.create", decision: "REQUIRE_APPROVAL" },
  { action: "preview.deploy", decision: "REQUIRE_APPROVAL" },
  { action: "production.deploy", decision: "DENY" },
  { action: "verification.run", decision: "ALLOW" },
];

export const DEFAULT_VERIFY_MODEL_PLAN_ENTRY: MissionContract["modelPlan"][number] = {
  phase: "verify",
  model: "gpt-5.6-terra",
  effort: "high",
  rationale:
    "independent challenge; different tier than builder reduces correlated blind spots",
};

const BASE_MODEL_PLAN: MissionContract["modelPlan"] = [
  {
    phase: "scout",
    model: "gpt-5.6-luna",
    effort: "low",
    rationale: "structured mapping",
  },
  {
    phase: "remediate",
    model: "gpt-5.6-terra",
    effort: "medium",
    rationale: "bounded fixes",
  },
  DEFAULT_VERIFY_MODEL_PLAN_ENTRY,
];

function securitySensitiveObjective(objective: string): boolean {
  return /\b(?:auth(?:entication|orization)?|credential|crypto|encrypt|permission|security|secret|token|vulnerabilit(?:y|ies))\b/iu.test(
    objective,
  );
}

function modelPlanFor(
  objective: string,
  criteria: MissionContract["acceptanceCriteria"],
  suppliedRiskProfile: boolean,
): MissionContract["modelPlan"] {
  const requiresMax =
    (suppliedRiskProfile || securitySensitiveObjective(objective)) &&
    criteria.some(
      (criterion) => criterion.risk === "high" || criterion.risk === "critical",
    );
  const build = requiresMax
    ? {
        phase: "build",
        model: "gpt-5.6-sol",
        effort: "max" as const,
        rationale:
          "single unbroken reasoning chain; hardest security-sensitive step",
      }
    : {
        phase: "build",
        model: "gpt-5.6-sol",
        effort: "high" as const,
        rationale: "primary implementation",
      };
  return [BASE_MODEL_PLAN[0]!, build, ...BASE_MODEL_PLAN.slice(1)];
}

function defaultCriteria(
  objective: string,
): MissionContract["acceptanceCriteria"] {
  return [
    {
      id: "criterion_implement",
      statement: `Implement the objective: ${objective}`,
      risk: "medium",
      evidenceTypes: ["diff", "command"],
      verdict: "UNVERIFIED",
      evidenceIds: [],
    },
    {
      id: "criterion_regression",
      statement: "Existing behavior remains regression-safe",
      risk: "high",
      evidenceTypes: ["test"],
      verdict: "UNVERIFIED",
      evidenceIds: [],
    },
    {
      id: "criterion_security",
      statement: "The change introduces no new known vulnerabilities",
      risk: "high",
      evidenceTypes: ["security_scan"],
      verdict: "UNVERIFIED",
      evidenceIds: [],
    },
    {
      id: "criterion_secrets",
      statement: "The change exposes no secrets",
      risk: "critical",
      evidenceTypes: ["secret_scan"],
      verdict: "UNVERIFIED",
      evidenceIds: [],
    },
  ];
}

function suppliedCriteria(
  criteria: readonly z.infer<typeof MissionCriterionInputSchema>[],
): MissionContract["acceptanceCriteria"] {
  return criteria.map((criterion, index) => ({
    id: criterion.id ?? `criterion_${index + 1}`,
    statement: criterion.statement,
    risk: criterion.risk ?? "medium",
    evidenceTypes: criterion.evidenceTypes,
    verdict: "UNVERIFIED",
    evidenceIds: [],
  }));
}

function requestsProductionDeployment(objective: string): boolean {
  return (
    /\b(?:deploy|ship|release)\b[\s\S]{0,40}\bproduction\b/iu.test(
      objective,
    ) ||
    /\bproduction\b[\s\S]{0,40}\b(?:deploy|deployment|ship|release)\b/iu.test(
      objective,
    )
  );
}

export function compileMission(
  input: CompileMissionInput,
  options: CompileMissionOptions = {},
): MissionCompilation {
  const parsed = CompileMissionInputSchema.parse(input);
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  const id = options.id ?? `msn_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const conflicts: MissionConflict[] = [];
  const acceptanceCriteria =
    parsed.criteria === undefined
      ? defaultCriteria(parsed.objective)
      : suppliedCriteria(parsed.criteria);
  if (requestsProductionDeployment(parsed.objective)) {
    conflicts.push({
      status: "CONFLICT",
      action: "production.deploy",
      reason:
        "Objective requests production deployment, which the Build Week policy denies",
      requiresUserEdit: true,
    });
    acceptanceCriteria[0] = {
      ...acceptanceCriteria[0]!,
      statement: `CONFLICT: ${parsed.objective} requires an explicit user edit because production.deploy is denied`,
      verdict: "BLOCKED",
    };
  }
  const draft = {
    id,
    version: 1,
    hash: `sha256:${"0".repeat(64)}`,
    objective: parsed.objective,
    projectProfileId: parsed.projectProfileId ?? "local-project",
    intentBoundary: parsed.boundary ?? "MODIFY_LOCAL",
    acceptanceCriteria,
    constraints: ["No production deployment during Build Week"],
    nonGoals: ["Production deployment"],
    actionPolicy: DEFAULT_ACTION_POLICY,
    modelPlan: modelPlanFor(
      parsed.objective,
      acceptanceCriteria,
      parsed.criteria !== undefined,
    ),
    budgetPolicy: { reservePercent: 20 },
    status: "DRAFT",
    createdAt: timestamp,
    updatedAt: timestamp,
  } as const;
  const contract = MissionContractSchema.parse({
    ...draft,
    hash: hashContract(draft),
  });

  return { contract, conflicts };
}
