import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { runCommand } from "../../packages/axiomgate-core/dist/index.js";

const repoRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const source = resolve(join(repoRoot, "demo", "fixtures", "target-app"));
const demoRoot = resolve(join(repoRoot, ".local", "demo"));
const target = resolve(join(demoRoot, "target-app-live"));
if (!target.startsWith(`${demoRoot}${sep}`) || relative(demoRoot, target) !== "target-app-live") {
  throw new Error("live target path escaped .local/demo/target-app-live");
}

if (existsSync(target)) {
  if (!process.argv.includes("--fresh")) {
    throw new Error(`${target} already exists; pass --fresh to replace only this private demo copy`);
  }
  rmSync(target, { recursive: true, force: true });
}
mkdirSync(demoRoot, { recursive: true });
cpSync(source, target, {
  recursive: true,
  filter: (path) =>
    !["node_modules", "dist", ".vercel", ".axiomgate", ".git"].includes(
      path.slice(source.length).split(/[\\/]/u).filter(Boolean)[0] ?? "",
    ),
});

function requireSuccess(command, args, timeoutMs = 30_000) {
  const result = runCommand(command, args, { cwd: target, timeoutMs });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== "SUCCESS") {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

requireSuccess("npm", ["install", "--no-audit", "--no-fund"], 120_000);
requireSuccess("npm", ["test"], 60_000);
requireSuccess("npm", ["run", "build"], 60_000);
requireSuccess("git", ["init"]);
requireSuccess("git", ["config", "user.name", "AxiomGate Demo"]);
requireSuccess("git", ["config", "user.email", "demo@example.test"]);
requireSuccess("git", ["add", "."]);
requireSuccess("git", ["commit", "-m", "chore: synthetic baseline"]);
requireSuccess("git", [
  "remote",
  "add",
  "origin",
  "https://github.com/axiomgate-demo-synthetic/target-app.git",
]);
console.log(`Prepared isolated LIVE target: ${target}`);
