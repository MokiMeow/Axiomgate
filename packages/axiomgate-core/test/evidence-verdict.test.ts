import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assemblePermissionQuads,
  completionGate,
  computeCriterionVerdict,
  createMission,
  loadMissionStatus,
  readWaivers,
  recordWaiver,
  type Evidence,
  type HookDecisionEvent,
  type IdentityReport,
  type MissionContract,
  type Waiver,
} from "../src/index.js";

const HASH = `sha256:${"a".repeat(64)}` as const;

const criterion: MissionContract["acceptanceCriteria"][number] = {
  id: "criterion_regression",
  statement: "The regression suite passes",
  risk: "high",
  evidenceTypes: ["test"],
  verdict: "UNVERIFIED",
  evidenceIds: [],
};

const mission: MissionContract = {
  id: "msn_test",
  version: 1,
  hash: HASH,
  objective: "Prove the regression",
  projectProfileId: "fixture",
  intentBoundary: "MODIFY_LOCAL",
  acceptanceCriteria: [criterion],
  constraints: [],
  nonGoals: [],
  actionPolicy: [
    { action: "file.modify", decision: "ALLOW" },
    { action: "pull_request.create", decision: "REQUIRE_APPROVAL" },
  ],
  modelPlan: [
    {
      phase: "build",
      model: "gpt-5.6-sol",
      effort: "high",
      rationale: "primary implementation",
    },
  ],
  status: "ACTIVE",
  createdAt: "2026-07-15T17:00:00.000Z",
  updatedAt: "2026-07-15T17:00:00.000Z",
};

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "ev_test",
    missionId: "msn_test",
    criterionId: criterion.id,
    source: "command",
    command: "npm test",
    exitCode: 0,
    outputHash: HASH,
    outputRef: ".axiomgate/test.log",
    capturedAt: "2026-07-15T18:00:00.000Z",
    freshForCommit: "WORKTREE:abc123",
    label: "LIVE",
    redacted: true,
    ...overrides,
  };
}

describe("computeCriterionVerdict", () => {
  it("passes only when every required evidence type has fresh admissible success", () => {
    expect(
      computeCriterionVerdict(criterion, [evidence()], "WORKTREE:abc123"),
    ).toEqual({
      criterionId: "criterion_regression",
      verdict: "PASS",
      evidenceIds: ["ev_test"],
      missingEvidenceTypes: [],
      reasons: ["Fresh successful evidence satisfies test: ev_test"],
    });
  });

  it("keeps missing or stale required evidence unverified", () => {
    expect(
      computeCriterionVerdict(criterion, [], "WORKTREE:abc123"),
    ).toMatchObject({
      verdict: "UNVERIFIED",
      evidenceIds: [],
      missingEvidenceTypes: ["test"],
    });
    expect(
      computeCriterionVerdict(
        criterion,
        [evidence({ freshForCommit: "older" })],
        "WORKTREE:abc123",
      ),
    ).toMatchObject({ verdict: "UNVERIFIED", evidenceIds: [] });
  });

  it("never treats a generic passing suite as dedicated lockout proof", () => {
    const lockoutCriterion = {
      ...criterion,
      id: "criterion_lockout",
      statement: "The account locks after five failures",
      evidenceTypes: ["lockout_test"],
    };
    expect(
      computeCriterionVerdict(
        lockoutCriterion,
        [evidence({ criterionId: "criterion_lockout", command: "npm test" })],
        "WORKTREE:abc123",
      ),
    ).toMatchObject({ verdict: "UNVERIFIED", missingEvidenceTypes: ["lockout_test"] });
    expect(
      computeCriterionVerdict(
        lockoutCriterion,
        [evidence({
          criterionId: "criterion_lockout",
          command: "npm run test:lockout",
          exitCode: 1,
        })],
        "WORKTREE:abc123",
      ),
    ).toMatchObject({ verdict: "FAIL", evidenceIds: ["ev_test"] });
  });

  it.each([
    [1, "FAIL"],
    [124, "BLOCKED"],
    [127, "UNKNOWN"],
  ] as const)("propagates exit %s as %s when no successful evidence exists", (exitCode, verdict) => {
    expect(
      computeCriterionVerdict(
        criterion,
        [evidence({ exitCode })],
        "WORKTREE:abc123",
      ),
    ).toMatchObject({ verdict, evidenceIds: ["ev_test"] });
  });

  it("rejects model-sourced records at the evidence boundary", () => {
    expect(() =>
      computeCriterionVerdict(
        criterion,
        [{ ...evidence(), source: "model" } as unknown as Evidence],
        "WORKTREE:abc123",
      ),
    ).toThrow();
  });
});

function identity(capturedAt: string): IdentityReport {
  return {
    githubLogin: {
      status: "RESOLVED",
      value: "MokiMeow",
      source: "gh api user",
      confidence: "HIGH",
      capturedAt,
    },
    gitRemotes: {
      status: "RESOLVED",
      value: [],
      source: "git remote -v",
      confidence: "HIGH",
      capturedAt,
    },
    vercelUser: {
      status: "UNAVAILABLE",
      source: "vercel whoami",
      reason: "not configured",
      capturedAt,
    },
    vercelProject: {
      status: "UNAVAILABLE",
      source: ".vercel/project.json",
      reason: "not configured",
      capturedAt,
    },
  };
}

