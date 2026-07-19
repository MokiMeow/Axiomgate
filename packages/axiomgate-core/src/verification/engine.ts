import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

import { EvidenceSchema, type Evidence } from "../evidence/index.js";
import {
  resolveIdentity as resolveCurrentIdentity,
  runCommand,
  verifyEnforcement,
  type CommandResult,
  type CommandRunner,
  type HookConfigOptions,
  type IdentityReport,
} from "../guard/index.js";
import {
  currentCommit as resolveCurrentCommit,
  identityReportsMatch,
  missionDirectory,
} from "../runtime/index.js";
import {
  commandStatusToCheckState,
  detectNativeChecks,
  parsePatchPilotOutput,
  patchPilotArgs,
  scanDiffForSecrets,
} from "./checks/index.js";
import {
  calculateVerificationOverall,
  createVerificationPlan,
} from "./planner.js";
import { createVerificationRun } from "./run.js";
import {
  VerificationEventSchema,
  VerificationFindingSchema,
  VerificationRunSchema,
  type VerificationCheck,
  type VerificationCheckState,
  type VerificationEvent,
  type VerificationFinding,
  type VerificationRun,
} from "./types.js";

const NATIVE_TIMEOUT_MS = 120_000;
const SCAN_TIMEOUT_MS = 60_000;

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function commandText(result: CommandResult): string {
  return [result.command, ...result.args].join(" ");
}

