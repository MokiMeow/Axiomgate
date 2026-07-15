import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { loadMissionSnapshot } from "../guard/index.js";
import { missionDirectory } from "../runtime/mission-files.js";
import { WaiverSchema, type Waiver } from "./verdict.js";

const WaiversSchema = z.array(WaiverSchema);

export interface RecordWaiverInput {
  readonly criterionId: string;
  readonly reason: string;
  readonly approver: string;
  readonly riskAccepted: string;
}

export interface RecordWaiverOptions {
  readonly now?: () => Date;
}

export function readWaivers(missionDir: string): Waiver[] {
  const path = join(missionDir, "waivers.json");
  if (!existsSync(path)) return [];
  return WaiversSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function recordWaiver(
  projectPath: string,
  missionId: string,
  input: RecordWaiverInput,
  options: RecordWaiverOptions = {},
): Waiver {
  const missionDir = missionDirectory(projectPath, missionId);
  const loaded = loadMissionSnapshot(missionDir);
  if (loaded.status === "INVALID") {
    throw new Error(`Cannot waive criterion: ${loaded.reason}`);
  }
  if (!loaded.snapshot.contract.acceptanceCriteria.some(
    (criterion) => criterion.id === input.criterionId,
  )) {
    throw new Error(`Unknown mission criterion: ${input.criterionId}`);
  }
  const waiver = WaiverSchema.parse({
    ...input,
    ts: (options.now ?? (() => new Date()))().toISOString(),
  });
  const waivers = readWaivers(missionDir).filter(
    (existing) => existing.criterionId !== waiver.criterionId,
  );
  waivers.push(waiver);
  writeFileSync(
    join(missionDir, "waivers.json"),
    `${JSON.stringify(WaiversSchema.parse(waivers), null, 2)}\n`,
    "utf8",
  );
  return waiver;
}
