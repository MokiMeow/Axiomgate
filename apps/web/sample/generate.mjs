import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  completionGate,
  createBuildReceipt,
  hashContract,
} from "../../../packages/axiomgate-core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const missionId = "msn_demo_lockout";
const commit = "demo9f3a1c7e2";
const createdAt = "2026-07-20T09:00:00.000Z";

const criteria = [
  {
    id: "criterion_implementation",
    statement: "Lockout logic is implemented without unrelated file changes",
    risk: "high",
    evidenceTypes: ["diff"],
    verdict: "UNVERIFIED",
    evidenceIds: [],
  },
  {
    id: "criterion_lockout",
    statement: "The sixth failed login is locked for 15 minutes after five failures",
    risk: "critical",
    evidenceTypes: ["lockout_test"],
    verdict: "UNVERIFIED",
    evidenceIds: [],
  },
  {
    id: "criterion_regression",
    statement: "Existing successful-login and validation behavior remains green",
    risk: "high",
    evidenceTypes: ["test"],
    verdict: "UNVERIFIED",
    evidenceIds: [],
  },
  {
    id: "criterion_dependencies",
    statement: "The inherited lodash advisory is remediated and no vulnerable dependency remains",
    risk: "high",
    evidenceTypes: ["security_scan"],
    verdict: "UNVERIFIED",
    evidenceIds: [],
  },
  {
    id: "criterion_secrets",
    statement: "The diff contains no credential or secret material",
    risk: "critical",
    evidenceTypes: ["secret_scan"],
    verdict: "UNVERIFIED",
    evidenceIds: [],
  },
];

const contractWithoutHash = {
  id: missionId,
  version: 3,
  objective: "Add brute-force lockout to the login endpoint (lock after 5 failed attempts for 15 minutes), preserve existing behavior",
  projectProfileId: "sample-target-app",
  intentBoundary: "MODIFY_LOCAL",
  acceptanceCriteria: criteria,
  constraints: [
    "Synthetic demo users only",
    "Do not publish or deploy",
    "Preserve the existing login response contract",
  ],
  nonGoals: ["Production deployment", "Persistent account storage"],
  actionPolicy: [
    { action: "repository.read", decision: "ALLOW" },
    { action: "file.modify", decision: "ALLOW" },
    { action: "branch.create", decision: "ALLOW", restrict: { branchPrefix: "agent/" } },
    { action: "pull_request.create", decision: "REQUIRE_APPROVAL" },
    { action: "preview.deploy", decision: "REQUIRE_APPROVAL" },
    { action: "production.deploy", decision: "DENY" },
    { action: "verification.run", decision: "ALLOW" },
  ],
  modelPlan: [
    {
      phase: "scout",
      model: "gpt-5.6-luna",
      effort: "light",
      rationale: "Structured repository mapping with low spend",
    },
    {
      phase: "build",
      model: "gpt-5.6-sol",
      effort: "high",
      rationale: "Primary implementation with a sustained reasoning chain",
    },
    {
      phase: "security escalation note",
      model: "gpt-5.6-sol",
      effort: "max",
      rationale: "Recommended only for the hardest security-sensitive step; this sample used High",
      multiAgent: false,
      capabilityNote: "Ultra is native Codex multi-agent mode and was not orchestrated by AxiomGate",
    },
    {
      phase: "remediate",
      model: "gpt-5.6-terra",
      effort: "medium",
      rationale: "Bounded dependency remediation",
    },
    {
      phase: "verify",
      model: "gpt-5.6-terra",
      effort: "high",
      rationale: "Independent read-only challenge in a fresh session",
    },
  ],
  budgetPolicy: { reservePercent: 20 },
  status: "COMPLETE",
  createdAt,
  updatedAt: "2026-07-20T09:24:00.000Z",
};
const contract = {
  ...contractWithoutHash,
  hash: hashContract(contractWithoutHash),
};

function evidence(id, criterionId, command, source, capturedAt, outputByte) {
  return {
    id,
    missionId,
    criterionId,
    source,
    command,
    exitCode: 0,
    outputHash: `sha256:${outputByte.repeat(64)}`,
    outputRef: `sample://evidence/${id}`,
    capturedAt,
    freshForCommit: commit,
    label: "REPLAY",
    redacted: true,
  };
}

