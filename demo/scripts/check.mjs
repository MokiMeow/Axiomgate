import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyHookPayload,
  compileMission,
  parseMissionCriteria,
  runCommand,
} from "../../packages/axiomgate-core/dist/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = join(repoRoot, "demo", "fixtures", "target-app");
const criteriaPath = join(repoRoot, "demo", "fixtures", "mission-criteria.json");
const objective =
  "Add brute-force lockout to the login endpoint (lock after 5 failed attempts for 15 minutes), preserve existing behavior.";

const criteria = parseMissionCriteria(
  JSON.parse(readFileSync(criteriaPath, "utf8")),
);
const contract = compileMission(
  { objective, boundary: "DEPLOY_PREVIEW", criteria },
  { id: "msn_demo_check", now: () => new Date("2026-07-16T00:00:00.000Z") },
).contract;
if (contract.acceptanceCriteria.length !== 5) {
  throw new Error("demo criteria did not compile into five acceptance criteria");
}
console.log(
  `criteria: PASS (${contract.acceptanceCriteria.length} criteria; ${contract.hash})`,
);

const outsideAction = classifyHookPayload({
  tool_name: "Bash",
  tool_input: {
    command:
      'Remove-Item -LiteralPath "C:\\synthetic-outside-workspace.txt"',
  },
});
if (outsideAction.semanticAction !== "UNKNOWN" || !outsideAction.stateChanging) {
  throw new Error("out-of-scope demo command did not classify fail-closed");
}
console.log("out-of-scope classifier: PASS (UNKNOWN / deny-by-default)");

const commands = [
  ["npm", ["install", "--no-audit", "--no-fund"], 120_000],
  ["npm", ["test"], 60_000],
  ["npm", ["run", "build"], 60_000],
];
for (const [command, args, timeoutMs] of commands) {
  const result = runCommand(command, args, { cwd: target, timeoutMs });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== "SUCCESS") {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status} (exit ${result.exitCode})`,
    );
  }
  console.log(
    `${command} ${args.join(" ")}: PASS (${result.durationMs} ms)`,
  );
}

if (!existsSync(join(target, "package-lock.json"))) {
  throw new Error("npm install did not produce package-lock.json");
}
if (!existsSync(join(target, "dist", "build-manifest.json"))) {
  throw new Error("npm run build did not produce dist/build-manifest.json");
}
console.log("demo fixture: PASS");
