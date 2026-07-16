import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { z } from "zod";

import { EvidenceSchema, type Evidence } from "../evidence/index.js";
import {
  hashContract,
  ReasoningEffortSchema,
  type ReasoningEffort,
  type MissionContract,
} from "../mission/index.js";
import {
  generateHookConfig,
  resolveIdentity as resolveCurrentIdentity,
  runCommand,
  runStreamingCommand,
  verifyEnforcement,
  type HookConfigOptions,
  type IdentityReport,
  type StreamingCommandRunner,
} from "../guard/index.js";
import { parseCodexJsonl } from "./codex-jsonl.js";
import {
  appendLedger,
  currentCommit,
  identityReportsMatch,
  isGitRepository,
  resolveCodexLaunch,
  type CodexLaunch,
} from "./mission-run.js";
import { missionDirectory } from "./mission-files.js";
import { appendMissionSession } from "./session-store.js";

export const VerifierFindingSchema = z.strictObject({
  criterionId: z.string().min(1),
  verdict: z.enum(["looks_correct", "concern", "cannot_assess"]),
  concern: z.string().min(1).optional(),
  riskySpots: z.array(z.string().min(1)).optional(),
});

export const VerifierFindingsSchema = z.array(VerifierFindingSchema);
const VerifierWireFindingsSchema = z.array(
  z.strictObject({
    criterionId: z.string().min(1),
    verdict: z.enum(["looks_correct", "concern", "cannot_assess"]),
    concern: z.string().min(1).nullable().optional(),
    riskySpots: z.array(z.string().min(1)).nullable().optional(),
  }),
);
const VerifierWireOutputSchema = z.union([
  VerifierWireFindingsSchema,
  z.strictObject({ findings: VerifierWireFindingsSchema }),
]);
export const VERIFIER_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterionId: { type: "string", minLength: 1 },
          verdict: {
            type: "string",
            enum: ["looks_correct", "concern", "cannot_assess"],
          },
          concern: {
            anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
          },
          riskySpots: {
            anyOf: [
              { type: "array", items: { type: "string", minLength: 1 } },
              { type: "null" },
            ],
          },
        },
        required: ["criterionId", "verdict", "concern", "riskySpots"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings"],
  additionalProperties: false,
} as const;

export type VerifierFinding = z.infer<typeof VerifierFindingSchema>;

export type ParsedVerifierFindings =
  | { readonly status: "VALID"; readonly findings: readonly VerifierFinding[] }
  | {
      readonly status: "INVALID";
      readonly findings: readonly [];
      readonly reason: string;
    };

export function parseVerifierFindings(stream: string): ParsedVerifierFindings {
  const parsed = parseCodexJsonl(stream);
  const text = [...parsed.items]
    .reverse()
    .find(
      (item) =>
        item.type === "agent_message" && typeof item.text === "string",
    )?.text;
  if (typeof text !== "string") {
    return {
      status: "INVALID",
      findings: [],
      reason: "verifier output has no structured agent message",
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      status: "INVALID",
      findings: [],
      reason: "verifier output is not valid JSON",
    };
  }
  const wireOutput = VerifierWireOutputSchema.safeParse(value);
  if (!wireOutput.success) {
    return {
      status: "INVALID",
      findings: [],
      reason: "verifier output does not match the findings schema",
    };
  }
  const wireFindings = Array.isArray(wireOutput.data)
    ? wireOutput.data
    : wireOutput.data.findings;
  const findings = VerifierFindingsSchema.safeParse(
    wireFindings.map((finding) => ({
      criterionId: finding.criterionId,
      verdict: finding.verdict,
      ...(finding.concern == null ? {} : { concern: finding.concern }),
      ...(finding.riskySpots == null ? {} : { riskySpots: finding.riskySpots }),
    })),
  );
  if (!findings.success) {
    return {
      status: "INVALID",
      findings: [],
      reason: "verifier output does not match the findings schema",
    };
  }
  return { status: "VALID", findings: findings.data };
}

export interface BuildVerifierPlanInput {
  readonly contract: MissionContract;
  readonly missionDir: string;
  readonly projectPath: string;
  readonly diff: string;
  readonly outputSchemaPath: string;
  readonly model?: string;
  readonly effort?: ReasoningEffort;
  readonly isGitRepository: boolean;
  readonly hookConfigOptions?: HookConfigOptions;
}

