import {
  appendFileSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEvidenceChain,
  completionGate,
  createBuildReceipt,
  createMission,
  generateReceipt,
  hashContract,
  parseReceiptDocument,
  renderReceiptMarkdown,
  verifyBuildReceipt,
  verifyReceiptDocument,
  type BuildReceipt,
  type Evidence,
  type IdentityReport,
  type MissionContract,
} from "../src/index.js";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const REVISION = "WORKTREE:abc123";

function contract(): MissionContract {
  const value: MissionContract = {
    id: "msn_receipt",
    version: 1,
    hash: HASH_A,
    objective: "Produce offline proof",
    projectProfileId: "fixture",
    intentBoundary: "MODIFY_LOCAL",
    acceptanceCriteria: [
      {
        id: "criterion_test",
        statement: "Tests pass",
        risk: "high",
        evidenceTypes: ["test"],
        verdict: "UNVERIFIED",
        evidenceIds: [],
      },
    ],
    constraints: [],
    nonGoals: [],
    actionPolicy: [{ action: "verification.run", decision: "ALLOW" }],
    modelPlan: [
      {
        phase: "build",
        model: "gpt-5.6-sol",
        effort: "high",
        rationale: "primary implementation",
      },
    ],
    status: "ACTIVE",
    createdAt: "2026-07-15T18:00:00.000Z",
    updatedAt: "2026-07-15T18:00:00.000Z",
  };
  return { ...value, hash: hashContract(value) };
}

function evidence(id = "ev_test"): Evidence {
  return {
    id,
    missionId: "msn_receipt",
    criterionId: "criterion_test",
    source: "command",
    command: "npm test",
    exitCode: 0,
    outputHash: HASH_B,
    outputRef: ".axiomgate/test.log",
    capturedAt: "2026-07-15T18:01:00.000Z",
    freshForCommit: REVISION,
    label: "LIVE",
    redacted: true,
  };
}

function receipt(records: Evidence[] = [evidence()]): BuildReceipt {
  const mission = contract();
  return createBuildReceipt({
    contract: mission,
    repo: {
      remote: "https://github.com/MokiMeow/fixture.git",
      branch: "main",
      commit: REVISION,
    },
    identities: { github: "MokiMeow", vercel: "UNKNOWN" },
    modelUsage: [
      {
        phase: "build",
        model: "gpt-5.6-sol",
        effort: "high",
        tokens: { input: 10, output: 5, reasoning: 2 },
      },
    ],
    capacityLedger: {
      estimated: { reservePercent: 20 },
      actual: { totalTokens: 15 },
      sourceLabels: { actual: "observed" },
    },
    actions: [],
    gate: completionGate(mission, records, REVISION),
    findings: [],
    evidence: records,
    limitations: [],
    generatedAt: "2026-07-15T18:02:00.000Z",
  });
}

