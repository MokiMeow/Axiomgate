#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const skillPath = resolve(repositoryRoot, ".agents", "skills", "axiomgate", "SKILL.md");
const pluginSkillPath = resolve(repositoryRoot, "plugins", "axiomgate", "skills", "axiomgate", "SKILL.md");
const skill = readFileSync(skillPath, "utf8");
const pluginSkill = readFileSync(pluginSkillPath, "utf8");

if (skill !== pluginSkill) {
  console.error("FAIL skill commands: repository and plugin skill copies differ");
  process.exit(1);
}

const commands = [...new Set(
  [...skill.matchAll(/`(axiomgate [^`]+)`/gu)].map((match) => match[1]),
)];
const expectedStems = [
  "mission create",
  "mission run",
  "mission verify",
  "mission status",
  "mission receipt",
  "receipt verify",
  "replay all",
  "telegram watch",
  "verify-enforcement",
  "runway status",
];

if (commands.length !== expectedStems.length) {
  console.error(`FAIL skill commands: expected ${expectedStems.length}, found ${commands.length}`);
  process.exit(1);
}

const cliPath = resolve(repositoryRoot, "apps", "cli", "dist", "index.js");
const help = spawnSync(process.execPath, [cliPath, "--help"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
const helpText = `${help.stdout}\n${help.stderr}`;
if (help.status !== 0) {
  process.stderr.write(helpText);
  process.exit(help.status ?? 1);
}

const missing = expectedStems.filter((stem) => !helpText.includes(stem));
if (missing.length > 0) {
  console.error(`FAIL skill commands: CLI help missing ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`PASS skill commands: ${commands.length} documented workflows exist in shipped CLI help`);
