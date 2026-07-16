import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyDeployTarget } from "../../packages/axiomgate-core/dist/index.js";

const repoRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const privateRoot = resolve(join(repoRoot, ".local"));
const target = resolve(join(privateRoot, "demo", "target-app-live"));
const mode = process.argv[2];
const profilePath = resolve(
  process.argv[3] ?? join(privateRoot, "demo", "wrong-target-profile.json"),
);

if (mode !== "wrong" && mode !== "correct") {
  throw new Error("usage: node demo/scripts/stage-vercel-target.mjs wrong|correct [.local profile path]");
}
if (profilePath !== privateRoot && !profilePath.startsWith(`${privateRoot}${sep}`)) {
  throw new Error("the Vercel staging profile must stay under .local/");
}

const profile = JSON.parse(readFileSync(profilePath, "utf8"));
const values = [
  profile?.expected?.orgId,
  profile?.expected?.projectId,
  profile?.expected?.projectName,
  profile?.wrongTarget?.projectId,
];
if (
  values.some(
    (value) =>
      typeof value !== "string" ||
      value.length === 0 ||
      /REPLACE|EXAMPLE|PLACEHOLDER|FAKE|[<>]/iu.test(value),
  )
) {
  throw new Error("replace every placeholder with private real staging IDs before use");
}
if (profile.expected.projectId === profile.wrongTarget.projectId) {
  throw new Error("wrongTarget.projectId must differ from expected.projectId");
}

const projectDirectory = resolve(join(target, ".vercel"));
if (relative(target, projectDirectory).startsWith("..")) {
  throw new Error("refusing to stage outside the target fixture");
}
const projectPath = join(projectDirectory, "project.json");
const projectId =
  mode === "wrong" ? profile.wrongTarget.projectId : profile.expected.projectId;
mkdirSync(projectDirectory, { recursive: true });
writeFileSync(
  projectPath,
  `${JSON.stringify(
    {
      projectId,
      orgId: profile.expected.orgId,
      projectName: profile.expected.projectName,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const result = verifyDeployTarget(
  {
    type: "vercel_project",
    project: profile.expected.projectName,
    expectedAccount: profile.expected.orgId,
    cwd: target,
  },
  {
    missionId: "msn_demo_staging",
    criterionId: "environment-guard",
    freshForCommit: "DEMO_STAGING",
    label: "LIVE",
  },
);
const expectedVerdict = mode === "wrong" ? "EXISTS_NOT_OWNED" : "VERIFIED_OWNED";
if (result.verdict !== expectedVerdict) {
  rmSync(projectPath, { force: true });
  throw new Error(
    `staging refused: expected ${expectedVerdict}, observed ${result.verdict}: ${result.reason}`,
  );
}

console.log(`LIVE Vercel target proof: ${result.verdict}`);
console.log(result.reason);
console.log(`Staged private link: ${relative(repoRoot, projectPath)}`);
