import { resolve } from "node:path";

import {
  mapBoundaryToSandbox,
  ReasoningEffortSchema,
  toCodexReasoningEffort,
  toDisplayReasoningEffort,
  type CodexReasoningEffort,
  type ReasoningEffort,
  type MissionContract,
} from "../mission/index.js";
import {
  generateHookConfig,
  type HookConfigOptions,
} from "../guard/index.js";

export interface BuildCodexRunPlanInput {
  readonly contract: MissionContract;
  readonly missionDir: string;
  readonly projectPath: string;
  readonly prompt: string;
  readonly model?: string;
  readonly effort?: ReasoningEffort;
  readonly isGitRepository: boolean;
  readonly hookConfigOptions?: HookConfigOptions;
}

export interface CodexRunPlan {
  readonly missionDir: string;
  readonly projectPath: string;
  readonly model: string;
  readonly effort: ReasoningEffort;
  readonly wireEffort: CodexReasoningEffort;
  readonly sandbox: "read-only" | "workspace-write";
  readonly networkAccess: boolean;
  readonly configHash: string;
  readonly args: readonly string[];
  readonly stdin: string;
}

export function buildCodexRunPlan(
  input: BuildCodexRunPlanInput,
): CodexRunPlan {
  const buildPhase = input.contract.modelPlan.find(
    (entry) => entry.phase === "build",
  );
  if (buildPhase === undefined) {
    throw new Error("mission model plan has no build phase");
  }
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    throw new Error("run prompt must not be empty");
  }
  const mapping = mapBoundaryToSandbox(input.contract.intentBoundary);
  if (mapping.status === "REFUSED") {
    throw new Error(mapping.reason);
  }
  const model = input.model ?? buildPhase.model;
  const effort = ReasoningEffortSchema.parse(
    input.effort ?? toDisplayReasoningEffort(buildPhase.effort),
  );
  const wireEffort = toCodexReasoningEffort(effort);
  const missionDir = resolve(input.missionDir);
  const projectPath = resolve(input.projectPath);
  const hook = generateHookConfig(missionDir, input.hookConfigOptions);
  const args = [
    "exec",
    "--json",
    "--model",
    model,
    "-c",
    `model_reasoning_effort=${JSON.stringify(wireEffort)}`,
    ...mapping.codexArgs,
    "--dangerously-bypass-hook-trust",
    "--cd",
    projectPath,
    ...(input.isGitRepository ? [] : ["--skip-git-repo-check"]),
    ...hook.codexArgs,
    "-",
  ];

  return {
    missionDir,
    projectPath,
    model,
    effort,
    wireEffort,
    sandbox: mapping.sandbox,
    networkAccess: mapping.networkAccess,
    configHash: hook.configHash,
    args,
    stdin: prompt,
  };
}
