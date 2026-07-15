import { describe, expect, it } from "vitest";

import {
  ActionRequestSchema,
  ApprovalSchema,
  BuildReceiptSchema,
  EvidenceSchema,
  INTENT_BOUNDARIES,
  MissionContractSchema,
  bumpContractVersion,
  compareIntentBoundaries,
  hashContract,
  stableStringify,
} from "../src/index.js";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

const missionContract = {
  id: "msn_01H",
  version: 1,
  hash: HASH_A,
  objective: "Add brute-force lockout to login endpoint",
  projectProfileId: "prj_demo",
  intentBoundary: "PUBLISH",
  acceptanceCriteria: [
    {
      id: "ac1",
      statement: "Five failed logins lock the account for 15 minutes",
      risk: "high",
      evidenceTypes: ["test_result"],
      verdict: "UNVERIFIED",
      evidenceIds: [],
    },
  ],
  constraints: [],
  nonGoals: [],
  actionPolicy: [
    { action: "repository.read", decision: "ALLOW" },
    {
      action: "branch.create",
      decision: "ALLOW",
      restrict: { branchPrefix: "agent/" },
    },
    { action: "production.deploy", decision: "DENY" },
  ],
  modelPlan: [
    {
      phase: "build",
      model: "gpt-5.6-sol",
      effort: "high",
      rationale: "security-sensitive",
    },
  ],
  status: "DRAFT",
  createdAt: "2026-07-15T10:00:00.000Z",
  updatedAt: "2026-07-15T10:00:00.000Z",
} as const;

const actionRequest = {
  id: "act_01H",
  missionId: "msn_01H",
  semanticAction: "pull_request.create",
  mechanism: "gh_cli",
  target: {
    type: "github_repo",
    owner: "example",
    repo: "demo",
    verifiedOwnership: true,
  },
  identity: { githubLogin: "example", source: "gh api user" },
  rawCommandHash: HASH_B,
  intentBoundaryRequired: "PUBLISH",
  risk: "medium",
  rollback: "close PR",
  decision: "AWAITING_APPROVAL",
  requestedAt: "2026-07-15T10:01:00.000Z",
  expiresAt: "2026-07-15T10:06:00.000Z",
} as const;

const approval = {
  id: "apr_01H",
  actionRequestId: "act_01H",
  boundCommandHash: HASH_B,
  surface: "telegram",
  approver: "user",
  singleUse: true,
  grantedAt: "2026-07-15T10:02:00.000Z",
  expiresAt: "2026-07-15T10:06:00.000Z",
  consumedAt: null,
} as const;

const evidence = {
  id: "ev_01H",
  missionId: "msn_01H",
  criterionId: "ac1",
  source: "command",
  command: "pnpm test",
  exitCode: 0,
  outputHash: HASH_A,
  outputRef: ".local/evidence/ev_01H.log",
  capturedAt: "2026-07-15T10:03:00.000Z",
  freshForCommit: "abc123",
  label: "LIVE",
  redacted: true,
} as const;

const buildReceipt = {
  schemaVersion: 1,
  missionId: "msn_01H",
  contract: missionContract,
  contractHash: HASH_A,
  repo: {
    remote: "https://github.com/example/demo.git",
    branch: "agent/lockout",
    commit: "abc123",
  },
  identities: { github: "example", vercel: "example-team" },
  modelUsage: [
    {
      phase: "build",
      model: "gpt-5.6-sol",
      effort: "high",
      tokens: { input: 100, output: 50, reasoning: 25 },
    },
  ],
  capacityLedger: {
    estimated: {},
    actual: {},
    sourceLabels: {},
  },
  actions: [
    {
      request: actionRequest,
      approval,
      permissionQuad: {
        actionRequestId: actionRequest.id,
        semanticAction: actionRequest.semanticAction,
        commandHash: actionRequest.rawCommandHash,
        requested: true,
        approved: true,
        applied: true,
        observed: true,
        mismatch: false,
        reasons: [],
      },
    },
  ],
  permissionQuad: {
    requested: "PUBLISH",
    approved: "PUBLISH",
    applied: "PUBLISH",
    observed: "PUBLISH",
  },
  criteria: [
    {
      id: "ac1",
      verdict: "PASS",
      evidenceIds: ["ev_01H"],
      evidenceHashes: [HASH_B],
    },
  ],
  findings: [],
  waivers: [],
  outcome: "COMPLETE",
  evidenceRecords: [
    {
      record: evidence,
      previousHash: `sha256:${"0".repeat(64)}`,
      hash: HASH_B,
    },
  ],
  evidenceChainHead: HASH_B,
  limitations: [],
  generatedAt: "2026-07-15T10:04:00.000Z",
} as const;

