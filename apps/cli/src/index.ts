#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { resolve } from "node:path";

import {
  approve as approveRequest,
  createMission,
  currentCommit,
  deny as denyRequest,
  enforcementDriftWarning,
  IntentBoundarySchema,
  listPending,
  loadMissionStatus,
  loadMissionSnapshot,
  missionDirectory,
  parseMissionCriteria,
  readEnforcementVerification,
  recordWaiver,
  remediateMission,
  resolveCodexLaunch,
  reviewMission,
  resumeMission,
  runCommand as runExternalCommand,
  runHookEntry,
  runMission,
  setCapacitySnapshot,
  renderCapacitySnapshot,
  updateMission,
  verifyMission,
  verifyEnforcementInstallation,
  verifyReceiptFile,
  writeMissionReceipt,
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
    const currentVersion = codex.stdout.trim();
    console.log(`codex CLI: ${currentVersion}`);
    try {
      const warning = enforcementDriftWarning(
        currentVersion,
        readEnforcementVerification(),
      );
      if (warning !== undefined) {
        console.warn(warning);
      }
    } catch {
      console.warn(
        "WARNING: enforcement verification record is invalid - run axiomgate verify-enforcement",
      );
    }
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
    "Usage: axiomgate doctor | axiomgate verify-enforcement [--offline] | axiomgate runway set [--plan <name>] [--resets-available <count>] [--reset-expires <date>] [--project <path>] | axiomgate mission create --objective <text> [--boundary <level>] [--project <path>] [--criteria <file.json>] | axiomgate mission update <id> [--project <path>] | axiomgate mission run <id> [--prompt <text>] [--model <model>] [--effort <level>] [--timeout-ms <ms>] [--project <path>] | axiomgate mission resume <id> [--prompt <text>] [--timeout-ms <ms>] [--project <path>] | axiomgate mission review <id> [--model <model>] [--effort <level>] [--timeout-ms <ms>] [--project <path>] | axiomgate mission verify <id> [--project <path>] | axiomgate mission remediate <id> --finding <id> [--timeout-ms <ms>] [--project <path>] | axiomgate mission status <id> [--project <path>] | axiomgate mission waive <id> --criterion <id> --reason <text> --risk <text> [--project <path>] | axiomgate mission receipt <id> [--format json|md] [--project <path>] | axiomgate receipt verify <file> | axiomgate hook --mission <directory> | axiomgate approvals list [--mission <directory>] | axiomgate approve <id> [--mission <directory>] | axiomgate deny <id> [--mission <directory>]",
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

function nonnegativeIntegerArgument(name: string): number | undefined {
  const value = argumentValue(name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a nonnegative integer`);
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
    onRunwayStatus: (status: {
      capacityLine: string;
      reminder: string | undefined;
      reserve: { warning?: string };
    }) => {
      console.log(status.capacityLine);
      if (status.reminder !== undefined) {
        console.log(status.reminder);
      }
      if (status.reserve.warning !== undefined) {
        console.warn(status.reserve.warning);
      }
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
    if (result.checkpoint.reason === "rate_limit") {
      console.log(`Reset: ${result.checkpoint.resetAt ?? "UNKNOWN"}`);
      const resets = result.runway.capacity.resetsAvailable;
      if (resets !== undefined && resets.value > 0) {
        console.log(
          `Banked reset: ${resets.value} available [${resets.source}/${resets.confidence}]; activation is not automatic.`,
        );
      }
      console.log(
        `Resume: axiomgate mission resume ${id} --project ${JSON.stringify(projectPath())}`,
      );
    }
  }
  if (result.runway.loopRecommendation !== undefined) {
    console.warn(
      `Recommendation: ${result.runway.loopRecommendation.recommendation} (${result.runway.loopRecommendation.signal})`,
    );
  }
  if (result.record.status !== "SUCCESS") {
    process.exitCode = 1;
  }
}

function runRunwaySet(): void {
  const plan = argumentValue("--plan");
  const resetsAvailable = nonnegativeIntegerArgument("--resets-available");
  const resetExpires = argumentValue("--reset-expires");
  const snapshot = setCapacitySnapshot(projectPath(), {
    ...(plan === undefined ? {} : { plan }),
    ...(resetsAvailable === undefined ? {} : { resetsAvailable }),
    ...(resetExpires === undefined ? {} : { resetExpires }),
  });
  console.log(renderCapacitySnapshot(snapshot));
}

async function runVerifyEnforcement(): Promise<void> {
  const result = await verifyEnforcementInstallation({
    offline: process.argv.includes("--offline"),
    hookConfigOptions: hookConfigOptions(),
  });
  if (result.status === "PASS") {
    console.log(
      `PASS ${result.mode}: ${result.version}${
        result.mode === "OFFLINE" ? " (config generation only; live enforcement not verified)" : ""
      }`,
    );
    if (result.sessionId !== undefined) {
      console.log(`Session: ${result.sessionId}`);
    }
    if (result.verifiedAt !== null) {
      console.log(`Verified at: ${result.verifiedAt}`);
    }
  } else {
    console.error(`FAIL ${result.mode}: ${result.version} - ${result.reason}`);
    process.exitCode = 1;
  }
}

async function runMissionReview(id: string | undefined): Promise<void> {
  if (id === undefined) {
    throw new Error("mission id is required");
  }
  const model = argumentValue("--model");
  const effortValue = argumentValue("--effort");
  const effort = effortValue === undefined ? undefined : zEffort(effortValue);
  const timeoutMs = positiveIntegerArgument("--timeout-ms");
  const result = await reviewMission(projectPath(), id, {
    hookConfigOptions: hookConfigOptions(),
    ...(model === undefined ? {} : { model }),
    ...(effort === undefined ? {} : { effort }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    onReady: (plan) => {
      console.log(
        `Verifier: FRESH (${plan.model}/${plan.effort}; sandbox=${plan.sandbox})`,
      );
    },
  });
  console.log(`Session: ${result.record.sessionId ?? "unavailable"} (verifier)`);
  console.log(
    `Findings: ${result.findings.findings.length} (${result.findings.status}; advisory)`,
  );
  if (result.findings.status === "INVALID") {
    console.warn(`WARNING: ${result.findings.reason}`);
    process.exitCode = 1;
  }
  if (result.commandStatus !== "SUCCESS") {
    process.exitCode = 1;
  }
}

function runMissionVerify(id: string | undefined): void {
  if (id === undefined) {
    throw new Error("mission id is required");
  }
  const result = verifyMission(projectPath(), id, {
    hookConfigOptions: hookConfigOptions(),
  });
  console.log("Criterion | Check | State");
  for (const check of result.run.checks) {
    for (const criterionId of check.criterionIds) {
      console.log(`${criterionId} | ${check.kind} | ${check.status}`);
    }
  }
  console.log(`Overall: ${result.run.overall}`);
  console.log(`Findings: ${result.run.findings.length}`);
  console.log(`Evidence: ${result.evidence.length}`);
  if (result.run.overall !== "PASS") {
    process.exitCode = 1;
  }
}

async function runMissionRemediate(id: string | undefined): Promise<void> {
  if (id === undefined) {
    throw new Error("mission id is required");
  }
  const findingId = argumentValue("--finding");
  if (findingId === undefined) {
    throw new Error("--finding is required");
  }
  const timeoutMs = positiveIntegerArgument("--timeout-ms");
  const result = await remediateMission(projectPath(), id, findingId, {
    hookConfigOptions: hookConfigOptions(),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  console.log(
    `Remediation: ${result.remediation.record.status} (${result.plan.model}/${result.plan.effort})`,
  );
  if (result.verification === undefined) {
    console.log("Targeted verification: NOT RUN");
    process.exitCode = 1;
    return;
  }
  for (const check of result.verification.run.checks) {
    console.log(`${check.kind}: ${check.status}`);
  }
  console.log(`Targeted verification: ${result.verification.run.overall}`);
  if (result.verification.run.overall !== "PASS") {
    process.exitCode = 1;
  }
}

function runMissionStatus(id: string | undefined): void {
  if (id === undefined) throw new Error("mission id is required");
  const project = projectPath();
  const status = loadMissionStatus(project, id, {
    currentRevision: currentCommit(project),
  });
  console.log("Criterion | Verdict | Evidence");
  for (const criterion of status.gate.criteria) {
    console.log(
      `${criterion.criterionId} | ${criterion.verdict} | ${criterion.evidenceIds.join(", ") || "-"}`,
    );
    if (criterion.waiver !== undefined) {
      console.log(
        `  WAIVER ${criterion.waiver.approver}: ${criterion.waiver.reason} (risk: ${criterion.waiver.riskAccepted})`,
      );
    }
  }
  console.log(`Gate: ${status.gate.outcome}`);
  for (const reason of [
    ...status.gate.blockingReasons,
    ...status.gate.permissionMismatches,
  ]) {
    console.log(`BLOCKING: ${reason}`);
  }
  if (status.gate.outcome !== "COMPLETE") process.exitCode = 1;
}

function runMissionWaive(id: string | undefined): void {
  if (id === undefined) throw new Error("mission id is required");
  const criterionId = argumentValue("--criterion");
  const reason = argumentValue("--reason");
  const riskAccepted = argumentValue("--risk");
  if (criterionId === undefined || reason === undefined || riskAccepted === undefined) {
    throw new Error("--criterion, --reason, and --risk are required");
  }
  const waiver = recordWaiver(projectPath(), id, {
    criterionId,
    reason,
    riskAccepted,
    approver: approvalActor(),
  });
  console.log(`Waived ${waiver.criterionId} by ${waiver.approver}: ${waiver.reason}`);
}

function runMissionReceipt(id: string | undefined): void {
  if (id === undefined) throw new Error("mission id is required");
  const formatValue = argumentValue("--format") ?? "json";
  if (formatValue !== "json" && formatValue !== "md") {
    throw new Error("--format must be json or md");
  }
  const project = projectPath();
  const result = writeMissionReceipt(project, id, formatValue, {
    currentRevision: currentCommit(project),
  });
  console.log(`Receipt: ${result.path}`);
  console.log(`Outcome: ${result.receipt.outcome}`);
  console.log(`Evidence chain: ${result.receipt.evidenceChainHead}`);
}

function runReceiptVerify(path: string | undefined): void {
  if (path === undefined) throw new Error("receipt file is required");
  const result = verifyReceiptFile(path);
  if (result.valid) {
    console.log("PASS receipt integrity");
    for (const check of result.checks) console.log(`CHECKED: ${check}`);
  } else {
    console.error("FAIL receipt integrity");
    for (const error of result.errors) console.error(`ERROR: ${error}`);
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
} else if (command === "verify-enforcement") {
  await runVerifyEnforcement();
} else if (command === "runway" && process.argv[3] === "set") {
  try {
    runRunwaySet();
  } catch (error) {
    console.error(
      `Runway command failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
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
    } else if (missionCommand === "review") {
      await runMissionReview(process.argv[4]);
    } else if (missionCommand === "verify") {
      runMissionVerify(process.argv[4]);
    } else if (missionCommand === "remediate") {
      await runMissionRemediate(process.argv[4]);
    } else if (missionCommand === "status") {
      runMissionStatus(process.argv[4]);
    } else if (missionCommand === "waive") {
      runMissionWaive(process.argv[4]);
    } else if (missionCommand === "receipt") {
      runMissionReceipt(process.argv[4]);
    } else {
      throw new Error("expected mission create, update, run, resume, review, verify, remediate, status, waive, or receipt");
    }
  } catch (error) {
    console.error(
      `Mission command failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
} else if (command === "receipt" && process.argv[3] === "verify") {
  try {
    runReceiptVerify(process.argv[4]);
  } catch (error) {
    console.error(
      `Receipt verification failed: ${error instanceof Error ? error.message : "unknown error"}`,
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
