#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join, resolve } from "node:path";

import {
  approve as approveRequest,
  createMission,
  codexNativeStatus,
  currentCommit,
  deny as denyRequest,
  enforcementDriftWarning,
  formatReasoningEffort,
  IntentBoundarySchema,
  installCodexIntegration,
  listPending,
  loadMissionStatus,
  loadMissionSnapshot,
  liveLimitSummary,
  missionDirectory,
  parseMissionCriteria,
  readEnforcementVerification,
  readCodexRateLimits,
  ReasoningEffortSchema,
  recordWaiver,
  MODEL_DIRECTOR_NOTE,
  renderModelDirectorSummary,
  remediateMission,
  resolveCodexLaunch,
  reviewMission,
  runSubmissionReplay,
  resumeMission,
  runCommand as runExternalCommand,
  runHookEntry,
  runMission,
  resolveRunwayCapacity,
  setCapacitySnapshot,
  renderCapacitySnapshot,
  renderRunwayCapacity,
  updateMission,
  verifyMission,
  verifyEnforcementInstallation,
  verifyReceiptFile,
  writeMissionReceipt,
  type ReasoningEffort,
} from "@axiomgate/core";
import { ui, type UiStatus } from "./ui.js";
import { runMcpServer } from "./mcp.js";
import { friendlyMissionError, hasHelpFlag } from "./cli-args.js";

function verdictStatus(value: string): UiStatus {
  const normalized = value.toUpperCase();
  if (/^(?:PASS|COMPLETE|SUCCESS|ALLOW|APPROVED|WRITTEN|UNCHANGED|PRESENT)$/u.test(normalized)) {
    return "success";
  }
  if (/^(?:FAIL|FAILED|DENY|DENIED|REJECTED|BLOCKED|CONFLICT|ABSENT)$/u.test(normalized)) {
    return "failure";
  }
  if (/^(?:UNKNOWN|UNAVAILABLE|UNVERIFIED|WARNING|REQUIRE_APPROVAL)$/u.test(normalized)) {
    return "warning";
  }
  return "neutral";
}

function verdict(value: string): string {
  return `${ui.glyph(verdictStatus(value))} ${value}`;
}

