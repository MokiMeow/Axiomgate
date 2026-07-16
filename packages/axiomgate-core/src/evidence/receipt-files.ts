import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import {
  loadMissionSnapshot,
  runCommand,
  type CommandRunner,
} from "../guard/index.js";
import {
  ReasoningEffortSchema,
  stableStringify,
} from "../mission/index.js";
import { missionDirectory } from "../runtime/mission-files.js";
import {
  VerificationFindingSchema,
  type VerificationFinding,
} from "../verification/types.js";
import type { BuildReceipt } from "./build-receipt.js";
import {
  createBuildReceipt,
  renderReceiptMarkdown,
  verifyReceiptDocument,
  type ReceiptVerificationResult,
} from "./receipt.js";
import {
  loadMissionStatus,
  readApprovalRecords,
} from "./status.js";

function readJsonLines(path: string): Record<string, unknown>[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function nonnegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function modelUsage(
  missionDir: string,
  contract: BuildReceipt["contract"],
): BuildReceipt["modelUsage"] {
  return readJsonLines(join(missionDir, "ledger.jsonl")).map((entry) => {
    const usage = typeof entry.usage === "object" && entry.usage !== null
      ? entry.usage as Record<string, unknown>
      : {};
    const model = typeof entry.model === "string" ? entry.model : "UNKNOWN";
    const parsedEffort = ReasoningEffortSchema.safeParse(entry.effort);
    const effort = parsedEffort.success ? parsedEffort.data : "medium";
    const role = entry.role === "verifier" ? "verify" : undefined;
    const planned = contract.modelPlan.find(
      (phase) => phase.model === model && phase.effort === effort,
    );
    return {
      phase: role ?? planned?.phase ?? "observed",
      model,
      effort,
      tokens: {
        input: nonnegative(usage.input_tokens),
        output: nonnegative(usage.output_tokens),
        reasoning: nonnegative(usage.reasoning_output_tokens),
      },
    };
  });
}

function verificationFindings(missionDir: string): VerificationFinding[] {
  const path = join(missionDir, "findings.json");
  if (!existsSync(path)) return [];
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = VerificationFindingSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function observedTotal(usage: BuildReceipt["modelUsage"]): number {
  return usage.reduce(
    (total, entry) => total + entry.tokens.input + entry.tokens.output,
    0,
  );
}

function commandValue(
  runner: CommandRunner,
  command: string,
  args: readonly string[],
  cwd: string,
): string {
  const result = runner(command, args, { cwd, timeoutMs: 15_000 });
  return result.status === "SUCCESS" && result.stdout.trim().length > 0
    ? result.stdout.trim()
    : "UNKNOWN";
}

export interface GenerateReceiptOptions {
  readonly currentRevision: string;
  readonly now?: () => Date;
  readonly runner?: CommandRunner;
}

export function generateReceipt(
  projectPath: string,
  missionId: string,
  options: GenerateReceiptOptions,
): BuildReceipt {
  const workspace = resolve(projectPath);
  const missionDir = missionDirectory(workspace, missionId);
  const loaded = loadMissionSnapshot(missionDir);
  if (loaded.status === "INVALID") {
    throw new Error(`Cannot generate receipt: ${loaded.reason}`);
  }
  const status = loadMissionStatus(workspace, missionId, {
    currentRevision: options.currentRevision,
  });
  const runner = options.runner ?? runCommand;
  const usage = modelUsage(missionDir, loaded.snapshot.contract);
  const approvalRecords = readApprovalRecords(missionDir);
  const actions = status.gate.permissionQuads.map((quad) => {
    const approvalRecord = approvalRecords.find(
      (record) => record.request.rawCommandHash === quad.commandHash,
    );
    return {
      request: approvalRecord?.request ?? null,
      approval: approvalRecord?.approval ?? null,
      permissionQuad: quad,
    };
  });
  const limitations = [
    "Receipt integrity is hash-chained but unsigned; offline verification proves internal consistency, not publisher authenticity.",
    ...(status.gate.permissionQuads.some((quad) => quad.actionRequestId === undefined)
      ? ["Non-approval hook events do not persist a full ActionRequest; their receipt action retains the hook-derived permission quad with a null request."]
      : []),
    ...(status.evidence.some((record) => record.command.startsWith("builtin-secret-scan"))
      ? ["Secret verification used the labelled built-in diff heuristic because gitleaks was unavailable."]
      : []),
    ...status.gate.permissionMismatches.map(
      (mismatch) => `Permission observation mismatch: ${mismatch}`,
    ),
  ];
  return createBuildReceipt({
    contract: loaded.snapshot.contract,
    repo: {
      remote: commandValue(runner, "git", ["remote", "get-url", "origin"], workspace),
      branch: commandValue(runner, "git", ["branch", "--show-current"], workspace),
      commit: options.currentRevision,
    },
    identities: {
      github: loaded.snapshot.identity.githubLogin.status === "RESOLVED"
        ? loaded.snapshot.identity.githubLogin.value
        : "UNKNOWN",
      vercel: loaded.snapshot.identity.vercelUser.status === "RESOLVED"
        ? loaded.snapshot.identity.vercelUser.value
        : "UNKNOWN",
    },
    modelUsage: usage,
    capacityLedger: {
      estimated: {
        reservePercent: loaded.snapshot.contract.budgetPolicy?.reservePercent ?? "UNKNOWN",
      },
      actual: { totalTokens: observedTotal(usage) },
      sourceLabels: { estimated: "contract", actual: "observed" },
    },
    actions,
    gate: status.gate,
    findings: verificationFindings(missionDir),
    evidence: status.evidence,
    limitations,
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
  });
}

export type ReceiptFormat = "json" | "md";

export function writeMissionReceipt(
  projectPath: string,
  missionId: string,
  format: ReceiptFormat,
  options: GenerateReceiptOptions,
): { readonly path: string; readonly receipt: BuildReceipt } {
  const receipt = generateReceipt(projectPath, missionId, options);
  const directory = join(resolve(projectPath), "evidence");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${missionId}-receipt.${format}`);
  writeFileSync(
    path,
    format === "json"
      ? `${stableStringify(receipt)}\n`
      : renderReceiptMarkdown(receipt),
    "utf8",
  );
  return { path, receipt };
}

export function verifyReceiptFile(path: string): ReceiptVerificationResult {
  return verifyReceiptDocument(readFileSync(resolve(path), "utf8"));
}
