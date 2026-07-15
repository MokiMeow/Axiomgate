#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { resolve } from "node:path";

import {
  approve as approveRequest,
  createMission,
  deny as denyRequest,
  IntentBoundarySchema,
  listPending,
  loadMissionSnapshot,
  missionDirectory,
  parseMissionCriteria,
  resolveCodexLaunch,
  resumeMission,
  runCommand as runExternalCommand,
  runHookEntry,
  runMission,
  updateMission,
} from "@axiomgate/core";

function codexVersion() {
  const launch = resolveCodexLaunch();
  return runExternalCommand(launch.command, [...launch.argsPrefix, "--version"]);
}

export function runDoctor(): void {
  console.log(`node: ${process.version}`);

  const codex = codexVersion();
  if (codex.status !== "SUCCESS") {
    console.log("codex CLI: unavailable");
  } else {
    console.log(`codex CLI: ${codex.stdout.trim()}`);
  }

  const git = runExternalCommand("git", [
    "status",
    "--porcelain=v1",
    "--branch",
  ]);
  if (git.status === "UNAVAILABLE") {
    console.log("git repository: unavailable (git executable not found)");
  } else if (git.status !== "SUCCESS") {
    console.log("git repository: no");
  } else {
    const lines = git.stdout.trim().split(/\r?\n/u);
    const branch = lines[0]?.replace(/^## /u, "") ?? "unknown branch";
    const state = lines.length > 1 ? "changes present" : "clean";
    console.log(`git repository: yes (${branch}; ${state})`);
  }
}

function printUsage(): void {
  console.log(
    "Usage: axiomgate doctor | axiomgate mission create --objective <text> [--boundary <level>] [--project <path>] [--criteria <file.json>] | axiomgate mission update <id> [--project <path>] | axiomgate mission run <id> [--prompt <text>] [--model <model>] [--effort <level>] [--timeout-ms <ms>] [--project <path>] | axiomgate mission resume <id> [--prompt <text>] [--timeout-ms <ms>] [--project <path>] | axiomgate hook --mission <directory> | axiomgate approvals list [--mission <directory>] | axiomgate approve <id> [--mission <directory>] | axiomgate deny <id> [--mission <directory>]",
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

function projectPath(): string {
  return resolve(argumentValue("--project") ?? process.cwd());
}

function hookConfigOptions() {
  return {
    cliEntryPath: process.argv[1]!,
    nodePath: process.execPath,
  };
}

function runMissionCreate(): void {
  const objective = argumentValue("--objective");
  if (objective === undefined) {
    throw new Error("--objective is required");
  }
  const boundaryValue = argumentValue("--boundary");
  const criteriaPath = argumentValue("--criteria");
  const boundary =
    boundaryValue === undefined
      ? undefined
      : IntentBoundarySchema.parse(boundaryValue);
  const criteria =
    criteriaPath === undefined
      ? undefined
      : parseMissionCriteria(
          JSON.parse(readFileSync(resolve(criteriaPath), "utf8")),
        );
  const created = createMission(
    projectPath(),
    {
      objective,
      ...(boundary === undefined ? {} : { boundary }),
      ...(criteria === undefined ? {} : { criteria }),
    },
    { hookConfigOptions: hookConfigOptions() },
  );
  console.log(`Created mission ${created.contract.id}`);
  console.log(`Contract: ${resolve(created.missionDir, "contract.json")}`);
  console.log(`Boundary: ${created.contract.intentBoundary}`);
  for (const conflict of created.conflicts) {
    console.warn(
      `CONFLICT ${conflict.action}: ${conflict.reason}; edit the contract and run axiomgate mission update ${created.contract.id}`,
    );
  }
}

function runMissionUpdate(id: string | undefined): void {
  if (id === undefined) {
    throw new Error("mission id is required");
  }
  const updated = updateMission(projectPath(), id, {
    hookConfigOptions: hookConfigOptions(),
  });
  console.log(
    `Updated mission ${id} to version ${updated.contract.version} (${updated.contract.hash})`,
  );
}

function positiveIntegerArgument(name: string): number | undefined {
  const value = argumentValue(name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function missionObjective(id: string): string {
  const loaded = loadMissionSnapshot(missionDirectory(projectPath(), id));
  if (loaded.status === "INVALID") {
    throw new Error(`mission snapshot invalid: ${loaded.reason}`);
  }
  return loaded.snapshot.contract.objective;
}

async function runGovernedMission(
  id: string | undefined,
  resume: boolean,
): Promise<void> {
  if (id === undefined) {
    throw new Error("mission id is required");
  }
  const prompt =
    argumentValue("--prompt") ??
    (resume
      ? "Continue from the recorded checkpoint within the mission contract."
      : `Execute this mission objective: ${missionObjective(id)}`);
  const model = argumentValue("--model");
  const effortValue = argumentValue("--effort");
  const effort =
    effortValue === undefined
      ? undefined
      : zEffort(effortValue);
  const timeoutMs = positiveIntegerArgument("--timeout-ms");
  const options = {
    prompt,
    hookConfigOptions: hookConfigOptions(),
    ...(model === undefined ? {} : { model }),
    ...(effort === undefined ? {} : { effort }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    onReady: (plan: { configHash: string; sandbox: string }) => {
      console.log(
        `Enforcement: VERIFIED (${plan.configHash}; sandbox=${plan.sandbox})`,
      );
    },
  } as const;
  const result = resume
    ? await resumeMission(projectPath(), id, options)
    : await runMission(projectPath(), id, options);
  console.log(`Run: ${result.record.id} ${result.record.status}`);
  console.log(`Session: ${result.record.sessionId ?? "unavailable"}`);
  console.log(`Usage records: ${result.record.rawUsageCount}`);
  if (result.checkpoint !== undefined) {
    console.log(`Checkpoint: ${result.checkpoint.reason}`);
  }
  if (result.record.status !== "SUCCESS") {
    process.exitCode = 1;
  }
}

function zEffort(value: string): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  throw new Error("--effort must be low, medium, or high");
}

if (command === "doctor") {
  runDoctor();
} else if (command === "mission") {
  try {
    const missionCommand = process.argv[3];
    if (missionCommand === "create") {
      runMissionCreate();
    } else if (missionCommand === "update") {
      runMissionUpdate(process.argv[4]);
    } else if (missionCommand === "run") {
      await runGovernedMission(process.argv[4], false);
    } else if (missionCommand === "resume") {
      await runGovernedMission(process.argv[4], true);
    } else {
      throw new Error("expected mission create, update, run, or resume");
    }
  } catch (error) {
    console.error(
      `Mission command failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
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
