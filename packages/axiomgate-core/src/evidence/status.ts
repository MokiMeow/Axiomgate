import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  ApprovalRequestRecordSchema,
  HookDecisionEventSchema,
  loadMissionSnapshot,
  type ApprovalRequestRecord,
  type HookDecisionEvent,
} from "../guard/index.js";
import type { MissionContract } from "../mission/index.js";
import { missionDirectory } from "../runtime/mission-files.js";
import { EvidenceSchema, type Evidence } from "./evidence.js";
import {
  assemblePermissionQuads,
  completionGate,
  type CompletionGateResult,
} from "./verdict.js";
import { readWaivers } from "./waivers.js";

function readJsonLines(path: string): unknown[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

export function readStoredEvidence(missionDir: string): Evidence[] {
  return readJsonLines(join(missionDir, "events.jsonl")).flatMap((value) => {
    const parsed = EvidenceSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

export function readStoredHookEvents(missionDir: string): HookDecisionEvent[] {
  return readJsonLines(join(missionDir, "events.jsonl")).flatMap((value) => {
    const parsed = HookDecisionEventSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

export function readApprovalRecords(missionDir: string): ApprovalRequestRecord[] {
  const directory = join(missionDir, "approvals");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => /^act_[A-Za-z0-9_-]+\.json$/u.test(name))
    .sort()
    .map((name) =>
      ApprovalRequestRecordSchema.parse(
        JSON.parse(readFileSync(join(directory, name), "utf8")),
      ),
    );
}

export interface MissionStatus {
  readonly missionDir: string;
  readonly contract: MissionContract;
  readonly currentRevision: string;
  readonly evidence: readonly Evidence[];
  readonly gate: CompletionGateResult;
}

export interface LoadMissionStatusOptions {
  readonly currentRevision: string;
}

export function loadMissionStatus(
  projectPath: string,
  missionId: string,
  options: LoadMissionStatusOptions,
): MissionStatus {
  const missionDir = missionDirectory(projectPath, missionId);
  const loaded = loadMissionSnapshot(missionDir);
  if (loaded.status === "INVALID") {
    throw new Error(`Cannot load mission status: ${loaded.reason}`);
  }
  const evidence = readStoredEvidence(missionDir);
  const approvals = readApprovalRecords(missionDir);
  const quads = assemblePermissionQuads(
    loaded.snapshot.contract,
    approvals.map((record) => record.request),
    approvals.flatMap((record) => record.approval === null ? [] : [record.approval]),
    readStoredHookEvents(missionDir),
    evidence,
    options.currentRevision,
  );
  return {
    missionDir,
    contract: loaded.snapshot.contract,
    currentRevision: options.currentRevision,
    evidence,
    gate: completionGate(
      loaded.snapshot.contract,
      evidence,
      options.currentRevision,
      { waivers: readWaivers(missionDir), permissionQuads: quads },
    ),
  };
}
