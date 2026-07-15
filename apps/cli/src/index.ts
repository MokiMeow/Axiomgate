#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { resolve } from "node:path";

import {
  approve as approveRequest,
  deny as denyRequest,
  listPending,
  runHookEntry,
} from "@axiomgate/core";

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
  console.log(
    "Usage: axiomgate doctor | axiomgate hook --mission <directory> | axiomgate approvals list [--mission <directory>] | axiomgate approve <id> [--mission <directory>] | axiomgate deny <id> [--mission <directory>]",
  );
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const command = process.argv[2];

function approvalMissionDir(): string {
  return resolve(argumentValue("--mission") ?? ".axiomgate");
}

function approvalActor(): string {
  return userInfo().username;
}

function inputHookEventName(rawInput: string): string {
  try {
    const value: unknown = JSON.parse(rawInput);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const hookEventName = (value as Record<string, unknown>).hook_event_name;
      if (typeof hookEventName === "string" && hookEventName.length > 0) {
        return hookEventName;
      }
    }
  } catch {
    // The core hook path will produce the detailed malformed-input denial.
  }
  return "PreToolUse";
}

if (command === "doctor") {
  runDoctor();
} else if (command === "hook") {
  const rawInput = readFileSync(0, "utf8");
  const missionDir = argumentValue("--mission");
  if (missionDir === undefined) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: inputHookEventName(rawInput),
          permissionDecision: "deny",
          permissionDecisionReason:
            "fail-closed: hook mission directory is required",
        },
      }),
    );
  } else {
    console.log(
      runHookEntry(rawInput, missionDir, {
        cliEntryPath: process.argv[1]!,
        nodePath: process.execPath,
      }),
    );
  }
} else if (command === "approvals" && process.argv[3] === "list") {
  try {
    const records = listPending(approvalMissionDir());
    if (records.length === 0) {
      console.log("No pending approvals.");
    } else {
      for (const record of records) {
        console.log(
          `${record.request.id} ${record.request.semanticAction} - ${record.reasons.join("; ")}`,
        );
      }
    }
  } catch (error) {
    console.error(
      `Unable to list approvals: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
} else if (command === "approve" || command === "deny") {
  const requestId = process.argv[3];
  if (requestId === undefined) {
    console.error(`Usage: axiomgate ${command} <id> [--mission <directory>]`);
    process.exitCode = 1;
  } else {
    const result =
      command === "approve"
        ? approveRequest(approvalMissionDir(), requestId, {
            approver: approvalActor(),
          })
        : denyRequest(approvalMissionDir(), requestId, {
            approver: approvalActor(),
          });
    if (result.status === "REJECTED") {
      console.error(`${command} rejected: ${result.reason}`);
      process.exitCode = 1;
    } else {
      console.log(`${requestId} ${result.status.toLowerCase()}.`);
    }
  }
} else {
  printUsage();
  process.exitCode = command === undefined ? 0 : 1;
}