export interface VerifierPlan {
  readonly missionDir: string;
  readonly projectPath: string;
  readonly model: string;
  readonly effort: ReasoningEffort;
  readonly sandbox: "read-only";
  readonly networkAccess: false;
  readonly configHash: string;
  readonly outputSchemaPath: string;
  readonly args: readonly string[];
  readonly stdin: string;
  readonly nativeDelegation: {
    readonly status: "UNSUPPORTED";
    readonly agentName: "axiomgate-verifier";
    readonly reason: string;
  };
}

function verifierPrompt(contract: MissionContract, diff: string): string {
  return [
    "Act as an independent verifier. Do not assume the builder's conclusions.",
    "Challenge the implementation against every acceptance criterion and look for security issues in the diff.",
    "Return only the structured findings required by the output schema.",
    `Acceptance criteria:\n${JSON.stringify(contract.acceptanceCriteria, null, 2)}`,
    `Current git diff:\n${diff.length === 0 ? "(empty diff)" : diff}`,
  ].join("\n\n");
}

export function buildVerifierPlan(
  input: BuildVerifierPlanInput,
): VerifierPlan {
  const verifyPhase = input.contract.modelPlan.find(
    (entry) => entry.phase === "verify",
  );
  if (verifyPhase === undefined) {
    throw new Error("mission model plan has no verify phase; run mission update");
  }
  const missionDir = resolve(input.missionDir);
  const projectPath = resolve(input.projectPath);
  const outputSchemaPath = resolve(input.outputSchemaPath);
  const model = input.model ?? verifyPhase.model;
  const effort = ReasoningEffortSchema.parse(input.effort ?? verifyPhase.effort);
  const hook = generateHookConfig(missionDir, input.hookConfigOptions);
  const args = [
    "exec",
    "--json",
    "--model",
    model,
    "-c",
    `model_reasoning_effort=${JSON.stringify(effort)}`,
    "--sandbox",
    "read-only",
    "--dangerously-bypass-hook-trust",
    "--cd",
    projectPath,
    ...(input.isGitRepository ? [] : ["--skip-git-repo-check"]),
    ...hook.codexArgs,
    "--output-schema",
    outputSchemaPath,
    "-",
  ];

  return {
    missionDir,
    projectPath,
    model,
    effort,
    sandbox: "read-only",
    networkAccess: false,
    configHash: hook.configHash,
    outputSchemaPath,
    args,
    stdin: verifierPrompt(input.contract, input.diff),
    nativeDelegation: {
      status: "UNSUPPORTED",
      agentName: "axiomgate-verifier",
      reason:
        "codex exec has no deterministic named-agent selector; using a fresh read-only verifier session",
    },
  };
}

export const VerifierFindingsRecordSchema = z.strictObject({
  reviewId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1).nullable(),
  status: z.enum(["VALID", "INVALID"]),
  advisory: z.literal(true),
  model: z.string().min(1),
  effort: ReasoningEffortSchema,
  capturedAt: z.iso.datetime({ offset: true }),
  findings: VerifierFindingsSchema,
  reason: z.string().min(1).optional(),
  outputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
});

export type VerifierFindingsRecord = z.infer<
  typeof VerifierFindingsRecordSchema
>;

export interface ReviewMissionOptions {
  readonly diff?: string;
  readonly model?: string;
  readonly effort?: ReasoningEffort;
  readonly timeoutMs?: number;
  readonly reviewId?: string;
  readonly hookConfigOptions?: HookConfigOptions;
  readonly resolveIdentity?: (projectPath: string) => IdentityReport;
  readonly isGitRepository?: boolean;
  readonly codexLaunch?: CodexLaunch;
  readonly runner?: StreamingCommandRunner;
  readonly now?: () => Date;
  readonly currentCommit?: (projectPath: string) => string;
  readonly onReady?: (plan: VerifierPlan) => void;
}

