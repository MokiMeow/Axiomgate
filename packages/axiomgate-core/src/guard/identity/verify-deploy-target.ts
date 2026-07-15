import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { EvidenceSchema, type Evidence } from "../../evidence/index.js";
import { runCommand, type CommandResult, type CommandRunner } from "./command.js";
import {
  parseVercelProjectInspect,
  parseVercelProjectJson,
} from "./parsers.js";

export type DeployTargetVerdict =
  | "VERIFIED_OWNED"
  | "EXISTS_NOT_OWNED"
  | "NOT_FOUND"
  | "UNAVAILABLE";

export type DeployTarget =
  | {
      readonly type: "github_repo";
      readonly owner: string;
      readonly repo: string;
      readonly expectedOwner: string;
    }
  | {
      readonly type: "vercel_project";
      readonly project: string;
      readonly expectedAccount: string;
      readonly cwd?: string;
    };

export interface TargetEvidenceContext {
  readonly missionId: string;
  readonly criterionId: string;
  readonly freshForCommit: string;
  readonly label: Evidence["label"];
}

export interface DeployTargetVerification {
  readonly verdict: DeployTargetVerdict;
  readonly reason: string;
  readonly evidence?: Evidence;
  readonly rawOutput: string;
}

export interface VerifyDeployTargetOptions {
  readonly runner?: CommandRunner;
  readonly now?: () => Date;
  readonly createEvidenceId?: () => string;
  readonly writeEvidence?: (path: string, output: string) => void;
  readonly readTextFile?: (path: string) => string;
}

function commandText(result: CommandResult): string {
  return [result.command, ...result.args]
    .map((part) => JSON.stringify(part))
    .join(" ");
}

function rawOutput(result: CommandResult): string {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

function captureEvidence(
  result: CommandResult,
  source: Evidence["source"],
  context: TargetEvidenceContext,
  cwd: string,
  options: VerifyDeployTargetOptions,
): Evidence {
  const id = options.createEvidenceId?.() ?? `ev_${randomUUID()}`;
  if (!/^ev_[A-Za-z0-9_-]+$/u.test(id)) {
    throw new Error("Evidence ID contains unsafe path characters");
  }

  const output = rawOutput(result);
  const outputRef = `.local/evidence/${id}.log`;
  const outputPath = join(cwd, outputRef);
  const writer =
    options.writeEvidence ??
    ((path: string, content: string) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf8");
    });
  writer(outputPath, output);

  return EvidenceSchema.parse({
    id,
    missionId: context.missionId,
    criterionId: context.criterionId,
    source,
    command: commandText(result),
    exitCode: result.exitCode,
    outputHash: `sha256:${createHash("sha256").update(output).digest("hex")}`,
    outputRef,
    capturedAt: (options.now ?? (() => new Date()))().toISOString(),
    freshForCommit: context.freshForCommit,
    label: context.label,
    redacted: false,
  });
}

function isNotFound(result: CommandResult): boolean {
  return /(?:HTTP\s+)?404|not\s+found/iu.test(rawOutput(result));
}

function githubOwner(output: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(output);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }

    const owner = (parsed as Record<string, unknown>).owner;
    if (typeof owner !== "object" || owner === null || Array.isArray(owner)) {
      return undefined;
    }

    const login = (owner as Record<string, unknown>).login;
    return typeof login === "string" ? login : undefined;
  } catch {
    return undefined;
  }
}

