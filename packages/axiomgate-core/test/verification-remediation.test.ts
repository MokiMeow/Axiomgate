import { describe, expect, it } from "vitest";

import {
  affectedCheckKinds,
  buildRemediationPlan,
  compileMission,
  evidenceFreshness,
  freshEvidenceOnly,
  type Evidence,
  type VerificationFinding,
} from "../src/index.js";

const finding: VerificationFinding = {
  id: "finding_lodash",
  checkId: "check_dependency_scan",
  criterionIds: ["criterion_3"],
  title: "lodash@4.17.11: GHSA-test",
  detail: "reachable high severity dependency finding",
  severity: "high",
  status: "validated",
  advisory: "GHSA-test",
  ecosystem: "npm",
  package: "lodash",
  version: "4.17.11",
  fixedVersion: "4.17.21",
  reachability: "reachable",
};

describe("remediation planning", () => {
  it("constructs a governed, finding-scoped terra/medium remediation plan", () => {
    const contract = compileMission({ objective: "Secure the fixture" }, {
      id: "msn_remediate",
      now: () => new Date("2026-07-15T23:00:00.000Z"),
    }).contract;

    const plan = buildRemediationPlan(contract, finding);

    expect(plan).toMatchObject({
      missionId: "msn_remediate",
      boundary: "MODIFY_LOCAL",
      model: "gpt-5.6-terra",
      effort: "medium",
      checkKinds: ["dependency.scan", "target.test", "target.build"],
    });
    expect(plan.prompt).toContain("finding_lodash");
    expect(plan.prompt).toContain("lodash@4.17.11");
    expect(plan.prompt).toContain("Do not address unrelated findings");
    expect(plan.prompt).not.toContain("production deploy");
  });

  it("reruns only checks affected by each finding family", () => {
    expect(affectedCheckKinds(finding)).toEqual([
      "dependency.scan",
      "target.test",
      "target.build",
    ]);
    expect(
      affectedCheckKinds({ ...finding, checkId: "check_secret_scan" }),
    ).toEqual(["secret.scan"]);
  });

  it("rejects candidate findings before a remediation run can launch", () => {
    const contract = compileMission({ objective: "Secure the fixture" }).contract;
    expect(() =>
      buildRemediationPlan(contract, { ...finding, status: "candidate" }),
    ).toThrow(/validated/u);
  });
});

describe("evidence freshness", () => {
  const evidence: Evidence = {
    id: "evd_test",
    missionId: "msn_test",
    criterionId: "criterion_3",
    source: "command",
    command: "npm test",
    exitCode: 0,
    outputHash:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    outputRef: ".axiomgate/output.log",
    capturedAt: "2026-07-15T23:00:00.000Z",
    freshForCommit: "abc123",
    label: "LIVE",
    redacted: true,
  };

  it("marks mismatched revisions STALE and excludes them", () => {
    expect(evidenceFreshness(evidence, "def456")).toBe("STALE");
    expect(freshEvidenceOnly([evidence], "def456")).toEqual([]);
  });

  it("keeps evidence generated for the current revision", () => {
    expect(evidenceFreshness(evidence, "abc123")).toBe("FRESH");
    expect(freshEvidenceOnly([evidence], "abc123")).toEqual([evidence]);
  });
});
