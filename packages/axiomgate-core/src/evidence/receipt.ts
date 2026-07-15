import { createHash } from "node:crypto";

import {
  hashContract,
  stableStringify,
  type MissionContract,
} from "../mission/index.js";
import type { VerificationFinding } from "../verification/types.js";
import {
  BuildReceiptSchema,
  ChainedEvidenceSchema,
  type BuildReceipt,
  type ChainedEvidence,
} from "./build-receipt.js";
import { EvidenceSchema, type Evidence } from "./evidence.js";
import {
  completionGate,
  type CompletionGateResult,
} from "./verdict.js";

export const EMPTY_EVIDENCE_CHAIN_HASH =
  `sha256:${"0".repeat(64)}` as const;

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function buildEvidenceChain(
  evidenceInputs: readonly Evidence[],
): ChainedEvidence[] {
  let previousHash: string = EMPTY_EVIDENCE_CHAIN_HASH;
  return evidenceInputs.map((input) => {
    const record = EvidenceSchema.parse(input);
    const hash = sha256(stableStringify({ previousHash, record }));
    const chained = ChainedEvidenceSchema.parse({ record, previousHash, hash });
    previousHash = hash;
    return chained;
  });
}

export interface CreateBuildReceiptInput {
  readonly contract: MissionContract;
  readonly repo: BuildReceipt["repo"];
  readonly identities: BuildReceipt["identities"];
  readonly modelUsage: BuildReceipt["modelUsage"];
  readonly capacityLedger: BuildReceipt["capacityLedger"];
  readonly actions: BuildReceipt["actions"];
  readonly gate: CompletionGateResult;
  readonly findings: readonly VerificationFinding[];
  readonly evidence: readonly Evidence[];
  readonly limitations: readonly string[];
  readonly generatedAt: string;
}

function aggregatePermission(
  quads: CompletionGateResult["permissionQuads"],
  field: "requested" | "approved" | "applied" | "observed",
): string {
  return `${quads.filter((quad) => quad[field]).length}/${quads.length}`;
}

export function createBuildReceipt(
  input: CreateBuildReceiptInput,
): BuildReceipt {
  const evidenceRecords = buildEvidenceChain(input.evidence);
  const chainById = new Map(
    evidenceRecords.map((entry) => [entry.record.id, entry] as const),
  );
  return BuildReceiptSchema.parse({
    schemaVersion: 1,
    missionId: input.contract.id,
    contract: input.contract,
    contractHash: input.contract.hash,
    repo: input.repo,
    identities: input.identities,
    modelUsage: input.modelUsage,
    capacityLedger: input.capacityLedger,
    actions: input.actions,
    permissionQuad: {
      requested: aggregatePermission(input.gate.permissionQuads, "requested"),
      approved: aggregatePermission(input.gate.permissionQuads, "approved"),
      applied: aggregatePermission(input.gate.permissionQuads, "applied"),
      observed: aggregatePermission(input.gate.permissionQuads, "observed"),
    },
    criteria: input.gate.criteria.map((criterion) => ({
      id: criterion.criterionId,
      verdict: criterion.verdict,
      evidenceIds: criterion.evidenceIds,
      evidenceHashes: criterion.evidenceIds.map((id) => {
        const chained = chainById.get(id);
        if (chained === undefined) {
          throw new Error(`Criterion ${criterion.criterionId} cites missing evidence ${id}`);
        }
        return chained.hash;
      }),
    })),
    findings: input.findings,
    waivers: input.gate.waivers,
    outcome: input.gate.outcome,
    evidenceRecords,
    evidenceChainHead:
      evidenceRecords.at(-1)?.hash ?? EMPTY_EVIDENCE_CHAIN_HASH,
    limitations: input.limitations,
    generatedAt: input.generatedAt,
  });
}