function printCommandHeader(name: string, detail?: string): void {
  console.log(ui.header(name, detail));
  console.log(ui.rule());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function codexVersion() {
  const launch = resolveCodexLaunch();
  return runExternalCommand(launch.command, [...launch.argsPrefix, "--version"]);
}

function codexHome(): string {
  return resolve(process.env.CODEX_HOME ?? join(homedir(), ".codex"));
}

export async function runDoctor(): Promise<void> {
  printCommandHeader("doctor", "environment & trust");
  const rows: { key: string; value: string; subline?: string }[] = [
    { key: "Node", value: `${ui.glyph("success")} ${process.version}` },
    {
      key: "Model Director",
      value: renderModelDirectorSummary(),
      subline: MODEL_DIRECTOR_NOTE,
    },
  ];
  const warnings: string[] = [];

  const codex = codexVersion();
  if (codex.status !== "SUCCESS") {
    rows.push({ key: "Codex CLI", value: verdict("UNAVAILABLE") });
  } else {
    const currentVersion = codex.stdout.trim();
    rows.push({ key: "Codex CLI", value: `${ui.glyph("success")} ${currentVersion}` });
    try {
      const warning = enforcementDriftWarning(
        currentVersion,
        readEnforcementVerification(),
      );
      if (warning !== undefined) {
        warnings.push(warning);
      }
    } catch {
      warnings.push(
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
    rows.push({ key: "Git repository", value: verdict("UNAVAILABLE") });
  } else if (git.status !== "SUCCESS") {
    rows.push({ key: "Git repository", value: verdict("ABSENT") });
  } else {
    const lines = git.stdout.trim().split(/\r?\n/u);
    const branch = lines[0]?.replace(/^## /u, "") ?? "unknown branch";
    const state = lines.length > 1 ? "changes present" : "clean";
    rows.push({
      key: "Git repository",
      value: `${ui.glyph(state === "clean" ? "success" : "warning")} ${branch}; ${state}`,
    });
  }

  const capacity = await readCodexRateLimits();
  if (capacity.status === "UNAVAILABLE") {
    rows.push({
      key: "Codex capacity",
      value: `${verdict("UNAVAILABLE")} (${capacity.reason})`,
    });
  } else {
    const weekly =
      capacity.sources.find(
        (source) =>
          source.limitId === "codex" && source.windowLabel === "weekly",
      ) ?? capacity.sources.find((source) => source.windowLabel === "weekly");
    rows.push({
      key: "Codex capacity",
      value: weekly === undefined
        ? `${verdict("UNAVAILABLE")} (weekly window not reported)`
        : `${ui.glyph("success")} plan=${weekly.planType}; weekly used=${weekly.usedPercent}%; resets=${weekly.resetsAt} [${weekly.source}/${weekly.confidence}]`,
    });
  }

  const native = codexNativeStatus(codexHome(), {
    runner: runExternalCommand,
    codexLaunch: resolveCodexLaunch(),
  });
  rows.push({
    key: "AxiomGate skill",
    value:
      native.skill.via === "plugin"
        ? `${ui.glyph("success")} via plugin ${native.skill.pluginId}`
        : `${verdict(native.skill.installed ? "PRESENT" : "ABSENT")} (${native.skill.path})`,
  });
  rows.push({
    key: "Verifier agent",
    value:
      native.verifierAgent.via === "plugin"
        ? `${ui.glyph("success")} via plugin ${native.verifierAgent.pluginId}`
        : `${verdict(native.verifierAgent.installed ? "PRESENT" : "ABSENT")} (${native.verifierAgent.path})`,
  });
  console.log(ui.rows(rows));
  for (const warning of warnings) {
    console.warn(ui.callout("warning", "ENFORCEMENT DRIFT", [warning]));
  }
}

function printUsage(): void {
  console.log("Native Codex: axiomgate install-codex [--dry-run]");
  console.log("Agent protocol: axiomgate mcp");
  console.log("Credential-free proof: axiomgate replay all");
  console.log("Runway: axiomgate runway status [--project <path>]");
  console.log(
    "Usage: axiomgate doctor | axiomgate replay all | axiomgate verify-enforcement [--offline] | axiomgate runway set [--plan <name>] [--resets-available <count>] [--reset-expires <date>] [--project <path>] | axiomgate mission create --objective <text> [--boundary <level>] [--project <path>] [--criteria <file.json>] | axiomgate mission update <id> [--project <path>] | axiomgate mission run <id> [--prompt <text>] [--model <model>] [--effort <level>] [--timeout-ms <ms>] [--project <path>] | axiomgate mission resume <id> [--prompt <text>] [--timeout-ms <ms>] [--project <path>] | axiomgate mission review <id> [--model <model>] [--effort <level>] [--timeout-ms <ms>] [--project <path>] | axiomgate mission verify <id> [--project <path>] | axiomgate mission remediate <id> --finding <id> [--timeout-ms <ms>] [--project <path>] | axiomgate mission status <id> [--project <path>] | axiomgate mission waive <id> --criterion <id> --reason <text> --risk <text> [--project <path>] | axiomgate mission receipt <id> [--format json|md] [--project <path>] | axiomgate receipt verify <file> | axiomgate hook --mission <directory> | axiomgate approvals list [--mission <directory>] | axiomgate approve <id> [--mission <directory>] | axiomgate deny <id> [--mission <directory>]",
  );
}

function runInstallCodex(): void {
  const launch = resolveCodexLaunch();
  const result = installCodexIntegration({
    sourceRoot: process.cwd(),
    codexHome: codexHome(),
    dryRun: process.argv.includes("--dry-run"),
    runner: runExternalCommand,
    codexLaunch: launch,
    cliEntryPath: process.argv[1]!,
    nodePath: process.execPath,
  });
  printCommandHeader("install-codex", result.strategy.toLowerCase().replace("_", " "));
  console.log(ui.rows([
    { key: "Mode", value: result.mode },
    { key: "Strategy", value: result.strategy },
  ]));
  console.log(ui.rule("artifacts"));
  for (const action of result.actions) {
    console.log(`${verdict(action.status)}  ${action.source} -> ${action.target}`);
    if (action.status === "CONFLICT") process.exitCode = 1;
  }
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function argumentValues(name: string): string[] {
  return process.argv.flatMap((value, index) =>
    value === name && process.argv[index + 1] !== undefined
      ? [process.argv[index + 1]!]
      : [],
  );
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
  const mcpToolMatchers = argumentValues("--mcp-tool-matcher");
  return {
    cliEntryPath: process.argv[1]!,
    nodePath: process.execPath,
    ...(mcpToolMatchers.length === 0 ? {} : { mcpToolMatchers }),
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
  printCommandHeader("mission create", created.contract.id);
  console.log(ui.rows([
    { key: "Status", value: verdict("SUCCESS") },
    { key: "Contract", value: resolve(created.missionDir, "contract.json") },
    { key: "Boundary", value: created.contract.intentBoundary },
    { key: "Criteria", value: created.contract.acceptanceCriteria.length },
  ]));
  for (const conflict of created.conflicts) {
    console.warn(ui.callout("warning", `CONFLICT · ${conflict.action}`, [
      conflict.reason,
      `Next: edit the contract and run axiomgate mission update ${created.contract.id}`,
    ]));
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
      const live = liveLimitSummary(result.runway.capacity);
      console.log(
        `Reset: ${live?.resetsAt ?? result.checkpoint.resetAt ?? "UNKNOWN"}`,
      );
      const manualResets =
        result.runway.capacity.status === "MANUAL"
          ? result.runway.capacity.snapshot.resetsAvailable
          : undefined;
      const resetCount = live?.availableResetCount ?? manualResets?.value ?? 0;
      if (resetCount > 0) {
        console.log(
          `Banked reset: ${resetCount} available [${
            live === undefined
              ? `${manualResets?.source}/${manualResets?.confidence}`
              : "codex-app-server/high"
          }]; activation is not automatic.`,
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
  const liveLimit = liveLimitSummary(result.runway.capacity);
  if (liveLimit?.limited === true && result.checkpoint?.reason !== "rate_limit") {
    console.warn(
      `LIMIT REACHED: reset=${liveLimit.resetsAt ?? "UNKNOWN"}; banked resets=${liveLimit.availableResetCount}; ` +
        `resume with: axiomgate mission resume ${id} --project ${JSON.stringify(projectPath())}`,
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

async function runRunwayStatus(): Promise<void> {
  const capacity = await resolveRunwayCapacity(projectPath());
  printCommandHeader("runway status", "live capacity");
  console.log(ui.rows([
    {
      key: "Model Director",
      value: renderModelDirectorSummary(),
      subline: MODEL_DIRECTOR_NOTE,
    },
  ]));
  console.log(ui.rule("capacity"));
  console.log(renderRunwayCapacity(capacity));
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
        `Verifier: FRESH (${plan.model}/${formatReasoningEffort(plan.effort)}; sandbox=${plan.sandbox})`,
      );
      console.log(`Native verifier: ${plan.nativeDelegation.reason}`);
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
  printCommandHeader("mission verify", id);
  const rows: string[][] = [];
  for (const check of result.run.checks) {
    for (const criterionId of check.criterionIds) {
      rows.push([criterionId, check.kind, verdict(check.status)]);
    }
  }
  console.log(ui.table(["Criterion", "Check", "State"], rows));
  console.log(ui.rule("summary"));
  console.log(ui.rows([
    { key: "Overall", value: verdict(result.run.overall) },
    { key: "Findings", value: result.run.findings.length },
    { key: "Evidence", value: result.evidence.length },
  ]));
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
    `Remediation: ${result.remediation.record.status} (${result.plan.model}/${formatReasoningEffort(result.plan.effort)})`,
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
  printCommandHeader("mission status", id);
  console.log(ui.rule("model plan"));
  console.log(ui.table(
    ["Phase", "Model", "Effort"],
    status.contract.modelPlan.map((phase) => [
      phase.phase,
      phase.model,
      formatReasoningEffort(phase.effort),
    ]),
  ));
  for (const phase of status.contract.modelPlan) {
    if (phase.capabilityNote !== undefined) {
      console.log(`${ui.glyph("neutral")} ${phase.phase}: ${phase.capabilityNote}`);
    }
  }
  console.log(ui.rule("proof table"));
  const proofRows: string[][] = [];
  for (const criterion of status.gate.criteria) {
    proofRows.push([
      criterion.criterionId,
      verdict(criterion.verdict),
      criterion.evidenceIds.join(", ") || "-",
    ]);
    if (criterion.waiver !== undefined) {
      proofRows.push([
        `↳ waiver by ${criterion.waiver.approver}`,
        verdict("WARNING"),
        `${criterion.waiver.reason} (risk: ${criterion.waiver.riskAccepted})`,
      ]);
    }
  }
  console.log(ui.table(["Criterion", "Verdict", "Evidence"], proofRows));
  const reasons = [
    ...status.gate.blockingReasons,
    ...status.gate.permissionMismatches,
  ];
  console.log(ui.callout(
    status.gate.outcome === "COMPLETE" ? "success" : "failure",
    status.gate.outcome === "COMPLETE" ? "PROOF GATE · COMPLETE" : "BLOCKED · PROOF GATE NOT SATISFIED",
    reasons.length === 0 ? ["Every required criterion is backed by fresh admissible evidence."] : reasons,
  ));
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
  printCommandHeader("mission receipt", id);
  console.log(ui.rows([
    { key: "Receipt", value: result.path },
    { key: "Outcome", value: verdict(result.receipt.outcome) },
    { key: "Evidence chain", value: result.receipt.evidenceChainHead },
  ]));
}

function runReceiptVerify(path: string | undefined): void {
  if (path === undefined) throw new Error("receipt file is required");
  const result = verifyReceiptFile(path);
  if (result.valid) {
    printCommandHeader("receipt verify", path);
    console.log(ui.callout("success", "PASS · RECEIPT INTEGRITY", result.checks));
  } else {
    printCommandHeader("receipt verify", path);
    console.error(ui.callout("failure", "FAIL · RECEIPT INTEGRITY", result.errors));
    process.exitCode = 1;
  }
}

function zEffort(value: string): ReasoningEffort {
  const parsed = ReasoningEffortSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new Error("--effort must be light, medium, high, xhigh, or max");
}

function runReplayAll(): void {
  const results = runSubmissionReplay();
  printCommandHeader("replay all", "deterministic · no credentials");
  console.log(
    ui.table(
      ["Scenario", "Expected", "Observed", "Result"],
      results.map((result) => [
        result.title,
        result.expected,
        result.observed,
        verdict(result.status),
      ]),
    ),
  );
  console.log(
    ui.callout(
      results.every((result) => result.status === "PASS") ? "success" : "failure",
      results.every((result) => result.status === "PASS")
        ? "PASS · GOVERNANCE REPLAY"
        : "FAIL · GOVERNANCE REPLAY",
      ["Production policy, approval-binding, and evidence-gate logic executed locally."],
    ),
  );
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
}

if (hasHelpFlag(process.argv.slice(2))) {
  printUsage();
} else if (command === "mcp") {
  await runMcpServer();
} else if (command === "install-codex") {
  try {
    runInstallCodex();
  } catch (error) {
    console.error(ui.callout("failure", "CODEX INTEGRATION INSTALL FAILED", [errorMessage(error)]));
    process.exitCode = 1;
  }
} else if (command === "doctor") {
  await runDoctor();
} else if (command === "replay" && process.argv[3] === "all") {
  runReplayAll();
} else if (command === "verify-enforcement") {
  await runVerifyEnforcement();
} else if (command === "runway" && process.argv[3] === "set") {
  try {
    runRunwaySet();
  } catch (error) {
    console.error(ui.callout("failure", "RUNWAY COMMAND FAILED", [errorMessage(error)]));
    process.exitCode = 1;
  }
} else if (command === "runway" && process.argv[3] === "status") {
  try {
    await runRunwayStatus();
  } catch (error) {
    console.error(ui.callout("failure", "RUNWAY COMMAND FAILED", [errorMessage(error)]));
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
    console.error(ui.callout("failure", "MISSION COMMAND FAILED", [
      friendlyMissionError(error, process.argv[4], projectPath()),
    ]));
    process.exitCode = 1;
  }
} else if (command === "receipt" && process.argv[3] === "verify") {
  try {
    runReceiptVerify(process.argv[4]);
  } catch (error) {
    console.error(ui.callout("failure", "RECEIPT VERIFICATION FAILED", [errorMessage(error)]));
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
    const approvalsReviewer = argumentValue("--approvals-reviewer");
    console.log(
      runHookEntry(rawInput, missionDir, {
        cliEntryPath: process.argv[1]!,
        nodePath: process.execPath,
        ...(approvalsReviewer === undefined ? {} : { approvalsReviewer }),
        ...(argumentValues("--mcp-tool-matcher").length === 0
          ? {}
          : { mcpToolMatchers: argumentValues("--mcp-tool-matcher") }),
      }),
    );
  }
} else if (command === "approvals" && process.argv[3] === "list") {
  try {
    const records = listPending(approvalMissionDir());
    printCommandHeader("approvals list", `${records.length} pending`);
    if (records.length === 0) {
      console.log(`${ui.glyph("success")} No pending approvals.`);
    } else {
      for (const record of records) {
        console.log(ui.callout("warning", "APPROVAL REQUIRED", [
          `${record.request.id} · ${record.request.semanticAction}`,
          ...record.reasons,
          `Next: axiomgate approve ${record.request.id} --mission ${JSON.stringify(approvalMissionDir())}`,
        ]));
      }
    }
  } catch (error) {
    console.error(ui.callout("failure", "UNABLE TO LIST APPROVALS", [errorMessage(error)]));
    process.exitCode = 1;
  }
} else if (command === "approve" || command === "deny") {
  const requestId = process.argv[3];
  if (requestId === undefined) {
    console.error(ui.callout("failure", `${command.toUpperCase()} REQUIRES AN ID`, [
      `Usage: axiomgate ${command} <id> [--mission <directory>]`,
    ]));
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
      console.error(ui.callout("failure", `${command.toUpperCase()} REJECTED`, [result.reason]));
      process.exitCode = 1;
    } else {
      printCommandHeader(command, requestId);
      console.log(ui.callout(
        command === "approve" ? "success" : "failure",
        `${requestId} · ${result.status}`,
        [command === "approve" ? "Bound approval recorded; the hook remains the enforcement point." : "Denial recorded; the action remains blocked."],
      ));
    }
  }
} else {
  printUsage();
  process.exitCode = command === undefined ? 0 : 1;
}
