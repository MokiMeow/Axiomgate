#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const tracked = spawnSync("git", ["ls-files", "--", "*.md"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});

if (tracked.status !== 0) {
  process.stderr.write(tracked.stderr);
  process.exit(tracked.status ?? 1);
}

const markdownFiles = tracked.stdout.split(/\r?\n/u).filter(Boolean);
const failures = [];
let checked = 0;

function decodeTarget(rawTarget) {
  const unwrapped = rawTarget.startsWith("<") && rawTarget.endsWith(">")
    ? rawTarget.slice(1, -1)
    : rawTarget;
  const withoutTitle = unwrapped.match(/^(\S+?)(?:\s+["'][^"']*["'])?$/u)?.[1] ?? unwrapped;
  return decodeURIComponent(withoutTitle.split("#", 1)[0]);
}

for (const relativeFile of markdownFiles) {
  const absoluteFile = resolve(repositoryRoot, relativeFile);
  const source = readFileSync(absoluteFile, "utf8");
  const patterns = [
    /!?(?:\[[^\]]*\])\(([^)]+)\)/gu,
    /^\s*\[[^\]]+\]:\s*(\S+)/gmu,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const rawTarget = match[1].trim();
      if (
        rawTarget.length === 0 ||
        rawTarget.startsWith("#") ||
        /^(?:https?:|mailto:|data:)/iu.test(rawTarget)
      ) continue;

      const target = decodeTarget(rawTarget);
      if (target.length === 0) continue;
      checked += 1;
      const absoluteTarget = resolve(dirname(absoluteFile), target);
      if (!existsSync(absoluteTarget)) {
        const line = source.slice(0, match.index).split(/\r?\n/u).length;
        failures.push(`${relativeFile}:${line} -> ${rawTarget}`);
        continue;
      }
      try {
        statSync(absoluteTarget);
      } catch {
        const line = source.slice(0, match.index).split(/\r?\n/u).length;
        failures.push(`${relativeFile}:${line} -> ${rawTarget}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL markdown links: ${failures.length} broken of ${checked} checked`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS markdown links: ${checked} relative targets across ${markdownFiles.length} tracked Markdown files`);
