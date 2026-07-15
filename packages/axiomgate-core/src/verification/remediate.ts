import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { z } from "zod";

import type { Evidence } from "../evidence/index.js";
import {
  loadMissionSnapshot,
  type HookConfigOptions,
} from "../guard/index.js";
import type { MissionContract } from "../mission/index.js";
import {
  missionDirectory,
  runMission,
  type MissionRunResult,
} from "../runtime/index.js";
import { verifyMission, type VerifyMissionOptions, type VerifyMissionResult } from "./engine.js";
import {
  VerificationFindingSchema,
  type VerificationFinding,
} from "./types.js";

export type EvidenceFreshness = "FRESH" | "STALE";

export function evidenceFreshness(
  evidence: Pick<Evidence, "freshForCommit">,
  currentRevision: string,
): EvidenceFreshness {
  return evidence.freshForCommit === currentRevision ? "FRESH" : "STALE";
}

export function freshEvidenceOnly<T extends Pick<Evidence, "freshForCommit">>(
  evidence: readonly T[],
  currentRevision: string,
): T[] {
  return evidence.filter(
    (item) => evidenceFreshness(item, currentRevision) === "FRESH",
  );
}

export interface RemediationPlan {
  readonly missionId: string;
  readonly findingId: string;
  readonly boundary: "MODIFY_LOCAL";
  readonly model: string;
  readonly effort: "medium";
  readonly prompt: string;
  readonly checkKinds: readonly string[];
}

export function affectedCheckKinds(
  finding: Pick<VerificationFinding, "checkId">,
): readonly string[] {
  if (finding.checkId.includes("dependency_scan")) {
    return ["dependency.scan", "target.test", "target.build"];
  }
  if (finding.checkId.includes("secret_scan")) {
    return ["secret.scan"];
  }
  if (finding.checkId.includes("target_test")) {
    return ["target.test"];
  }
  if (finding.checkId.includes("target_build")) {
    return ["target.build"];
  }
  return [];
}

export function buildRemediationPlan(
  contract: MissionContract,
  finding: VerificationFinding,
): RemediationPlan {
  if (finding.status !== "validated") {
    throw new Error("Remediation requires a validated finding");
  }
  if (contract.intentBoundary !== "MODIFY_LOCAL") {
    throw new Error(
      `Remediation requires mission boundary MODIFY_LOCAL; found ${contract.intentBoundary}`,
    );
  }
  const checkKinds = affectedCheckKinds(finding);
  if (checkKinds.length === 0) {
    throw new Error(`No targeted rerun is defined for check ${finding.checkId}`);
  }
  const phase = contract.modelPlan.find((entry) => entry.phase === "remediate");
  const model = phase?.model ?? "gpt-5.6-terra";
  const effort = "medium" as const;
  const packageContext = finding.package === undefined
    ? ""
    : `\nAffected dependency: ${finding.package}${finding.version === undefined ? "" : `@${finding.version}`}${finding.fixedVersion === undefined ? "" : `; reported fixed version: ${finding.fixedVersion}`}.`;
  const prompt = [
    `Remediate only validated finding ${finding.id}.`,
    `Finding: ${finding.title}.`,
    `Detail: ${finding.detail}.${packageContext}`,
    finding.advisory === undefined ? "" : `Advisory: ${finding.advisory}.`,
    "Make the smallest regression-safe local change that resolves this finding.",
    "Do not address unrelated findings, publish, deploy, or broaden the mission scope.",
    "Run only focused local validation needed for this fix; AxiomGate will independently rerun the affected checks.",
  ].filter(Boolean).join("\n");
  return {
    missionId: contract.id,
    findingId: finding.id,
    boundary: "MODIFY_LOCAL",
    model,
    effort,
    prompt,
    checkKinds,
  };
}

export interface RemediateMissionOptions {
  readonly hookConfigOptions?: HookConfigOptions;
  readonly timeoutMs?: number;
  readonly runMissionFn?: typeof runMission;
  readonly verifyMissionFn?: typeof verifyMission;
  readonly verifyOptions?: Omit<VerifyMissionOptions, "checkKinds" | "hookConfigOptions">;
}

export interface RemediateMissionResult {
  readonly plan: RemediationPlan;
  readonly remediation: MissionRunResult;
  readonly verification: VerifyMissionResult | undefined;
}

export async function remediateMission(
  projectPath: string,
  id: string,
  findingId: string,
  options: RemediateMissionOptions = {},
): Promise<RemediateMissionResult> {
  const workspace = resolve(projectPath);
  const missionDir = missionDirectory(workspace, id);
  const loaded = loadMissionSnapshot(missionDir);
  if (loaded.status === "INVALID") {
    throw new Error(`Remediation refused: ${loaded.reason}`);
  }
  const findings = z.array(VerificationFindingSchema).parse(
    JSON.parse(readFileSync(join(missionDir, "findings.json"), "utf8")),
  );
  const finding = findings.find((candidate) => candidate.id === findingId);
  if (finding === undefined) {
    throw new Error(`Finding ${findingId} was not found`);
  }
  const plan = buildRemediationPlan(loaded.snapshot.contract, finding);
  const execute = options.runMissionFn ?? runMission;
  const remediation = await execute(workspace, id, {
    prompt: plan.prompt,
    model: plan.model,
    effort: plan.effort,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.hookConfigOptions === undefined
      ? {}
      : { hookConfigOptions: options.hookConfigOptions }),
  });
  if (remediation.record.status !== "SUCCESS") {
    return { plan, remediation, verification: undefined };
  }
  const verify = options.verifyMissionFn ?? verifyMission;
  const verification = verify(workspace, id, {
    ...options.verifyOptions,
    checkKinds: plan.checkKinds,
    ...(options.hookConfigOptions === undefined
      ? {}
      : { hookConfigOptions: options.hookConfigOptions }),
  });
  return { plan, remediation, verification };
}
