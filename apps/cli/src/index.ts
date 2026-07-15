#!/usr/bin/env node

import { spawnSync } from "node:child_process";

interface CommandResult {
  readonly available: boolean;
  readonly exitCode: number | null;
  readonly output: string;
}

function runCommand(command: string, args: readonly string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    return { available: false, exitCode: null, output: "" };
  }

  return {
    available: true,
    exitCode: result.status,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}

function codexVersion(): CommandResult {
  if (process.platform === "win32") {
    return runCommand(process.env.ComSpec ?? "cmd.exe", [
      "/d",
      "/s",
      "/c",
      "codex.cmd --version",
    ]);
  }

  return runCommand("codex", ["--version"]);
}

export function runDoctor(): void {
  console.log(`node: ${process.version}`);

  const codex = codexVersion();
  if (!codex.available || codex.exitCode !== 0) {
    console.log("codex CLI: unavailable");
  } else {
    console.log(`codex CLI: ${codex.output}`);
  }

  const git = runCommand("git", ["status", "--porcelain=v1", "--branch"]);
  if (!git.available) {
    console.log("git repository: unavailable (git executable not found)");
  } else if (git.exitCode !== 0) {
    console.log("git repository: no");
  } else {
    const lines = git.output.split(/\r?\n/u);
    const branch = lines[0]?.replace(/^## /u, "") ?? "unknown branch";
    const state = lines.length > 1 ? "changes present" : "clean";
    console.log(`git repository: yes (${branch}; ${state})`);
  }
}

function printUsage(): void {
  console.log("Usage: axiomgate doctor");
}

const command = process.argv[2];

if (command === "doctor") {
  runDoctor();
} else {
  printUsage();
  process.exitCode = command === undefined ? 0 : 1;
}
