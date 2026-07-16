import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  IntentBoundarySchema,
  MissionContractSchema,
} from "../../packages/axiomgate-core/dist/index.js";

const [projectArg, missionId, boundaryArg] = process.argv.slice(2);
if (projectArg === undefined || missionId === undefined || boundaryArg === undefined) {
  throw new Error("usage: node demo/scripts/set-mission-boundary.mjs <project> <mission-id> <boundary>");
}
if (!/^msn_[A-Za-z0-9_-]+$/u.test(missionId)) {
  throw new Error("invalid mission id");
}

const project = resolve(projectArg);
const contractPath = resolve(
  join(project, ".axiomgate", "missions", missionId, "contract.json"),
);
if (relative(project, contractPath).startsWith("..")) {
  throw new Error("contract path escaped the governed project");
}
const contract = MissionContractSchema.parse(
  JSON.parse(readFileSync(contractPath, "utf8")),
);
if (contract.id !== missionId) {
  throw new Error("contract mission id does not match the requested mission");
}
const intentBoundary = IntentBoundarySchema.parse(boundaryArg);
writeFileSync(
  contractPath,
  `${JSON.stringify({ ...contract, intentBoundary }, null, 2)}\n`,
  "utf8",
);
console.log(`Edited ${missionId} boundary to ${intentBoundary}; run mission update to re-hash.`);
