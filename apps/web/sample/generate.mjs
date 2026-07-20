import { createHash } from "node:crypto";
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

function sampleHash(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function commandForEvidenceType(type) {
  const commands = {
    api_response: "sample-api-check",
    build: "npm run build",
    command: "node sample-check.mjs",
    diff: "git diff --check",
    hook_decision: "axiomgate hook sample-check",
    lockout_test: "npm run test:lockout",
    secret_scan: "builtin-secret-scan --diff",
    security_scan: "patchpilot scan .",
    test: "npm test",
  };
  return commands[type] || "node sample-check.mjs";
}

function createDerivedMission(config) {
  const derivedCommit = `demo-${config.slug}-commit`;
  const derivedCriteria = config.criteria.map((criterion, index) => ({
    id: `criterion_${config.slug}_${index + 1}`,
    statement: criterion.statement,
    risk: criterion.risk || "medium",
    evidenceTypes: criterion.evidenceTypes,
    verdict: "UNVERIFIED",
    evidenceIds: [],
  }));
  const contractDraft = {
    ...contractWithoutHash,
    id: config.id,
    version: 1,
    objective: config.objective,
    projectProfileId: `sample-${config.slug}`,
    intentBoundary: config.boundary || "MODIFY_LOCAL",
    acceptanceCriteria: derivedCriteria,
    status: config.status,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
  const derivedContract = { ...contractDraft, hash: hashContract(contractDraft) };
  const proven = new Set(config.provenCriteria || []);
  const derivedEvidence = [];
  for (const [criterionIndex, criterion] of derivedCriteria.entries()) {
    if (!proven.has(criterionIndex)) continue;
    for (const [typeIndex, evidenceType] of criterion.evidenceTypes.entries()) {
      const command = commandForEvidenceType(evidenceType);
      derivedEvidence.push({
        id: `ev_${config.slug}_${criterionIndex + 1}_${typeIndex + 1}`,
        missionId: config.id,
        criterionId: criterion.id,
        source:
          evidenceType === "api_response"
            ? "api"
            : evidenceType === "hook_decision"
              ? "hook"
              : "command",
        command,
        exitCode: 0,
        outputHash: sampleHash(`${config.id}:${criterion.id}:${evidenceType}`),
        outputRef: `sample://evidence/${config.slug}/${criterion.id}/${evidenceType}`,
        capturedAt: config.updatedAt,
        freshForCommit: derivedCommit,
        label: "REPLAY",
        redacted: true,
      });
    }
  }
  const waivers = (config.waivers || []).map((waiver) => ({
    criterionId: derivedCriteria[waiver.criterionIndex].id,
    reason: waiver.reason,
    approver: "sample-owner",
    riskAccepted: waiver.riskAccepted,
    ts: config.updatedAt,
  }));
  const gate = completionGate(
    derivedContract,
    derivedEvidence,
    derivedCommit,
    { waivers },
  );
  const findings = config.findings || [];
  const derivedReceipt = createBuildReceipt({
    contract: derivedContract,
    repo: {
      remote: `https://example.invalid/axiomgate/${config.slug}.git`,
      branch: `agent/${config.slug}`,
      commit: derivedCommit,
    },
    identities: { github: "sample-owner", vercel: "SAMPLE_NOT_CONNECTED" },
    modelUsage: [
      {
        phase: "build",
        model: "gpt-5.6-sol",
        effort: "high",
        tokens: { input: config.tokens || 7200, output: 840, reasoning: 260 },
      },
      {
        phase: "verify",
        model: "gpt-5.6-terra",
        effort: "high",
        tokens: { input: 3100, output: 420, reasoning: 150 },
      },
    ],
    capacityLedger: {
      estimated: { totalTokens: 16000 },
      actual: { totalTokens: (config.tokens || 7200) + 4610 },
      sourceLabels: { capacity: "SAMPLE", tokenUsage: "SAMPLE" },
    },
    actions: [],
    gate,
    findings,
    evidence: derivedEvidence,
    limitations: [
      "Curated synthetic hosted-demo receipt; it does not represent a live account or deployment.",
    ],
    generatedAt: config.updatedAt,
  });
  const denials = (config.denials || []).map((denial, index) => ({
    ts: config.updatedAt,
    hookEvent: "PreToolUse",
    toolName: "shell",
    commandHash: sampleHash(`${config.id}:deny:${index}`),
    semanticAction: denial.semanticAction,
    command: denial.command,
    decision: "DENY",
    reasons: [denial.reason],
    missionId: config.id,
    sessionId: `session_${config.slug}_builder`,
    label: "SAMPLE",
  }));
  const verifications = (config.verificationStates || []).map((overall, index) => ({
    id: `verify_${config.slug}_${index + 1}`,
    overall,
    findingIds: findings.map((finding) => finding.id),
    startedAt: config.updatedAt,
    endedAt: config.updatedAt,
    label: "SAMPLE",
  }));
  const approvals = config.pendingApproval
    ? [
        {
          request: {
            id: `act_${config.slug}_publish`,
            missionId: config.id,
            semanticAction: "pull_request.create",
            mechanism: "gh cli",
            target: {
              type: "github_repo",
              owner: "sample-owner",
              repo: `sample-${config.slug}`,
              verifiedOwnership: true,
              branch: `agent/${config.slug}`,
            },
            identity: {
              githubLogin: "sample-owner",
              source: "sample",
            },
            rawCommandHash: sampleHash(`${config.id}:gh-pr-create`),
            intentBoundaryRequired: "PUBLISH",
            risk: "medium",
            rollback: "Close the SAMPLE pull request without merging",
            decision: "AWAITING_APPROVAL",
            requestedAt: config.updatedAt,
            expiresAt: "2026-07-30T12:00:00.000Z",
          },
          reasons: ["SAMPLE policy requires one-time approval before creating a pull request."],
          displayCommand: "gh pr create --title 'Validate registration input'",
          status: "PENDING",
          createdAt: config.updatedAt,
          expiresAt: "2026-07-30T12:00:00.000Z",
          approval: null,
          deniedAt: null,
          deniedBy: null,
          deniedSurface: null,
        },
      ]
    : [];
  const hasRun = config.hasRun !== false;
  return {
    id: config.id,
    label: "SAMPLE",
    sampleNotice: "CURATED DEMO DATA - synthetic and not a live run",
    contract: derivedContract,
    identity: {
      githubLogin: {
        value: "sample-owner",
        source: "sample",
        confidence: "sample",
        capturedAt: config.createdAt,
      },
    },
    denials,
    evidence: derivedEvidence,
    events: [
      { type: "mission.planned", ts: config.createdAt, missionId: config.id, label: "SAMPLE" },
      ...denials,
      ...verifications.map((run) => ({
        type: "verification.completed",
        ts: run.endedAt,
        missionId: config.id,
        status: run.overall,
        label: "SAMPLE",
      })),
      {
        type: "proof.evaluated",
        ts: config.updatedAt,
        missionId: config.id,
        outcome: derivedReceipt.outcome,
        label: "SAMPLE",
      },
    ],
    ledger: hasRun
      ? [
          {
            role: "builder",
            phase: "build",
            model: "gpt-5.6-sol",
            effort: "high",
            usage: {
              input_tokens: config.tokens || 7200,
              output_tokens: 840,
              reasoning_output_tokens: 260,
            },
            label: "SAMPLE",
          },
          {
            role: "verifier",
            phase: "verify",
            model: "gpt-5.6-terra",
            effort: "high",
            usage: { input_tokens: 3100, output_tokens: 420, reasoning_output_tokens: 150 },
            label: "SAMPLE",
          },
        ]
      : [],
    sessions: hasRun
      ? [
          { id: `session_${config.slug}_builder`, role: "builder", label: "SAMPLE" },
          { id: `session_${config.slug}_verifier`, role: "verifier", sandbox: "read-only", fresh: true, label: "SAMPLE" },
        ]
      : [],
    findings,
    runs: hasRun
      ? [
          {
            id: `run_${config.slug}_build`,
            role: "builder",
            status: "SUCCESS",
            model: "gpt-5.6-sol",
            effort: "high",
            startedAt: config.createdAt,
            endedAt: config.updatedAt,
            label: "SAMPLE",
          },
        ]
      : [],
    verifications,
    approvals,
    receipt: derivedReceipt,
  };
}

const lodashRemediationFinding = {
  id: "finding_dependency_lodash",
  checkId: "dependency_scan",
  criterionIds: ["criterion_dependency_fix_2"],
  title: "Inherited lodash advisory",
  detail: "The SAMPLE initial scan found lodash 4.17.4; governed remediation upgraded it and the targeted rerun passed.",
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

const missions = [
  mission,
  createDerivedMission({
    id: "msn_demo_rate_limit_gate",
    slug: "rate_limit_gate",
    objective: "Add per-IP rate limiting to the password reset endpoint without changing valid requests",
    status: "VERIFYING",
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-20T08:18:00.000Z",
    criteria: [
      { statement: "Rate limiting engages after the configured threshold", risk: "high", evidenceTypes: ["test"] },
      { statement: "Valid reset requests preserve their existing response", risk: "high", evidenceTypes: ["test"] },
      { statement: "The implementation is scoped to the reset route", evidenceTypes: ["diff"] },
      { statement: "The dependency scan has no new finding", risk: "high", evidenceTypes: ["security_scan"] },
      { statement: "A retry-after response is verified end to end", risk: "high", evidenceTypes: ["api_response"] },
    ],
    provenCriteria: [0, 1, 2, 3],
    verificationStates: ["PASS"],
  }),
  createDerivedMission({
    id: "msn_demo_wrong_target",
    slug: "wrong_target",
    objective: "Publish a preview of the account settings validation change",
    boundary: "DEPLOY_PREVIEW",
    status: "RUNNING",
    createdAt: "2026-07-20T07:30:00.000Z",
    updatedAt: "2026-07-20T07:42:00.000Z",
    criteria: [
      { statement: "Account settings validation passes", evidenceTypes: ["test"] },
      { statement: "The preview target is owned by the expected profile", risk: "critical", evidenceTypes: ["api_response"] },
      { statement: "The preview build succeeds", evidenceTypes: ["build"] },
      { statement: "The diff contains no secret", risk: "critical", evidenceTypes: ["secret_scan"] },
    ],
    provenCriteria: [0, 3],
    denials: [
      {
        semanticAction: "preview.deploy",
        command: "vercel deploy --scope sample-unowned-team",
        reason: "SAMPLE replay: deploy target exists but is not owned by the expected profile (EXISTS_NOT_OWNED).",
      },
    ],
  }),
  createDerivedMission({
    id: "msn_demo_governed_state",
    slug: "governed_state",
    objective: "Update session validation while preserving AxiomGate governance state",
    status: "RUNNING",
    createdAt: "2026-07-20T07:00:00.000Z",
    updatedAt: "2026-07-20T07:11:00.000Z",
    criteria: [
      { statement: "Session validation change passes unit tests", evidenceTypes: ["test"] },
      { statement: "Governed mission state remains untouched", risk: "critical", evidenceTypes: ["hook_decision"] },
      { statement: "The final diff is scoped to application code", risk: "high", evidenceTypes: ["diff"] },
    ],
    provenCriteria: [1],
    denials: [
      {
        semanticAction: "file.modify",
        command: "write .axiomgate/missions/msn_demo_governed_state/contract.json",
        reason: "SAMPLE replay: writes to governed .axiomgate state are hard-denied outside the trusted internal mutation path.",
      },
    ],
  }),
  createDerivedMission({
    id: "msn_demo_dependency_fix",
    slug: "dependency_fix",
    objective: "Upgrade the inherited lodash dependency and rerun the affected checks",
    status: "COMPLETE",
    createdAt: "2026-07-20T06:20:00.000Z",
    updatedAt: "2026-07-20T06:38:00.000Z",
    criteria: [
      { statement: "The lockfile change is limited to lodash", evidenceTypes: ["diff"] },
      { statement: "The dependency advisory is cleared", risk: "high", evidenceTypes: ["security_scan"] },
      { statement: "The application test suite remains green", evidenceTypes: ["test"] },
    ],
    provenCriteria: [0, 1, 2],
    findings: [lodashRemediationFinding],
    verificationStates: ["FAIL", "PASS"],
  }),
  createDerivedMission({
    id: "msn_demo_secret_waiver",
    slug: "secret_waiver",
    objective: "Verify webhook secret rotation readiness without changing a provider account",
    status: "COMPLETE",
    createdAt: "2026-07-20T05:40:00.000Z",
    updatedAt: "2026-07-20T05:55:00.000Z",
    criteria: [
      { statement: "Local secret references are redacted and valid", risk: "critical", evidenceTypes: ["secret_scan"] },
      { statement: "The external provider confirms the rotated value", risk: "critical", evidenceTypes: ["api_response"] },
    ],
    provenCriteria: [0],
    waivers: [
      {
        criterionIndex: 1,
        reason: "SAMPLE waiver: hosted demo has no provider account and performs no credential mutation.",
        riskAccepted: "Provider-side rotation remains a user-owned production action.",
      },
    ],
  }),
  createDerivedMission({
    id: "msn_demo_awaiting_approval",
    slug: "awaiting_approval",
    objective: "Add registration input validation and open a review pull request",
    boundary: "PUBLISH",
    status: "AWAITING_APPROVAL",
    createdAt: "2026-07-20T05:00:00.000Z",
    updatedAt: "2026-07-20T05:18:00.000Z",
    criteria: [
      { statement: "Malformed registration input is rejected", risk: "high", evidenceTypes: ["test"] },
      { statement: "Existing registration behavior remains green", evidenceTypes: ["test"] },
      { statement: "The approved pull request action is observed", risk: "high", evidenceTypes: ["api_response"] },
    ],
    provenCriteria: [0, 1],
    pendingApproval: true,
  }),
  createDerivedMission({
    id: "msn_demo_observe_audit",
    slug: "observe_audit",
    objective: "Audit login configuration and document the current trust boundary",
    boundary: "OBSERVE",
    status: "COMPLETE",
    createdAt: "2026-07-20T04:20:00.000Z",
    updatedAt: "2026-07-20T04:31:00.000Z",
    criteria: [
      { statement: "Repository configuration is inspected without mutation", evidenceTypes: ["command"] },
      { statement: "The trust-boundary note matches the observed files", evidenceTypes: ["diff"] },
    ],
    provenCriteria: [0, 1],
    hasRun: false,
  }),
];

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
  writeFile(join(here, "missions.json"), `${JSON.stringify(missions, null, 2)}\n`, "utf8"),
  writeFile(join(here, "capacity.json"), `${JSON.stringify(capacity, null, 2)}\n`, "utf8"),
]);

console.log(
  `generated ${missions.length} SAMPLE missions; flagship ${missionId}: ${receipt.outcome}, ${receipt.evidenceRecords.length} chained evidence records`,
);