describe("MissionContractSchema", () => {
  it("accepts the canonical contract", () => {
    expect(MissionContractSchema.parse(missionContract)).toEqual(missionContract);
  });

  it("rejects an invalid intent boundary", () => {
    expect(
      MissionContractSchema.safeParse({
        ...missionContract,
        intentBoundary: "DEPLOY_EVERYWHERE",
      }).success,
    ).toBe(false);
  });
});

describe("ActionRequestSchema", () => {
  it("accepts the canonical action request", () => {
    expect(ActionRequestSchema.parse(actionRequest)).toEqual(actionRequest);
  });

  it("rejects an unsupported decision", () => {
    expect(
      ActionRequestSchema.safeParse({
        ...actionRequest,
        decision: "APPROVED",
      }).success,
    ).toBe(false);
  });
});

describe("ApprovalSchema", () => {
  it("accepts the canonical approval", () => {
    expect(ApprovalSchema.parse(approval)).toEqual(approval);
  });

  it("rejects an approval without a bound SHA-256 command hash", () => {
    expect(
      ApprovalSchema.safeParse({
        ...approval,
        boundCommandHash: "not-a-hash",
      }).success,
    ).toBe(false);
  });
});

describe("EvidenceSchema", () => {
  it("accepts canonical command evidence", () => {
    expect(EvidenceSchema.parse(evidence)).toEqual(evidence);
  });

  it("rejects an unsupported evidence label", () => {
    expect(
      EvidenceSchema.safeParse({ ...evidence, label: "SIMULATED" }).success,
    ).toBe(false);
  });

  it('rejects source: "model" as inadmissible evidence', () => {
    expect(
      EvidenceSchema.safeParse({ ...evidence, source: "model" }).success,
    ).toBe(false);
  });
});

describe("BuildReceiptSchema", () => {
  it("accepts the canonical receipt projection", () => {
    expect(BuildReceiptSchema.parse(buildReceipt)).toEqual(buildReceipt);
  });

  it("rejects an unsupported outcome", () => {
    expect(
      BuildReceiptSchema.safeParse({ ...buildReceipt, outcome: "SUCCESS" })
        .success,
    ).toBe(false);
  });
});

describe("canonical contract hashing", () => {
  it("is stable under object-key reordering", () => {
    const left = { z: 3, nested: { beta: 2, alpha: 1 }, a: [2, 1] };
    const right = { a: [2, 1], nested: { alpha: 1, beta: 2 }, z: 3 };

    expect(stableStringify(left)).toBe(stableStringify(right));
    expect(hashContract(left)).toBe(hashContract(right));
  });

  it("omits the contract's own hash field", () => {
    expect(hashContract({ value: 1, hash: HASH_A })).toBe(
      hashContract({ hash: HASH_B, value: 1 }),
    );
  });

  it("increments the version and re-hashes the contract", () => {
    const parsed = MissionContractSchema.parse(missionContract);
    const bumped = bumpContractVersion(
      parsed,
      "2026-07-15T11:00:00.000Z",
    );

    expect(bumped.version).toBe(2);
    expect(bumped.updatedAt).toBe("2026-07-15T11:00:00.000Z");
    expect(bumped.hash).toBe(hashContract(bumped));
    expect(bumped.hash).not.toBe(parsed.hash);
  });
});

describe("intent boundary ordering", () => {
  it("orders every boundary from observe through production", () => {
    for (let index = 0; index < INTENT_BOUNDARIES.length - 1; index += 1) {
      const current = INTENT_BOUNDARIES[index];
      const next = INTENT_BOUNDARIES[index + 1];

      expect(current).toBeDefined();
      expect(next).toBeDefined();
      expect(compareIntentBoundaries(current!, next!)).toBe(-1);
      expect(compareIntentBoundaries(next!, current!)).toBe(1);
      expect(compareIntentBoundaries(current!, current!)).toBe(0);
    }
  });
});