function withEvidence(
  verdict: DeployTargetVerdict,
  reason: string,
  result: CommandResult,
  source: Evidence["source"],
  context: TargetEvidenceContext,
  cwd: string,
  options: VerifyDeployTargetOptions,
): DeployTargetVerification {
  try {
    return {
      verdict,
      reason,
      evidence: captureEvidence(result, source, context, cwd, options),
      rawOutput: rawOutput(result),
    };
  } catch (error) {
    return {
      verdict: "UNAVAILABLE",
      reason: `Evidence capture failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      rawOutput: rawOutput(result),
    };
  }
}

function verifyGithubTarget(
  target: Extract<DeployTarget, { type: "github_repo" }>,
  context: TargetEvidenceContext,
  options: VerifyDeployTargetOptions,
): DeployTargetVerification {
  const cwd = process.cwd();
  const runner = options.runner ?? runCommand;
  const result = runner("gh", ["api", `repos/${target.owner}/${target.repo}`], {
    cwd,
  });

  if (result.status === "UNAVAILABLE" || result.status === "TIMED_OUT") {
    return withEvidence(
      "UNAVAILABLE",
      `GitHub target verification ${result.status.toLowerCase()}`,
      result,
      "api",
      context,
      cwd,
      options,
    );
  }
  if (result.status === "FAILED") {
    return withEvidence(
      isNotFound(result) ? "NOT_FOUND" : "UNAVAILABLE",
      isNotFound(result)
        ? `GitHub repository ${target.owner}/${target.repo} was not found`
        : `GitHub API failed with exit code ${result.exitCode}`,
      result,
      "api",
      context,
      cwd,
      options,
    );
  }

  const observedOwner = githubOwner(result.stdout);
  if (observedOwner === undefined) {
    return withEvidence(
      "UNAVAILABLE",
      "GitHub API response omitted repository owner",
      result,
      "api",
      context,
      cwd,
      options,
    );
  }

  const owned =
    observedOwner.toLowerCase() === target.expectedOwner.toLowerCase() &&
    target.owner.toLowerCase() === target.expectedOwner.toLowerCase();
  return withEvidence(
    owned ? "VERIFIED_OWNED" : "EXISTS_NOT_OWNED",
    owned
      ? `GitHub repository exists and is owned by ${target.expectedOwner}`
      : `GitHub repository owner ${observedOwner} does not match expected owner ${target.expectedOwner}`,
    result,
    "api",
    context,
    cwd,
    options,
  );
}

function verifyVercelTarget(
  target: Extract<DeployTarget, { type: "vercel_project" }>,
  context: TargetEvidenceContext,
  options: VerifyDeployTargetOptions,
): DeployTargetVerification {
  const cwd = target.cwd ?? process.cwd();
  const readTextFile = options.readTextFile ?? ((path) => readFileSync(path, "utf8"));
  let localProject;
  try {
    localProject = parseVercelProjectJson(
      readTextFile(join(cwd, ".vercel", "project.json")),
    );
  } catch (error) {
    return {
      verdict: "UNAVAILABLE",
      reason: `Vercel project link unavailable: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      rawOutput: "",
    };
  }
  if (!localProject.ok) {
    return {
      verdict: "UNAVAILABLE",
      reason: localProject.reason,
      rawOutput: "",
    };
  }

  const runner = options.runner ?? runCommand;
  const result = runner(
    "vercel",
    [
      "project",
      "inspect",
      target.project,
      "--scope",
      target.expectedAccount,
      "--no-color",
      "--non-interactive",
    ],
    { cwd },
  );

  if (result.status === "UNAVAILABLE" || result.status === "TIMED_OUT") {
    return withEvidence(
      "UNAVAILABLE",
      `Vercel target verification ${result.status.toLowerCase()}`,
      result,
      "command",
      context,
      cwd,
      options,
    );
  }
  if (result.status === "FAILED") {
    return withEvidence(
      isNotFound(result) ? "NOT_FOUND" : "UNAVAILABLE",
      isNotFound(result)
        ? `Vercel project ${target.project} was not found`
        : `Vercel inspect failed with exit code ${result.exitCode}`,
      result,
      "command",
      context,
      cwd,
      options,
    );
  }

  const inspected = parseVercelProjectInspect(result.stdout);
  if (!inspected.ok) {
    return withEvidence(
      "UNAVAILABLE",
      inspected.reason,
      result,
      "command",
      context,
      cwd,
      options,
    );
  }

  const localMatches =
    localProject.value.projectId === inspected.value.id &&
    (localProject.value.projectName === undefined ||
      localProject.value.projectName === inspected.value.name);
  const targetMatches =
    target.project === inspected.value.id ||
    target.project === inspected.value.name;
  const ownerMatches =
    localProject.value.orgId.toLowerCase() ===
    target.expectedAccount.toLowerCase();
  const owned = localMatches && targetMatches && ownerMatches;

  return withEvidence(
    owned ? "VERIFIED_OWNED" : "EXISTS_NOT_OWNED",
    owned
      ? `Vercel project exists in expected account ${target.expectedAccount}`
      : "Vercel project link, inspected target, or expected account did not match",
    result,
    "command",
    context,
    cwd,
    options,
  );
}

export function verifyDeployTarget(
  target: DeployTarget,
  context: TargetEvidenceContext,
  options: VerifyDeployTargetOptions = {},
): DeployTargetVerification {
  try {
    return target.type === "github_repo"
      ? verifyGithubTarget(target, context, options)
      : verifyVercelTarget(target, context, options);
  } catch (error) {
    return {
      verdict: "UNAVAILABLE",
      reason: error instanceof Error ? error.message : "Target verification failed",
      rawOutput: "",
    };
  }
}