const evidenceRecords = [
  evidence("ev_demo_diff", "criterion_implementation", "git diff --check", "command", "2026-07-20T09:15:00.000Z", "1"),
  evidence("ev_demo_lockout", "criterion_lockout", "npm run test:lockout", "command", "2026-07-20T09:16:00.000Z", "2"),
  evidence("ev_demo_regression", "criterion_regression", "npm test", "command", "2026-07-20T09:17:00.000Z", "3"),
  evidence("ev_demo_dependency", "criterion_dependencies", "patchpilot scan .", "api", "2026-07-20T09:22:00.000Z", "4"),
  evidence("ev_demo_secrets", "criterion_secrets", "builtin-secret-scan --diff", "command", "2026-07-20T09:23:00.000Z", "5"),
];
const gate = completionGate(contract, evidenceRecords, commit);

const resolvedFinding = {
  id: "finding_demo_lodash",
  checkId: "dependency_scan",
  criterionIds: ["criterion_dependencies"],
  title: "Inherited lodash advisory",
  detail: "Sample initial scan found lodash 4.17.4; governed remediation upgraded it and the targeted rerun passed.",
  severity: "high",
  status: "resolved",
  cve: "CVE-2021-23337",
  advisory: "GHSA-35jh-r3h4-6jhm",
  ecosystem: "npm",
  package: "lodash",
  version: "4.17.4",
  fixedVersion: "4.17.21",
  reachability: "unknown",
};

const receipt = createBuildReceipt({
  contract,
  repo: {
    remote: "https://example.invalid/axiomgate/sample-target-app.git",
    branch: "agent/demo-lockout",
    commit,
  },
  identities: { github: "sample-owner", vercel: "SAMPLE_NOT_CONNECTED" },
  modelUsage: [
    { phase: "build", model: "gpt-5.6-sol", effort: "high", tokens: { input: 18420, output: 2240, reasoning: 920 } },
    { phase: "remediate", model: "gpt-5.6-terra", effort: "medium", tokens: { input: 6140, output: 760, reasoning: 210 } },
    { phase: "verify", model: "gpt-5.6-terra", effort: "high", tokens: { input: 8900, output: 1100, reasoning: 430 } },
  ],
  capacityLedger: {
    estimated: { totalTokens: 42000 },
    actual: { totalTokens: 37540 },
    sourceLabels: { capacity: "SAMPLE", tokenUsage: "SAMPLE" },
  },
  actions: [],
  gate,
  findings: [resolvedFinding],
  evidence: evidenceRecords,
  limitations: [
    "Curated synthetic hosted-demo receipt; it does not represent a live account or deployment.",
  ],
  generatedAt: "2026-07-20T09:25:00.000Z",
});

const denial = {
  ts: "2026-07-20T09:05:00.000Z",
  hookEvent: "PreToolUse",
  toolName: "shell",
  commandHash: `sha256:${"6".repeat(64)}`,
  semanticAction: "preview.deploy",
  command: "vercel deploy --scope sample-unowned-team",
  decision: "DENY",
  reasons: [
    "SAMPLE replay: deploy target exists but is not owned by the expected sample profile (EXISTS_NOT_OWNED).",
  ],
  missionId,
  sessionId: "session_demo_builder",
  label: "SAMPLE",
};