function outputText(result: CommandResult): string {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

function appendJsonLine(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
}

function stableFindingId(parts: readonly string[]): string {
  return `finding_${createHash("sha256")
    .update(parts.join("\u0000"), "utf8")
    .digest("hex")
    .slice(0, 20)}`;
}

interface CheckOutcome {
  readonly status: VerificationCheckState;
  readonly reason: string;
  readonly results: readonly CommandResult[];
  readonly findings: readonly VerificationFinding[];
}

export interface VerifyMissionOptions {
  readonly runId?: string;
  readonly hookConfigOptions?: HookConfigOptions;
  readonly resolveIdentity?: (projectPath: string) => IdentityReport;
  readonly identityRunner?: CommandRunner;
  readonly runner?: CommandRunner;
  readonly currentCommit?: (projectPath: string) => string;
  readonly now?: () => Date;
  readonly checkKinds?: readonly string[];
}

export interface VerifyMissionResult {
  readonly run: VerificationRun;
  readonly evidence: readonly Evidence[];
}

function aggregateNative(results: readonly CommandResult[]): VerificationCheckState {
  const states = results.map((result) => commandStatusToCheckState(result.status));
  if (states.includes("FAIL")) return "FAIL";
  if (states.includes("BLOCKED")) return "BLOCKED";
  if (states.includes("UNKNOWN")) return "UNKNOWN";
  return states.length > 0 ? "PASS" : "UNKNOWN";
}

function executeNativeCheck(
  check: VerificationCheck,
  workspace: string,
  runner: CommandRunner,
): CheckOutcome {
  const commands = detectNativeChecks(workspace).filter(
    (candidate) => candidate.kind === check.kind,
  );
  if (commands.length === 0) {
    return {
      status: "UNKNOWN",
      reason: `No native ${
        check.kind === "target.lockout-test"
          ? "lockout test"
          : check.kind === "target.test"
            ? "test"
            : "build"
      } command detected`,
      results: [],
      findings: [],
    };
  }
  const results = commands.map((command) =>
    runner(command.command, command.args, {
      cwd: workspace,
      timeoutMs: NATIVE_TIMEOUT_MS,
    }),
  );
  const status = aggregateNative(results);
  return {
    status,
    reason:
      status === "PASS"
        ? `${commands.length} native command${commands.length === 1 ? "" : "s"} passed`
        : `${commands.length} native command${commands.length === 1 ? "" : "s"} completed with ${status}`,
    results,
    findings: [],
  };
}

function executePatchPilotCheck(
  check: VerificationCheck,
  workspace: string,
  runner: CommandRunner,
): CheckOutcome {
  const result = runner("npx", patchPilotArgs(workspace), {
    cwd: workspace,
    timeoutMs: SCAN_TIMEOUT_MS,
  });
  if (result.status === "UNAVAILABLE") {
    return { status: "UNKNOWN", reason: result.stderr || "PatchPilot is unavailable", results: [result], findings: [] };
  }
  if (result.status === "TIMED_OUT") {
    return { status: "BLOCKED", reason: "PatchPilot scan timed out", results: [result], findings: [] };
  }
  const parsed = parsePatchPilotOutput(result.stdout);
  if (parsed.status === "UNKNOWN") {
    return { status: "UNKNOWN", reason: parsed.reason, results: [result], findings: [] };
  }
  const findings = parsed.findings.map((finding) =>
    VerificationFindingSchema.parse({
      id: stableFindingId([
        check.id,
        finding.ecosystem,
        finding.package,
        finding.version,
        finding.advisory,
      ]),
      checkId: check.id,
      criterionIds: check.criterionIds,
      title: `${finding.package}@${finding.version}: ${finding.advisory}`,
      detail: `${finding.severity} ${finding.ecosystem} dependency finding; ${finding.reachabilityNote}`,
      severity: finding.severity,
      status: "validated",
      advisory: finding.advisory,
      ecosystem: finding.ecosystem,
      package: finding.package,
      version: finding.version,
      fixedVersion: finding.fixedVersion,
      reachability: finding.reachability,
    }),
  );
  return {
    status: findings.length > 0 ? "FAIL" : "PASS",
    reason:
      findings.length > 0
        ? `PatchPilot ${parsed.scanner} reported ${findings.length} finding${findings.length === 1 ? "" : "s"}`
        : `PatchPilot ${parsed.scanner} reported no findings`,
    results: [result],
    findings,
  };
}

function executeSecretCheck(
  check: VerificationCheck,
  workspace: string,
  diff: string,
  runner: CommandRunner,
): CheckOutcome {
  const version = runner("gitleaks", ["version"], {
    cwd: workspace,
    timeoutMs: 15_000,
  });
  if (version.status !== "UNAVAILABLE") {
    const scan = runner(
      "gitleaks",
      ["detect", "--source", workspace, "--no-banner", "--report-format", "json", "--report-path", "-"],
      { cwd: workspace, timeoutMs: SCAN_TIMEOUT_MS },
    );
    return {
      status: commandStatusToCheckState(scan.status),
      reason:
        scan.status === "SUCCESS"
          ? "gitleaks reported no findings"
          : scan.status === "FAILED"
            ? "gitleaks reported potential secrets"
            : `gitleaks completed with ${scan.status}`,
      results: [version, scan],
      findings: [],
    };
  }

  const heuristic = scanDiffForSecrets(diff);
  const synthetic: CommandResult = {
    command: "builtin-secret-scan",
    args: ["--diff"],
    status: heuristic.status === "PASS" ? "SUCCESS" : "FAILED",
    exitCode: heuristic.status === "PASS" ? 0 : 1,
    stdout: JSON.stringify(heuristic),
    stderr: version.stderr,
    durationMs: version.durationMs,
  };
  const findings = heuristic.findings.map((finding) =>
    VerificationFindingSchema.parse({
      id: stableFindingId([check.id, String(finding.line), finding.pattern]),
      checkId: check.id,
      criterionIds: check.criterionIds,
      title: `Potential secret in added diff line ${finding.line}`,
      detail: `${finding.detail}; scanner=builtin-regex-heuristic`,
      severity: "high",
      status: "candidate",
    }),
  );
  return {
    status: heuristic.status,
    reason:
      findings.length === 0
        ? "Built-in diff heuristic reported no obvious credentials (gitleaks unavailable)"
        : `Built-in diff heuristic reported ${findings.length} potential secret${findings.length === 1 ? "" : "s"} (gitleaks unavailable)`,
    results: [synthetic],
    findings,
  };
}

function evidenceForResult(
  result: CommandResult,
  criterionId: string,
  missionId: string,
  commit: string,
  capturedAt: string,
  outputRef: string,
): Evidence {
  const output = outputText(result);
  return EvidenceSchema.parse({
    id: `evd_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
    missionId,
    criterionId,
    source: "command",
    command: commandText(result),
    exitCode: result.exitCode,
    outputHash: sha256(output),
    outputRef,
    capturedAt,
    freshForCommit: commit,
    label: "LIVE",
    redacted: true,
  });
}

function changedFiles(output: string): string[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function verifyMission(
  projectPath: string,
  id: string,
  options: VerifyMissionOptions = {},
): VerifyMissionResult {
  const workspace = resolve(projectPath);
  const missionDir = missionDirectory(workspace, id);
  const enforcement = verifyEnforcement(missionDir, options.hookConfigOptions);
  if (enforcement.status === "REFUSED") {
    throw new Error(`Verification refused: ${enforcement.reason}`);
  }
  const freshIdentity = options.resolveIdentity?.(workspace) ??
    resolveCurrentIdentity({
      cwd: workspace,
      ...(options.identityRunner === undefined
        ? {}
        : { runner: options.identityRunner }),
    });
  if (!identityReportsMatch(enforcement.snapshot.identity, freshIdentity)) {
    throw new Error("Verification refused: identity differs from the mission snapshot; run mission update");
  }

  const runner = options.runner ?? runCommand;
  const diffResult = runner("git", ["diff", "--no-ext-diff", "--binary", "HEAD", "--"], {
    cwd: workspace,
    timeoutMs: 30_000,
  });
  const namesResult = runner("git", ["diff", "--name-only", "HEAD", "--"], {
    cwd: workspace,
    timeoutMs: 15_000,
  });
  const diff = diffResult.stdout;
  const commit = (options.currentCommit ?? resolveCurrentCommit)(workspace);
  const plan = createVerificationPlan({
    contract: enforcement.snapshot.contract,
    workspace,
    diff,
    changedFiles: changedFiles(namesResult.stdout),
  });
  const selected = options.checkKinds === undefined
    ? plan.checks
    : plan.checks.filter((check) => options.checkKinds?.includes(check.kind));
  let run = createVerificationRun({ ...plan, checks: selected }, commit, {
    ...(options.runId === undefined ? {} : { id: options.runId }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const verificationDir = join(missionDir, "verification");
  const outputDir = join(verificationDir, run.id);
  const eventsPath = join(missionDir, "events.jsonl");
  mkdirSync(outputDir, { recursive: true });
  appendJsonLine(eventsPath, run.events[0]);

  const evidence: Evidence[] = [];
  const findings: VerificationFinding[] = [];
  const completedChecks: VerificationCheck[] = [];
  const events: VerificationEvent[] = [...run.events];

  for (const check of run.checks) {
    let outcome: CheckOutcome;
    if (check.kind === "git.diff") {
      outcome = {
        status: commandStatusToCheckState(diffResult.status),
        reason: diffResult.status === "SUCCESS" ? "Git diff captured" : `Git diff completed with ${diffResult.status}`,
        results: [diffResult],
        findings: [],
      };
    } else if (
      check.kind === "target.test" ||
      check.kind === "target.lockout-test" ||
      check.kind === "target.build"
    ) {
      outcome = executeNativeCheck(check, workspace, runner);
    } else if (check.kind === "dependency.scan") {
      outcome = executePatchPilotCheck(check, workspace, runner);
    } else if (check.kind === "secret.scan") {
      outcome = executeSecretCheck(check, workspace, diff, runner);
    } else {
      outcome = {
        status: "UNKNOWN",
        reason: `No executor is registered for ${check.kind}`,
        results: [],
        findings: [],
      };
    }

    const checkEvidence: Evidence[] = [];
    for (const [index, result] of outcome.results.entries()) {
      const filename = `${check.id}_${index + 1}.log`;
      const absoluteOutputPath = join(outputDir, filename);
      writeFileSync(absoluteOutputPath, outputText(result), "utf8");
      for (const criterionId of check.criterionIds) {
        const item = evidenceForResult(
          result,
          criterionId,
          id,
          commit,
          (options.now ?? (() => new Date()))().toISOString(),
          relative(workspace, absoluteOutputPath).replaceAll("\\", "/"),
        );
        evidence.push(item);
        checkEvidence.push(item);
        appendJsonLine(eventsPath, item);
      }
    }
    findings.push(...outcome.findings);
    const completed = {
      ...check,
      status: outcome.status,
      reason: outcome.reason,
      ...(checkEvidence.length > 0 ? { evidenceIds: checkEvidence.map((item) => item.id) } : {}),
      ...(outcome.findings.length > 0 ? { findingIds: outcome.findings.map((item) => item.id) } : {}),
    } satisfies VerificationCheck;
    completedChecks.push(completed);
    const event = VerificationEventSchema.parse({
      type: "verification.check.completed",
      ts: (options.now ?? (() => new Date()))().toISOString(),
      missionId: id,
      runId: run.id,
      checkId: check.id,
      status: outcome.status,
      message: outcome.reason,
    });
    events.push(event);
    appendJsonLine(eventsPath, event);
  }

  const overall = calculateVerificationOverall(completedChecks);
  const endedAt = (options.now ?? (() => new Date()))().toISOString();
  const completion = VerificationEventSchema.parse({
    type: "verification.completed",
    ts: endedAt,
    missionId: id,
    runId: run.id,
    status: overall,
    message: `Verification completed with ${overall}`,
  });
  events.push(completion);
  appendJsonLine(eventsPath, completion);
  run = VerificationRunSchema.parse({
    ...run,
    endedAt,
    overall,
    checks: completedChecks,
    findings,
    events,
  });
  mkdirSync(verificationDir, { recursive: true });
  writeFileSync(join(verificationDir, `${run.id}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  writeFileSync(join(missionDir, "findings.json"), `${JSON.stringify(findings, null, 2)}\n`, "utf8");
  return { run, evidence };
}