describe("Build Receipt projection", () => {
  it("is deterministic for identical stored inputs and contains no model finding prose", () => {
    const first = receipt();
    expect(receipt()).toEqual(first);
    expect(first.outcome).toBe("COMPLETE");
    expect(JSON.stringify(first)).not.toContain("model said this is fine");
    expect(verifyBuildReceipt(first)).toMatchObject({ valid: true });
  });

  it("deterministically projects fixture event files and omits advisory model prose", () => {
    const workspace = mkdtempSync(join(tmpdir(), "axiomgate-receipt-files-"));
    try {
      const capturedAt = "2026-07-15T18:00:00.000Z";
      const identity: IdentityReport = {
        githubLogin: { status: "RESOLVED", value: "MokiMeow", source: "gh api user", confidence: "HIGH", capturedAt },
        gitRemotes: { status: "RESOLVED", value: [], source: "git remote -v", confidence: "HIGH", capturedAt },
        vercelUser: { status: "UNAVAILABLE", source: "vercel whoami", reason: "not configured", capturedAt },
        vercelProject: { status: "UNAVAILABLE", source: ".vercel/project.json", reason: "not configured", capturedAt },
      };
      const created = createMission(
        workspace,
        {
          objective: "Project a stored receipt",
          criteria: [
            { id: "c_test", statement: "Tests pass", risk: "high", evidenceTypes: ["test"] },
            { id: "c_scan", statement: "Scan passes", risk: "high", evidenceTypes: ["security_scan"] },
            { id: "c_secret", statement: "Secrets pass", risk: "high", evidenceTypes: ["secret_scan"] },
          ],
        },
        {
          id: "msn_stored_receipt",
          hookConfigOptions: { cliEntryPath: join(workspace, "cli.js"), nodePath: process.execPath },
          resolveIdentity: () => identity,
        },
      );
      const stored = [
        { ...evidence("ev_test"), missionId: created.contract.id, criterionId: "c_test" },
        { ...evidence("ev_scan"), missionId: created.contract.id, criterionId: "c_scan", command: "npx patchpilot scan ." },
        { ...evidence("ev_secret"), missionId: created.contract.id, criterionId: "c_secret", command: "builtin-secret-scan --diff" },
      ];
      for (const record of stored) {
        appendFileSync(join(created.missionDir, "events.jsonl"), `${JSON.stringify(record)}\n`, "utf8");
      }
      appendFileSync(
        join(created.missionDir, "ledger.jsonl"),
        `${JSON.stringify({ model: "gpt-5.6-sol", effort: "high", role: "builder", usage: { input_tokens: 10, output_tokens: 5, reasoning_output_tokens: 2 } })}\n`,
        "utf8",
      );
      writeFileSync(
        join(created.missionDir, "findings.json"),
        JSON.stringify([{ criterionId: "c_test", verdict: "concern", concern: "model said this is fine" }]),
        "utf8",
      );
      const runner = ((command: string, args: readonly string[]) => ({
        command,
        args,
        status: "SUCCESS" as const,
        exitCode: 0,
        stdout: args.includes("--show-current") ? "main\n" : "https://github.com/MokiMeow/fixture.git\n",
        stderr: "",
        durationMs: 1,
      }));
      const options = {
        currentRevision: REVISION,
        now: () => new Date("2026-07-15T18:02:00.000Z"),
        runner,
      };

      const first = generateReceipt(workspace, created.contract.id, options);
      expect(generateReceipt(workspace, created.contract.id, options)).toEqual(first);
      expect(first.outcome).toBe("COMPLETE");
      expect(first.findings).toEqual([]);
      expect(JSON.stringify(first)).not.toContain("model said this is fine");
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("renders a readable Markdown receipt with an offline-verifiable canonical payload", () => {
    const value = receipt();
    const markdown = renderReceiptMarkdown(value);
    expect(markdown).toContain("# AxiomGate Build Receipt");
    expect(markdown).toContain("| criterion_test | PASS | ev_test |");
    expect(parseReceiptDocument(markdown)).toEqual(value);
    expect(verifyReceiptDocument(markdown)).toMatchObject({ valid: true });
  });
});

describe("evidence chain and offline receipt verification", () => {
  it("rejects a byte-flipped evidence record", () => {
    const value = structuredClone(receipt());
    value.evidenceRecords[0]!.record.outputHash =
      `sha256:${"c".repeat(64)}`;
    expect(verifyBuildReceipt(value)).toMatchObject({
      valid: false,
      errors: [expect.stringContaining("chain hash")],
    });
  });

  it("rejects reordered chained records", () => {
    const value = receipt([evidence("ev_first"), evidence("ev_second")]);
    value.evidenceRecords.reverse();
    expect(verifyBuildReceipt(value).valid).toBe(false);
  });

  it("rejects tampered contract and cited evidence hashes", () => {
    const contractTamper = structuredClone(receipt());
    contractTamper.contractHash = `sha256:${"d".repeat(64)}`;
    expect(verifyBuildReceipt(contractTamper).errors).toContain(
      "Contract hash does not match the embedded contract",
    );

    const citationTamper = structuredClone(receipt());
    citationTamper.criteria[0]!.evidenceHashes[0] =
      `sha256:${"e".repeat(64)}`;
    expect(verifyBuildReceipt(citationTamper).errors).toContain(
      "criterion_test cites an evidence hash that does not match ev_test",
    );
  });

  it("rejects a semantically stale PASS even when its chain is recomputed", () => {
    const value = structuredClone(receipt());
    value.evidenceRecords[0]!.record.freshForCommit = "older";
    value.evidenceRecords = buildEvidenceChain(
      value.evidenceRecords.map((entry) => entry.record),
    );
    value.evidenceChainHead = value.evidenceRecords.at(-1)!.hash;
    value.criteria[0]!.evidenceHashes = [value.evidenceRecords[0]!.hash];
    expect(verifyBuildReceipt(value).errors).toContain(
      "criterion_test claims PASS without fresh successful admissible evidence",
    );
  });

  it("rejects missing-evidence completion claims", () => {
    const value = structuredClone(receipt());
    value.evidenceRecords = [];
    value.evidenceChainHead = `sha256:${"0".repeat(64)}`;
    expect(verifyBuildReceipt(value).errors).toContain(
      "criterion_test cites missing evidence ev_test",
    );
    expect(verifyBuildReceipt(value).errors).toContain(
      "Receipt outcome COMPLETE does not match recomputed INCOMPLETE",
    );
  });

  it("rejects model-sourced evidence before semantic verification", () => {
    const value = structuredClone(receipt()) as unknown as {
      evidenceRecords: Array<{ record: { source: string } }>;
    };
    value.evidenceRecords[0]!.record.source = "model";
    expect(verifyBuildReceipt(value)).toMatchObject({
      valid: false,
      errors: [expect.stringContaining("schema validation failed")],
    });
  });
});