const mission = {
  id: missionId,
  label: "SAMPLE",
  sampleNotice: "CURATED DEMO DATA - synthetic and not a live run",
  contract,
  identity: {
    githubLogin: {
      value: "sample-owner",
      source: "sample",
      confidence: "sample",
      capturedAt: createdAt,
    },
  },
  denials: [denial],
  evidence: evidenceRecords,
  events: [
    { type: "mission.planned", ts: createdAt, missionId, label: "SAMPLE" },
    denial,
    { type: "run.completed", ts: "2026-07-20T09:18:00.000Z", missionId, role: "builder", status: "PASS", label: "SAMPLE" },
    { type: "verification.completed", ts: "2026-07-20T09:19:00.000Z", missionId, status: "FAIL", findingId: resolvedFinding.id, label: "SAMPLE" },
    { type: "remediation.completed", ts: "2026-07-20T09:22:00.000Z", missionId, findingId: resolvedFinding.id, status: "PASS", label: "SAMPLE" },
    { type: "proof.completed", ts: "2026-07-20T09:25:00.000Z", missionId, outcome: "COMPLETE", label: "SAMPLE" },
  ],
  ledger: [
    { role: "builder", phase: "build", model: "gpt-5.6-sol", effort: "high", usage: { input_tokens: 18420, output_tokens: 2240, reasoning_output_tokens: 920 }, label: "SAMPLE" },
    { role: "builder", phase: "remediate", model: "gpt-5.6-terra", effort: "medium", usage: { input_tokens: 6140, output_tokens: 760, reasoning_output_tokens: 210 }, label: "SAMPLE" },
    { role: "verifier", phase: "verify", model: "gpt-5.6-terra", effort: "high", usage: { input_tokens: 8900, output_tokens: 1100, reasoning_output_tokens: 430 }, label: "SAMPLE" },
  ],
  sessions: [
    { id: "session_demo_builder", role: "builder", label: "SAMPLE" },
    { id: "session_demo_verifier", role: "verifier", sandbox: "read-only", fresh: true, label: "SAMPLE" },
  ],
  findings: [resolvedFinding],
  runs: [
    { id: "run_demo_build", role: "builder", status: "SUCCESS", model: "gpt-5.6-sol", effort: "high", startedAt: "2026-07-20T09:08:00.000Z", endedAt: "2026-07-20T09:18:00.000Z", label: "SAMPLE" },
    { id: "run_demo_remediate", role: "remediate", status: "SUCCESS", model: "gpt-5.6-terra", effort: "medium", startedAt: "2026-07-20T09:20:00.000Z", endedAt: "2026-07-20T09:22:00.000Z", label: "SAMPLE" },
    { id: "run_demo_verify", role: "verifier", status: "SUCCESS", model: "gpt-5.6-terra", effort: "high", sandbox: "read-only", startedAt: "2026-07-20T09:22:30.000Z", endedAt: "2026-07-20T09:24:00.000Z", label: "SAMPLE" },
  ],
  verifications: [
    { id: "verify_demo_initial", overall: "FAIL", findingIds: [resolvedFinding.id], startedAt: "2026-07-20T09:18:10.000Z", endedAt: "2026-07-20T09:19:00.000Z", label: "SAMPLE" },
    { id: "verify_demo_targeted", overall: "PASS", resolvedFindingIds: [resolvedFinding.id], startedAt: "2026-07-20T09:22:10.000Z", endedAt: "2026-07-20T09:23:30.000Z", label: "SAMPLE" },
  ],
  approvals: [],
  receipt,
};

const capacity = {
  kind: "sample",
  label: "SAMPLE CAPACITY",
  source: "sample",
  confidence: "sample",
  capturedAt: "2026-07-20T09:00:00.000Z",
  planType: "pro (sample)",
  windows: [
    {
      limitId: "codex",
      windowLabel: "weekly",
      usedPercent: 37,
      resetsAt: "2026-07-27T00:00:00.000Z",
      source: "sample",
      confidence: "sample",
    },
    {
      limitId: "codex-secondary",
      windowLabel: "5-hour",
      usedPercent: 12,
      resetsAt: "2026-07-20T14:00:00.000Z",
      source: "sample",
      confidence: "sample",
    },
  ],
  bankedResets: [
    {
      id: "sample-reset-1",
      status: "available",
      expiresAt: "2026-07-22T09:00:00.000Z",
      label: "SAMPLE",
    },
  ],
  note: "Illustrative hosted-demo capacity. No Codex account was queried.",
};

await Promise.all([
  writeFile(join(here, "mission.json"), `${JSON.stringify(mission, null, 2)}\n`, "utf8"),
  writeFile(join(here, "capacity.json"), `${JSON.stringify(capacity, null, 2)}\n`, "utf8"),
]);

console.log(`generated ${missionId}: ${receipt.outcome}, ${receipt.evidenceRecords.length} chained evidence records`);
