import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  compileMission,
  createMission,
  hashContract,
  loadMissionSnapshot,
  mapBoundaryToSandbox,
  missionDirectory,
  parseMissionCriteria,
  updateMission,
  ULTRA_CAPABILITY_NOTE,
  type IdentityReport,
} from "../src/index.js";

function fixtureIdentity(capturedAt: string): IdentityReport {
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
      value: [
        {
          name: "origin",
          url: "https://github.com/MokiMeow/AxiomGate.git",
          direction: "fetch",
        },
      ],
      source: "git remote -v",
      confidence: "HIGH",
      capturedAt,
    },
    vercelUser: {
      status: "RESOLVED",
      value: "mokimeow",
      source: "vercel whoami",
      confidence: "HIGH",
      capturedAt,
    },
    vercelProject: {
      status: "UNAVAILABLE",
      source: ".vercel/project.json",
      reason: "fixture has no linked project",
      capturedAt,
    },
  };
}

describe("compileMission", () => {
  it("compiles one objective into the safe default mission contract", () => {
    const result = compileMission(
      { objective: "Add request validation to the profile endpoint" },
      {
        id: "msn_defaults",
        now: () => new Date("2026-07-15T16:00:00.000Z"),
      },
    );

    expect(result.conflicts).toEqual([]);
    expect(result.contract).toMatchObject({
      id: "msn_defaults",
      version: 1,
      objective: "Add request validation to the profile endpoint",
      projectProfileId: "local-project",
      intentBoundary: "MODIFY_LOCAL",
      status: "DRAFT",
      createdAt: "2026-07-15T16:00:00.000Z",
      updatedAt: "2026-07-15T16:00:00.000Z",
    });
    expect(result.contract.budgetPolicy).toEqual({ reservePercent: 20 });
    expect(result.contract.acceptanceCriteria).toHaveLength(4);
    expect(
      result.contract.acceptanceCriteria.map((criterion) => criterion.evidenceTypes),
    ).toEqual([
      ["diff", "command"],
      ["test"],
      ["security_scan"],
      ["secret_scan"],
    ]);
    expect(result.contract.actionPolicy).toEqual([
      { action: "repository.read", decision: "ALLOW" },
      { action: "file.modify", decision: "ALLOW" },
      {
        action: "branch.create",
        decision: "ALLOW",
        restrict: { branchPrefix: "agent/" },
      },
      { action: "pull_request.create", decision: "REQUIRE_APPROVAL" },
      { action: "preview.deploy", decision: "REQUIRE_APPROVAL" },
      { action: "production.deploy", decision: "DENY" },
      { action: "verification.run", decision: "ALLOW" },
    ]);
    expect(result.contract.modelPlan).toEqual([
      {
        phase: "scout",
        model: "gpt-5.6-luna",
        effort: "light",
        rationale: "lightweight structured mapping",
      },
      {
        phase: "build",
        model: "gpt-5.6-sol",
        effort: "high",
        rationale: "primary implementation at High",
        multiAgent: false,
        capabilityNote: ULTRA_CAPABILITY_NOTE,
      },
      {
        phase: "remediate",
        model: "gpt-5.6-terra",
        effort: "medium",
        rationale: "bounded fixes at balanced Medium",
      },
      {
        phase: "verify",
        model: "gpt-5.6-terra",
        effort: "high",
        rationale:
          "independent challenge at High; a different tier than the builder reduces correlated blind spots",
      },
    ]);
    expect(result.contract.hash).toBe(hashContract(result.contract));
  });

  it("uses the three-to-six acceptance criteria supplied by a criteria file", () => {
    const result = compileMission(
      {
        objective: "Add profile validation",
        criteria: parseMissionCriteria(
          JSON.parse(
            readFileSync(
              join(import.meta.dirname, "fixtures", "mission-criteria.json"),
              "utf8",
            ),
          ),
        ),
      },
      { id: "msn_criteria" },
    );

    expect(result.contract.acceptanceCriteria).toEqual([
      {
        id: "criterion_1",
        statement: "Invalid profile input is rejected",
        evidenceTypes: ["integration_test"],
        risk: "high",
        verdict: "UNVERIFIED",
        evidenceIds: [],
      },
      {
        id: "criterion_2",
        statement: "Valid profile input remains accepted",
        evidenceTypes: ["regression_test"],
        risk: "medium",
        verdict: "UNVERIFIED",
        evidenceIds: [],
      },
      {
        id: "criterion_audit",
        statement: "Validation failures are observable",
        evidenceTypes: ["command"],
        risk: "medium",
        verdict: "UNVERIFIED",
        evidenceIds: [],
      },
    ]);
  });

  it("surfaces a production-policy conflict without loosening the denial", () => {
    const result = compileMission(
      { objective: "Deploy the service to production" },
      { id: "msn_conflict" },
    );

    expect(result.conflicts).toEqual([
      {
        status: "CONFLICT",
        action: "production.deploy",
        reason:
          "Objective requests production deployment, which the Build Week policy denies",
        requiresUserEdit: true,
      },
    ]);
    expect(result.contract.acceptanceCriteria[0]).toMatchObject({
      verdict: "BLOCKED",
      statement:
        "CONFLICT: Deploy the service to production requires an explicit user edit because production.deploy is denied",
    });
    expect(
      result.contract.actionPolicy.find(
        (entry) => entry.action === "production.deploy",
      )?.decision,
    ).toBe("DENY");
  });

  it.each([
    ["high", "medium", "primary implementation at High"],
    [
      "max",
      "high",
      "single unbroken reasoning chain at Max for the hardest security-sensitive step",
    ],
    [
      "max",
      "critical",
      "single unbroken reasoning chain at Max for the hardest security-sensitive step",
    ],
  ] as const)(
    "selects sol/%s reasoning from %s mission risk",
    (effort, risk, rationale) => {
      const result = compileMission(
        {
          objective: "Harden authentication checks",
          criteria: [
            { statement: "Primary risk", risk, evidenceTypes: ["test"] },
            { statement: "Regression safety", risk: "medium", evidenceTypes: ["test"] },
            { statement: "Secret safety", risk: "medium", evidenceTypes: ["secret_scan"] },
          ],
        },
        { id: `msn_risk_${risk}` },
      );
      expect(result.contract.modelPlan.find((entry) => entry.phase === "build")).toEqual({
        phase: "build",
        model: "gpt-5.6-sol",
        effort,
        rationale,
        multiAgent: false,
        capabilityNote: ULTRA_CAPABILITY_NOTE,
      });
    },
  );
});

