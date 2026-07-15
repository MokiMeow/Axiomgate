import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  compileMission,
  DEFAULT_VERIFY_MODEL_PLAN_ENTRY,
  bumpContractVersion,
  mapBoundaryToSandbox,
  MissionContractSchema,
  type CompileMissionInput,
  type CompileMissionOptions,
  type MissionCompilation,
  type MissionContract,
} from "../mission/index.js";
import {
  createMissionSnapshot,
  generateHookConfig,
  loadMissionSnapshot,
  resolveIdentity as resolveCurrentIdentity,
  writeMissionSnapshot,
  type HookConfigOptions,
  type IdentityReport,
} from "../guard/index.js";

const MISSION_ID_PATTERN = /^msn_[A-Za-z0-9_-]+$/u;

export interface MissionFileOptions extends CompileMissionOptions {
  readonly hookConfigOptions?: HookConfigOptions;
  readonly resolveIdentity?: (projectPath: string) => IdentityReport;
}

export interface PersistedMission extends MissionCompilation {
  readonly missionDir: string;
  readonly configHash: string;
}

function assertMissionId(id: string): void {
  if (!MISSION_ID_PATTERN.test(id)) {
    throw new Error("invalid mission id");
  }
}

export function missionDirectory(projectPath: string, id: string): string {
  assertMissionId(id);
  return join(resolve(projectPath), ".axiomgate", "missions", id);
}

function identityForProject(
  projectPath: string,
  resolver?: (projectPath: string) => IdentityReport,
): IdentityReport {
  return resolver?.(projectPath) ?? resolveCurrentIdentity({ cwd: projectPath });
}

function assertRunnableBoundary(contract: MissionContract): void {
  const mapping = mapBoundaryToSandbox(contract.intentBoundary);
  if (mapping.status === "REFUSED") {
    throw new Error(mapping.reason);
  }
}

function writeContract(missionDir: string, contract: MissionContract): void {
  writeFileSync(
    join(missionDir, "contract.json"),
    `${JSON.stringify(contract, null, 2)}\n`,
    "utf8",
  );
}

export function createMission(
  projectPath: string,
  input: CompileMissionInput,
  options: MissionFileOptions = {},
): PersistedMission {
  const resolvedProject = resolve(projectPath);
  const compilation = compileMission(
    {
      ...input,
      projectProfileId: input.projectProfileId ?? basename(resolvedProject),
    },
    options,
  );
  assertRunnableBoundary(compilation.contract);
  const missionDir = missionDirectory(resolvedProject, compilation.contract.id);
  const contractPath = join(missionDir, "contract.json");
  if (existsSync(contractPath)) {
    throw new Error(`mission already exists: ${compilation.contract.id}`);
  }

  const config = generateHookConfig(missionDir, options.hookConfigOptions);
  const snapshot = createMissionSnapshot({
    contract: compilation.contract,
    policy: compilation.contract.actionPolicy,
    identity: identityForProject(resolvedProject, options.resolveIdentity),
    hookConfigHash: config.configHash,
  });
  mkdirSync(missionDir, { recursive: true });
  writeContract(missionDir, compilation.contract);
  writeMissionSnapshot(missionDir, snapshot);

  return { ...compilation, missionDir, configHash: config.configHash };
}

export function updateMission(
  projectPath: string,
  id: string,
  options: MissionFileOptions = {},
): PersistedMission {
  const resolvedProject = resolve(projectPath);
  const missionDir = missionDirectory(resolvedProject, id);
  const prior = loadMissionSnapshot(missionDir);
  if (prior.status === "INVALID") {
    throw new Error(`cannot update invalid mission snapshot: ${prior.reason}`);
  }
  const edited = MissionContractSchema.parse(
    JSON.parse(readFileSync(join(missionDir, "contract.json"), "utf8")),
  );
  if (edited.id !== id || prior.snapshot.contract.id !== id) {
    throw new Error("mission id cannot be changed during update");
  }
  const migratedModelPlan = edited.modelPlan.some(
    (entry) => entry.phase === "verify",
  )
    ? edited.modelPlan
    : [...edited.modelPlan, DEFAULT_VERIFY_MODEL_PLAN_ENTRY];
  const contract = bumpContractVersion(
    {
      ...edited,
      modelPlan: migratedModelPlan,
      budgetPolicy: edited.budgetPolicy ?? { reservePercent: 20 },
      version: prior.snapshot.contract.version,
    },
    (options.now ?? (() => new Date()))().toISOString(),
  );
  assertRunnableBoundary(contract);

  const config = generateHookConfig(missionDir, options.hookConfigOptions);
  const snapshot = createMissionSnapshot({
    contract,
    policy: contract.actionPolicy,
    identity: identityForProject(resolvedProject, options.resolveIdentity),
    hookConfigHash: config.configHash,
  });
  writeContract(missionDir, contract);
  writeMissionSnapshot(missionDir, snapshot);

  return {
    contract,
    conflicts: [],
    missionDir,
    configHash: config.configHash,
  };
}
