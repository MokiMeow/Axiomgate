#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const tracked = spawnSync("git", ["ls-files", "-z"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});

if (tracked.status !== 0) {
  process.stderr.write(tracked.stderr);
  process.exit(tracked.status ?? 1);
}

const failures = [];
let textFiles = 0;
for (const relativeFile of tracked.stdout.split("\0").filter(Boolean)) {
  const content = readFileSync(resolve(repositoryRoot, relativeFile));
  if (content.includes(0)) continue;
  textFiles += 1;
  const source = content.toString("utf8");
  for (const character of ["\u2014", "\u2013"]) {
    let offset = source.indexOf(character);
    while (offset >= 0) {
      const line = source.slice(0, offset).split(/\r?\n/u).length;
      failures.push(`${relativeFile}:${line} contains U+${character.codePointAt(0).toString(16).toUpperCase()}`);
      offset = source.indexOf(character, offset + character.length);
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL punctuation: ${failures.length} Unicode dash characters`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS punctuation: 0 em dashes and 0 en dashes across ${textFiles} tracked text files`);
