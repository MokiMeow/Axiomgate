import { describe, expect, it } from "vitest";

import {
  calculateVerificationOverall,
  compileMission,
  createVerificationRun,
  createVerificationPlan,
} from "../src/index.js";

describe("createVerificationPlan", () => {
  it("derives concrete checks from criteria evidence and changed files", () => {
    const contract = compileMission(
      { objective: "Update a vulnerable dependency" },
      { id: "msn_verify_plan" },
    ).contract;
    const plan = createVerificationPlan({
      contract,
      workspace: "C:/repo",
      diff: "diff --git a/package.json b/package.json",
      changedFiles: ["package.json", "src/index.ts"],
    });

    expect(plan.missionId).toBe("msn_verify_plan");
    expect(plan.checks.map((check) => check.kind)).toEqual([
      "git.diff",
      "target.build",
      "target.test",
      "dependency.scan",
      "secret.scan",
    ]);
    expect(
      plan.checks.find((check) => check.kind === "dependency.scan"),
    ).toMatchObject({
      required: true,
      criterionIds: ["criterion_security"],
      status: "UNKNOWN",
    });
    expect(
      plan.checks.find((check) => check.kind === "secret.scan"),
    ).toMatchObject({
      criterionIds: ["criterion_secrets"],
      status: "UNKNOWN",
    });
  });

  it("keeps unsupported required evidence UNKNOWN instead of claiming green", () => {
    const contract = compileMission(
      {
        objective: "Verify browser behavior",
        criteria: [
          {
            id: "criterion_browser",
            statement: "Browser flow works",
            risk: "high",
            evidenceTypes: ["browser"],
          },
          {
            id: "criterion_test",
            statement: "Tests pass",
            evidenceTypes: ["test"],
          },
          {
            id: "criterion_secret",
            statement: "No secrets",
            evidenceTypes: ["secret_scan"],
          },
        ],
      },
      { id: "msn_unknown_check" },
    ).contract;
    const plan = createVerificationPlan({
      contract,
      workspace: "C:/repo",
      diff: "",
      changedFiles: [],
    });

    expect(plan.checks).toContainEqual(
      expect.objectContaining({
        kind: "unsupported:browser",
        status: "UNKNOWN",
        required: true,
        criterionIds: ["criterion_browser"],
      }),
    );
    expect(calculateVerificationOverall(plan.checks)).toBe("UNKNOWN");
    expect(
      createVerificationRun(plan, "abc123", {
        id: "verify_fixture",
        now: () => new Date("2026-07-15T22:00:00.000Z"),
      }),
    ).toMatchObject({
      id: "verify_fixture",
      overall: "UNKNOWN",
      endedAt: null,
      findings: [],
    });
  });
});

describe("calculateVerificationOverall", () => {
  it.each([
    [["PASS", "PASS"], "PASS"],
    [["PASS", "UNKNOWN"], "UNKNOWN"],
    [["PASS", "SKIPPED"], "UNKNOWN"],
    [["PASS", "BLOCKED"], "BLOCKED"],
    [["PASS", "FAIL"], "FAIL"],
  ] as const)("maps required states %j to %s", (states, expected) => {
    expect(
      calculateVerificationOverall(
        states.map((status, index) => ({
          id: `check_${index}`,
          kind: "target.test" as const,
          criterionIds: ["criterion"],
          required: true,
          status,
        })),
      ),
    ).toBe(expected);
  });
});