describe("mapBoundaryToSandbox", () => {
  it.each([
    ["OBSERVE", "read-only", false],
    ["PLAN", "read-only", false],
    ["MODIFY_LOCAL", "workspace-write", false],
    ["PUBLISH", "workspace-write", true],
    ["DEPLOY_PREVIEW", "workspace-write", true],
  ] as const)(
    "maps %s to %s with network=%s",
    (boundary, sandbox, networkAccess) => {
      expect(mapBoundaryToSandbox(boundary)).toMatchObject({
        status: "READY",
        sandbox,
        networkAccess,
      });
    },
  );

  it("refuses DEPLOY_PRODUCTION during Build Week", () => {
    expect(mapBoundaryToSandbox("DEPLOY_PRODUCTION")).toEqual({
      status: "REFUSED",
      reason: "DEPLOY_PRODUCTION is prohibited during Build Week",
    });
  });
});

describe("mission files", () => {
  it("creates a hook snapshot and regenerates it after an edited contract update", () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-mission-"));
    try {
      const hookConfigOptions = {
        cliEntryPath: join(projectPath, "cli", "index.js"),
        nodePath: process.execPath,
      };
      const created = createMission(
        projectPath,
        { objective: "Add profile validation" },
        {
          id: "msn_update",
          now: () => new Date("2026-07-15T16:00:00.000Z"),
          hookConfigOptions,
          resolveIdentity: () =>
            fixtureIdentity("2026-07-15T16:00:00.000Z"),
        },
      );
      const directory = missionDirectory(projectPath, "msn_update");
      expect(created.missionDir).toBe(directory);
      expect(created.contract.version).toBe(1);
      expect(loadMissionSnapshot(directory).status).toBe("VALID");

      const contractPath = join(directory, "contract.json");
      const edited = JSON.parse(readFileSync(contractPath, "utf8")) as Record<
        string,
        unknown
      >;
      edited.objective = "Add strict profile validation";
      delete edited.budgetPolicy;
      edited.modelPlan = (edited.modelPlan as Array<Record<string, unknown>>).filter(
        (entry) => entry.phase !== "verify",
      );
      (edited.modelPlan as Array<Record<string, unknown>>)[0]!.effort = "none";
      (edited.modelPlan as Array<Record<string, unknown>>)[1]!.effort = "low";
      writeFileSync(contractPath, `${JSON.stringify(edited, null, 2)}\n`, "utf8");

      const updated = updateMission(projectPath, "msn_update", {
        now: () => new Date("2026-07-15T17:00:00.000Z"),
        hookConfigOptions,
        resolveIdentity: () =>
          fixtureIdentity("2026-07-15T17:00:00.000Z"),
      });
      expect(updated.contract).toMatchObject({
        version: 2,
        objective: "Add strict profile validation",
        updatedAt: "2026-07-15T17:00:00.000Z",
      });
      expect(updated.contract.hash).toBe(hashContract(updated.contract));
      expect(updated.contract.budgetPolicy).toEqual({ reservePercent: 20 });
      expect(updated.contract.modelPlan[0]?.effort).toBe("light");
      expect(updated.contract.modelPlan[1]?.effort).toBe("light");
      expect(updated.contract.modelPlan).toContainEqual({
        phase: "verify",
        model: "gpt-5.6-terra",
        effort: "high",
        rationale:
          "independent challenge at High; a different tier than the builder reduces correlated blind spots",
      });
      const snapshot = loadMissionSnapshot(directory);
      expect(snapshot.status).toBe("VALID");
      if (snapshot.status === "VALID") {
        expect(snapshot.snapshot.contract).toEqual(updated.contract);
        expect(snapshot.snapshot.identity.githubLogin.capturedAt).toBe(
          "2026-07-15T17:00:00.000Z",
        );
      }
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });
});
