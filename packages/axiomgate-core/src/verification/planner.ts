import { createHash } from "node:crypto";
import { resolve } from "node:path";

import type { MissionContract } from "../mission/index.js";
import {
  VerificationCheckSchema,
  VerificationPlanSchema,
  type VerificationCheck,
  type VerificationOverall,
  type VerificationPlan,
} from "./types.js";

const EVIDENCE_TO_CHECK: Record<string, string> = {
  diff: "git.diff",
  command: "target.build",
  build: "target.build",
  test: "target.test",
  unit_test: "target.test",
  integration_test: "target.test",
  regression_test: "target.test",
  security_scan: "dependency.scan",
  dependency_scan: "dependency.scan",
  secret_scan: "secret.scan",
};

const CHECK_ORDER = [
  "git.diff",
  "target.build",
  "target.test",
  "dependency.scan",
  "secret.scan",
];

export interface CreateVerificationPlanInput {
  readonly contract: MissionContract;
  readonly workspace: string;
  readonly diff: string;
  readonly changedFiles: readonly string[];
}

function addCheck(
  checks: Map<string, VerificationCheck>,
  kind: string,
  criterionId: string,
): void {
  const existing = checks.get(kind);
  if (existing === undefined) {
    checks.set(
      kind,
      VerificationCheckSchema.parse({
        id: `check_${kind.replace(/[^a-z0-9]+/giu, "_")}`,
        kind,
        criterionIds: [criterionId],
        required: true,
        status: "UNKNOWN",
      }),
    );
  } else if (!existing.criterionIds.includes(criterionId)) {
    checks.set(kind, {
      ...existing,
      criterionIds: [...existing.criterionIds, criterionId],
    });
  }
}

export function createVerificationPlan(
  input: CreateVerificationPlanInput,
): VerificationPlan {
  const checks = new Map<string, VerificationCheck>();
  for (const criterion of input.contract.acceptanceCriteria) {
    for (const evidenceType of criterion.evidenceTypes) {
      addCheck(
        checks,
        EVIDENCE_TO_CHECK[evidenceType] ?? `unsupported:${evidenceType}`,
        criterion.id,
      );
    }
  }

  const securityCriterion = input.contract.acceptanceCriteria.find((criterion) =>
    criterion.evidenceTypes.some((type) =>
      ["security_scan", "dependency_scan"].includes(type),
    ),
  );
  if (
    input.changedFiles.some((file) =>
      /(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|poetry\.lock)$/iu.test(
        file.replaceAll("\\", "/"),
      ),
    ) &&
    securityCriterion !== undefined
  ) {
    addCheck(checks, "dependency.scan", securityCriterion.id);
  }
  const secretCriterion = input.contract.acceptanceCriteria.find((criterion) =>
    criterion.evidenceTypes.includes("secret_scan"),
  );
  if (input.diff.length > 0 && secretCriterion !== undefined) {
    addCheck(checks, "secret.scan", secretCriterion.id);
  }

  const ordered = [...checks.values()].sort((left, right) => {
    const leftIndex = CHECK_ORDER.indexOf(left.kind);
    const rightIndex = CHECK_ORDER.indexOf(right.kind);
    return (
      (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex) ||
      left.kind.localeCompare(right.kind)
    );
  });
  return VerificationPlanSchema.parse({
    missionId: input.contract.id,
    workspace: resolve(input.workspace),
    diffHash: `sha256:${createHash("sha256").update(input.diff).digest("hex")}`,
    changedFiles: [...input.changedFiles],
    checks: ordered,
  });
}

export function calculateVerificationOverall(
  checks: readonly Pick<VerificationCheck, "required" | "status">[],
): VerificationOverall {
  const required = checks.filter((check) => check.required);
  if (required.length === 0) {
    return "UNKNOWN";
  }
  if (required.some((check) => check.status === "FAIL")) {
    return "FAIL";
  }
  if (required.some((check) => check.status === "BLOCKED")) {
    return "BLOCKED";
  }
  if (
    required.some(
      (check) => check.status === "UNKNOWN" || check.status === "SKIPPED",
    )
  ) {
    return "UNKNOWN";
  }
  return "PASS";
}
