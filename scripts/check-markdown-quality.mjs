#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const markdownFiles = tracked.stdout
  .split(/\r?\n/u)
  .filter(Boolean)
  .filter((relativeFile) => existsSync(resolve(repositoryRoot, relativeFile)));
const failures = [];
const h1Optional = new Set([".github/pull_request_template.md"]);
const mojibake = /\uFFFD|Â|â(?:€|†|”|–|—)|ðŸ|ï¸/u;

function outsideFences(source) {
  let fenced = false;
  return source
    .split(/\r?\n/u)
    .map((line) => {
      if (/^\s*```/u.test(line)) {
        fenced = !fenced;
        return "";
      }
      return fenced ? "" : line;
    })
    .join("\n");
}

for (const relativeFile of markdownFiles) {
  const normalized = relativeFile.replaceAll("\\", "/");
  const absoluteFile = resolve(repositoryRoot, relativeFile);
  const source = readFileSync(absoluteFile, "utf8");
  const visible = outsideFences(source);
  const wordCount = source.trim().split(/\s+/u).filter(Boolean).length;
  const h1Count = (visible.match(/^#\s+\S.+$/gmu) ?? []).length;

  if (normalized.startsWith(".local/")) {
    failures.push(`${normalized}: private .local content must not be tracked`);
  }
  if (normalized.startsWith("docs/build-log/templates/")) {
    failures.push(`${normalized}: abandoned build-log templates must not be tracked`);
  }
  if (source.trim().length === 0 || wordCount < 40) {
    failures.push(`${normalized}: sparse Markdown (${wordCount} words)`);
  }
  if (mojibake.test(source)) {
    failures.push(`${normalized}: contains replacement or mojibake text`);
  }
  if (h1Optional.has(normalized) ? h1Count > 1 : h1Count !== 1) {
    failures.push(`${normalized}: expected ${h1Optional.has(normalized) ? "zero or one" : "exactly one"} H1, found ${h1Count}`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL Markdown quality: ${failures.length} issue(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS Markdown quality: ${markdownFiles.length} substantive tracked files; no private, abandoned-template, encoding, or heading defects`);