export interface ReviewMissionResult {
  readonly findings: ParsedVerifierFindings;
  readonly record: VerifierFindingsRecord;
  readonly evidence: Evidence;
  readonly plan: VerifierPlan;
  readonly commandStatus: "SUCCESS" | "FAILED" | "UNAVAILABLE" | "TIMED_OUT";
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function readCurrentDiff(projectPath: string): string {
  const result = runCommand(
    "git",
    ["diff", "--no-ext-diff", "--binary", "HEAD", "--"],
    { cwd: projectPath },
  );
  if (result.status !== "SUCCESS") {
    throw new Error(`unable to compute current git diff: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

export async function reviewMission(
  projectPath: string,
  id: string,
  options: ReviewMissionOptions = {},
): Promise<ReviewMissionResult> {
  const resolvedProject = resolve(projectPath);
  const missionDir = missionDirectory(resolvedProject, id);
  const enforcement = verifyEnforcement(missionDir, options.hookConfigOptions);
  if (enforcement.status === "REFUSED") {
    throw new Error(
      `Enforcement verification failed: ${enforcement.reason}. Next step: axiomgate mission update ${id}`,
    );
  }
  const freshIdentity =
    options.resolveIdentity?.(resolvedProject) ??
    resolveCurrentIdentity({ cwd: resolvedProject });
  if (!identityReportsMatch(enforcement.snapshot.identity, freshIdentity)) {
    throw new Error(
      `Identity differs from the mission snapshot. Next step: axiomgate mission update ${id}`,
    );
  }

  const outputSchemaPath = join(missionDir, "verifier-output-schema.json");
  writeFileSync(
    outputSchemaPath,
    `${JSON.stringify(VERIFIER_OUTPUT_JSON_SCHEMA, null, 2)}\n`,
    "utf8",
  );
  const plan = buildVerifierPlan({
    contract: enforcement.snapshot.contract,
    missionDir,
    projectPath: resolvedProject,
    diff: options.diff ?? readCurrentDiff(resolvedProject),
    outputSchemaPath,
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.effort === undefined ? {} : { effort: options.effort }),
    isGitRepository:
      options.isGitRepository ?? isGitRepository(resolvedProject),
    ...(options.hookConfigOptions === undefined
      ? {}
      : { hookConfigOptions: options.hookConfigOptions }),
  });
  options.onReady?.(plan);
  const launch = options.codexLaunch ?? resolveCodexLaunch();
  const runner = options.runner ?? runStreamingCommand;
  const commandResult = await runner(
    launch.command,
    [...launch.argsPrefix, ...plan.args],
    {
      cwd: resolvedProject,
      input: plan.stdin,
      timeoutMs: options.timeoutMs ?? 20 * 60 * 1_000,
    },
  );
  const parsed = parseCodexJsonl(commandResult.stdout);
  const findings = parseVerifierFindings(commandResult.stdout);
  const reviewId =
    options.reviewId ??
    `review_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const capturedAt = (options.now ?? (() => new Date()))().toISOString();
  const outputHash = sha256(commandResult.stdout);
  const record = VerifierFindingsRecordSchema.parse({
    reviewId,
    missionId: id,
    sessionId: parsed.sessionId ?? null,
    status: findings.status,
    advisory: true,
    model: plan.model,
    effort: plan.effort,
    capturedAt,
    findings: findings.findings,
    ...(findings.status === "INVALID" ? { reason: findings.reason } : {}),
    outputHash,
  });
  const runsDir = join(missionDir, "runs");
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(
    join(runsDir, `${reviewId}.jsonl`),
    commandResult.stdout,
    "utf8",
  );
  writeFileSync(
    join(missionDir, "findings.json"),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  appendMissionSession(missionDir, parsed.sessionId, "verifier");
  appendLedger(
    missionDir,
    reviewId,
    parsed.sessionId,
    plan,
    parsed.usages,
    capturedAt,
    "verifier",
  );

  const commit =
    options.currentCommit?.(resolvedProject) ?? currentCommit(resolvedProject);
  const evidence = EvidenceSchema.parse({
    id: `ev_${reviewId}`,
    missionId: id,
    criterionId:
      enforcement.snapshot.contract.acceptanceCriteria[0]?.id ??
      "runtime.verifier",
    source: "command",
    command: "codex exec --json --output-schema",
    exitCode: commandResult.exitCode,
    outputHash,
    outputRef: `findings.json#${hashContract(record)}`,
    capturedAt,
    freshForCommit: commit,
    label: "LIVE",
    redacted: true,
  });
  appendFileSync(
    join(missionDir, "events.jsonl"),
    `${JSON.stringify(evidence)}\n`,
    "utf8",
  );

  return {
    findings,
    record,
    evidence,
    plan,
    commandStatus: commandResult.status,
  };
}