export interface ReceiptVerificationResult {
  readonly valid: boolean;
  readonly checks: readonly string[];
  readonly errors: readonly string[];
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

export function verifyBuildReceipt(input: unknown): ReceiptVerificationResult {
  const parsed = BuildReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      checks: [],
      errors: [`Receipt schema validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`],
    };
  }
  const receipt = parsed.data;
  const errors: string[] = [];
  const checks: string[] = [];

  if (
    receipt.missionId !== receipt.contract.id ||
    receipt.contractHash !== hashContract(receipt.contract) ||
    receipt.contract.hash !== receipt.contractHash
  ) {
    errors.push("Contract hash does not match the embedded contract");
  } else {
    checks.push("contract hash");
  }

  let previousHash: string = EMPTY_EVIDENCE_CHAIN_HASH;
  for (const [index, entry] of receipt.evidenceRecords.entries()) {
    const expected = sha256(stableStringify({ previousHash, record: entry.record }));
    if (entry.previousHash !== previousHash || entry.hash !== expected) {
      errors.push(`Evidence chain hash mismatch at record ${index + 1} (${entry.record.id})`);
    }
    previousHash = entry.hash;
  }
  const expectedHead = receipt.evidenceRecords.at(-1)?.hash ?? EMPTY_EVIDENCE_CHAIN_HASH;
  if (receipt.evidenceChainHead !== expectedHead) {
    errors.push("Evidence chain head does not match the final record");
  }
  if (!errors.some((error) => error.includes("Evidence chain"))) {
    checks.push(`${receipt.evidenceRecords.length} chained evidence records`);
  }

  const chainById = new Map(
    receipt.evidenceRecords.map((entry) => [entry.record.id, entry] as const),
  );
  for (const criterion of receipt.criteria) {
    for (const [index, evidenceId] of criterion.evidenceIds.entries()) {
      const chained = chainById.get(evidenceId);
      if (chained === undefined) {
        errors.push(`${criterion.id} cites missing evidence ${evidenceId}`);
      } else if (criterion.evidenceHashes[index] !== chained.hash) {
        errors.push(
          `${criterion.id} cites an evidence hash that does not match ${evidenceId}`,
        );
      }
    }
    if (criterion.evidenceHashes.length !== criterion.evidenceIds.length) {
      errors.push(`${criterion.id} has incomplete evidence hash citations`);
    }
  }
  if (!errors.some((error) => error.includes("cites") || error.includes("citation"))) {
    checks.push("criterion evidence citations");
  }

  const recomputed = completionGate(
    receipt.contract,
    receipt.evidenceRecords.map((entry) => entry.record),
    receipt.repo.commit,
    {
      waivers: receipt.waivers,
      permissionQuads: receipt.actions.map((action) => action.permissionQuad),
    },
  );
  for (const criterion of receipt.criteria) {
    const actual = recomputed.criteria.find(
      (candidate) => candidate.criterionId === criterion.id,
    );
    if (
      actual === undefined ||
      criterion.verdict !== actual.verdict ||
      !sameMembers(criterion.evidenceIds, actual.evidenceIds)
    ) {
      errors.push(
        `${criterion.id} claims ${criterion.verdict} without fresh successful admissible evidence`,
      );
    }
  }
  if (receipt.criteria.length !== recomputed.criteria.length) {
    errors.push("Receipt criteria do not match the embedded contract");
  }
  if (receipt.outcome !== recomputed.outcome) {
    errors.push(
      `Receipt outcome ${receipt.outcome} does not match recomputed ${recomputed.outcome}`,
    );
  }
  if (!errors.some((error) => error.includes("claims") || error.includes("outcome"))) {
    checks.push("criterion verdicts and completion gate");
  }

  return { valid: errors.length === 0, checks, errors };
}

const RECEIPT_START = "<!-- AXIOMGATE_RECEIPT_JSON_START -->";
const RECEIPT_END = "<!-- AXIOMGATE_RECEIPT_JSON_END -->";

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderReceiptMarkdown(input: BuildReceipt): string {
  const receipt = BuildReceiptSchema.parse(input);
  const lines = [
    "# AxiomGate Build Receipt",
    "",
    `- Mission: \`${receipt.missionId}\``,
    `- Outcome: **${receipt.outcome}**`,
    `- Contract: \`${receipt.contractHash}\``,
    `- Repository: \`${receipt.repo.remote}\` / \`${receipt.repo.branch}\` / \`${receipt.repo.commit}\``,
    `- Evidence chain head: \`${receipt.evidenceChainHead}\``,
    `- Generated: ${receipt.generatedAt}`,
    "",
    "## Criteria",
    "",
    "| Criterion | Verdict | Evidence |",
    "|---|---|---|",
    ...receipt.criteria.map(
      (criterion) =>
        `| ${markdownCell(criterion.id)} | ${criterion.verdict} | ${criterion.evidenceIds.map(markdownCell).join(", ") || "-"} |`,
    ),
    "",
    "## Evidence",
    "",
    "| ID | Source | Exit | Output hash | Chain hash |",
    "|---|---|---:|---|---|",
    ...receipt.evidenceRecords.map(
      (entry) =>
        `| ${markdownCell(entry.record.id)} | ${entry.record.source} | ${entry.record.exitCode} | \`${entry.record.outputHash}\` | \`${entry.hash}\` |`,
    ),
    "",
    "## Limitations",
    "",
    ...(receipt.limitations.length === 0
      ? ["- None recorded."]
      : receipt.limitations.map((limitation) => `- ${limitation}`)),
    "",
    "## Canonical receipt payload",
    "",
    "The offline verifier reads this canonical payload; the human-readable tables above are a projection of the same record.",
    "",
    RECEIPT_START,
    "```json",
    JSON.stringify(receipt, null, 2),
    "```",
    RECEIPT_END,
    "",
  ];
  return lines.join("\n");
}

export function parseReceiptDocument(document: string): BuildReceipt {
  const trimmed = document.trim();
  if (trimmed.startsWith("{")) {
    return BuildReceiptSchema.parse(JSON.parse(trimmed));
  }
  const start = document.indexOf(RECEIPT_START);
  const end = document.indexOf(RECEIPT_END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Markdown receipt has no canonical payload");
  }
  const section = document.slice(start + RECEIPT_START.length, end);
  const match = /```json\s*([\s\S]*?)\s*```/u.exec(section);
  if (match?.[1] === undefined) {
    throw new Error("Markdown receipt canonical payload is malformed");
  }
  return BuildReceiptSchema.parse(JSON.parse(match[1]));
}

export function verifyReceiptDocument(
  document: string,
): ReceiptVerificationResult {
  try {
    return verifyBuildReceipt(parseReceiptDocument(document));
  } catch (error) {
    return {
      valid: false,
      checks: [],
      errors: [
        `Receipt document parsing failed: ${error instanceof Error ? error.message : "unknown error"}`,
      ],
    };
  }
}