describe("waiver persistence", () => {
  it("records an attributed waiver only for a mission criterion", () => {
    const workspace = mkdtempSync(join(tmpdir(), "axiomgate-waiver-"));
    try {
      const created = createMission(
        workspace,
        { objective: "Exercise waiver persistence" },
        {
          id: "msn_waiver",
          hookConfigOptions: {
            cliEntryPath: join(workspace, "cli.js"),
            nodePath: process.execPath,
          },
          resolveIdentity: () => identity("2026-07-15T18:00:00.000Z"),
        },
      );
      const criterionId = created.contract.acceptanceCriteria[0]!.id;
      const waiver = recordWaiver(
        workspace,
        "msn_waiver",
        {
          criterionId,
          reason: "Judge fixture cannot reach external service",
          approver: "mokimeow",
          riskAccepted: "External-service coverage is omitted",
        },
        { now: () => new Date("2026-07-15T18:02:00.000Z") },
      );

      expect(readWaivers(created.missionDir)).toEqual([waiver]);
      expect(() =>
        recordWaiver(workspace, "msn_waiver", {
          criterionId: "not-a-criterion",
          reason: "invalid",
          approver: "mokimeow",
          riskAccepted: "none",
        }),
      ).toThrow(/criterion/u);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("loadMissionStatus", () => {
  it("projects the proof table only from persisted admissible evidence", () => {
    const workspace = mkdtempSync(join(tmpdir(), "axiomgate-status-"));
    try {
      const created = createMission(
        workspace,
        {
          objective: "Exercise persisted proof status",
          criteria: [
            { id: "c_test", statement: "Tests pass", risk: "high", evidenceTypes: ["test"] },
            { id: "c_scan", statement: "Dependencies are clean", risk: "high", evidenceTypes: ["security_scan"] },
            { id: "c_secret", statement: "No secrets", risk: "high", evidenceTypes: ["secret_scan"] },
          ],
        },
        {
          id: "msn_status",
          hookConfigOptions: {
            cliEntryPath: join(workspace, "cli.js"),
            nodePath: process.execPath,
          },
          resolveIdentity: () => identity("2026-07-15T18:00:00.000Z"),
        },
      );
      const records = [
        evidence({ id: "ev_test", missionId: "msn_status", criterionId: "c_test" }),
        evidence({ id: "ev_scan", missionId: "msn_status", criterionId: "c_scan", command: "npx patchpilot scan ." }),
        evidence({ id: "ev_secret", missionId: "msn_status", criterionId: "c_secret", command: "builtin-secret-scan --diff" }),
      ];
      for (const record of records) {
        appendFileSync(join(created.missionDir, "events.jsonl"), `${JSON.stringify(record)}\n`, "utf8");
      }

      const status = loadMissionStatus(workspace, "msn_status", {
        currentRevision: "WORKTREE:abc123",
      });
      expect(status.gate.outcome).toBe("COMPLETE");
      expect(status.evidence).toHaveLength(3);
      expect(status.gate.criteria.map((entry) => entry.verdict)).toEqual([
        "PASS",
        "PASS",
        "PASS",
      ]);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("completionGate", () => {
  it("completes only when every criterion has a fresh PASS", () => {
    expect(
      completionGate(mission, [evidence()], "WORKTREE:abc123"),
    ).toMatchObject({
      outcome: "COMPLETE",
      blockingReasons: [],
      criteria: [{ criterionId: criterion.id, verdict: "PASS" }],
    });
  });

  it("blocks with the exact reason when evidence is unknown", () => {
    expect(
      completionGate(
        mission,
        [evidence({ exitCode: 127 })],
        "WORKTREE:abc123",
      ),
    ).toMatchObject({
      outcome: "INCOMPLETE",
      criteria: [{ criterionId: criterion.id, verdict: "UNKNOWN" }],
      blockingReasons: [
        "criterion_regression is UNKNOWN: Evidence mechanism was unavailable for test",
      ],
    });
  });

  it("allows an attributed waiver while keeping it visible", () => {
    const waiver: Waiver = {
      criterionId: criterion.id,
      reason: "External test service unavailable",
      approver: "mokimeow",
      riskAccepted: "Regression risk accepted for demo fixture",
      ts: "2026-07-15T18:01:00.000Z",
    };
    expect(
      completionGate(mission, [], "WORKTREE:abc123", { waivers: [waiver] }),
    ).toMatchObject({
      outcome: "COMPLETE",
      criteria: [{ criterionId: criterion.id, verdict: "WAIVED", waiver }],
      waivers: [waiver],
    });
  });

  it("flags applied actions that lack post-action observation", () => {
    const hookEvent: HookDecisionEvent = {
      source: "hook",
      ts: "2026-07-15T18:00:00.000Z",
      hookEvent: "PreToolUse",
      toolName: "apply_patch",
      commandHash: HASH,
      semanticAction: "file.modify",
      decision: "ALLOW",
      reasons: ["Policy allows file.modify"],
      missionId: mission.id,
      sessionId: "session_test",
    };
    const quads = assemblePermissionQuads(mission, [], [], [hookEvent], [], "WORKTREE:abc123");
    expect(quads).toMatchObject([
      {
        semanticAction: "file.modify",
        requested: true,
        approved: true,
        applied: true,
        observed: false,
        mismatch: true,
      },
    ]);
    expect(
      completionGate(mission, [evidence()], "WORKTREE:abc123", {
        permissionQuads: quads,
      }),
    ).toMatchObject({
      outcome: "COMPLETE",
      permissionMismatches: [
        expect.stringContaining("file.modify"),
      ],
    });
  });
});
