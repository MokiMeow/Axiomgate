import { describe, expect, it } from "vitest";

import {
  ActionRequestSchema,
  evaluatePolicy,
  type IdentityReport,
  type MissionContract,
} from "../src/index.js";

const HASH = `sha256:${"c".repeat(64)}`;
const CAPTURED_AT = "2026-07-15T13:00:00.000Z";

function identityReport(
  githubLogin = "mokimeow",
  vercelUser = "mokimeow",
): IdentityReport {
  return {
    githubLogin: {
      status: "RESOLVED",
      value: githubLogin,
      source: "gh api user",
      confidence: "HIGH",
      capturedAt: CAPTURED_AT,
    },
    gitRemotes: {
      status: "RESOLVED",
      value: [
        {
          name: "origin",
          url: "https://github.com/mokimeow/AxiomGate.git",
          direction: "fetch",
        },
      ],
      source: "git remote -v",
      confidence: "HIGH",
      capturedAt: CAPTURED_AT,
    },
    vercelUser: {
      status: "RESOLVED",
      value: vercelUser,
      source: "vercel whoami",
      confidence: "HIGH",
      capturedAt: CAPTURED_AT,
    },
    vercelProject: {
      status: "RESOLVED",
      value: {
        projectId: "prj_axiomgate",
        orgId: "team_fixture_owner",
        projectName: "axiomgate-preview",
      },
      source: ".vercel/project.json",
      confidence: "HIGH",
      capturedAt: CAPTURED_AT,
    },
  };
}

function request(overrides: Record<string, unknown> = {}) {
  const base = {
    id: "act_policy",
    missionId: "msn_guard",
    semanticAction: "branch.create",
    mechanism: "git_cli",
    target: {
      type: "github_repo",
      owner: "mokimeow",
      repo: "AxiomGate",
      verifiedOwnership: true,
      branch: "agent/guard-policy",
      project: "axiomgate-preview",
    },
    identity: {
      githubLogin: "mokimeow",
      vercelUser: "mokimeow",
      source: "resolved identity report",
    },
    rawCommandHash: HASH,
    intentBoundaryRequired: "MODIFY_LOCAL",
    risk: "medium",
    rollback: "delete branch",
    decision: "ALLOW",
    requestedAt: "2026-07-15T13:00:00.000Z",
    expiresAt: "2026-07-15T13:15:00.000Z",
  };

  return ActionRequestSchema.parse({ ...base, ...overrides });
}

function policy(
  decision: MissionContract["actionPolicy"][number]["decision"] = "ALLOW",
  restrict?: Readonly<Record<string, unknown>>,
): MissionContract["actionPolicy"] {
  return [
    {
      action: "branch.create",
      decision,
      ...(restrict === undefined ? {} : { restrict }),
    },
  ];
}

function evaluate(
  actionPolicy: MissionContract["actionPolicy"],
  overrides: Parameters<typeof request>[0] = {},
  identity = identityReport(),
  missionBoundary: Parameters<typeof evaluatePolicy>[0]["missionBoundary"] =
    "MODIFY_LOCAL",
) {
  return evaluatePolicy({
    policy: actionPolicy,
    missionBoundary,
    request: request(overrides),
    identity,
  });
}

describe("evaluatePolicy", () => {
  it("denies an unlisted action by default", () => {
    const result = evaluate([], { semanticAction: "repository.read" });
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("deny-by-default");
  });

  it("denies an out-of-scope action even when policy says allow", () => {
    const result = evaluate(
      [{ action: "database.migrate", decision: "ALLOW" }],
      { semanticAction: "database.migrate" },
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("outside the supported demo action set");
  });

  it("denies an intent-boundary escalation", () => {
    const result = evaluate(
      policy(),
      { intentBoundaryRequired: "PUBLISH" },
      identityReport(),
      "MODIFY_LOCAL",
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("above mission boundary");
  });

  it("lets explicit deny win over an allow entry", () => {
    const result = evaluate([
      { action: "branch.create", decision: "ALLOW" },
      { action: "branch.create", decision: "DENY" },
    ]);
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("explicitly denies");
  });

  it("allows a branch under the required prefix", () => {
    expect(evaluate(policy("ALLOW", { branchPrefix: "agent/" })).decision).toBe(
      "ALLOW",
    );
  });

  it("denies a branch outside the required prefix", () => {
    const result = evaluate(
      policy("ALLOW", { branchPrefix: "agent/" }),
      { target: { ...request().target, branch: "main" } },
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("does not start");
  });

  it("denies a branch restriction when the request omits the branch", () => {
    const { branch: _branch, ...target } = request().target;
    const result = evaluate(policy("ALLOW", { branchPrefix: "agent/" }), {
      target,
    });
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("did not provide a branch");
  });

  it("allows the required GitHub repository", () => {
    expect(
      evaluate(policy("ALLOW", { githubRepo: "mokimeow/AxiomGate" }))
        .decision,
    ).toBe("ALLOW");
  });

  it("denies the wrong GitHub repository", () => {
    const result = evaluate(
      policy("ALLOW", { githubRepo: "mokimeow/AxiomGate" }),
      { target: { ...request().target, repo: "other" } },
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("does not match required repository");
  });

  it("allows the required GitHub identity", () => {
    expect(
      evaluate(policy("ALLOW", { githubLogin: "mokimeow" })).decision,
    ).toBe("ALLOW");
  });

  it("denies a wrong GitHub identity", () => {
    const result = evaluate(
      policy("ALLOW", { githubLogin: "mokimeow" }),
      {},
      identityReport("someone-else"),
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("does not match required login");
  });

  it("denies when the request identity differs from the resolved identity", () => {
    const result = evaluate(
      policy("ALLOW", { githubLogin: "mokimeow" }),
      {
        identity: {
          ...request().identity,
          githubLogin: "someone-else",
        },
      },
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("does not match required login");
  });

  it("denies when the required GitHub identity is unavailable", () => {
    const identity: IdentityReport = {
      ...identityReport(),
      githubLogin: {
        status: "UNAVAILABLE",
        source: "gh api user",
        reason: "not logged in",
        capturedAt: CAPTURED_AT,
      },
    };
    const result = evaluate(
      policy("ALLOW", { githubLogin: "mokimeow" }),
      {},
      identity,
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("identity is unavailable");
  });

  it("allows the required Vercel project and identity", () => {
    const result = evaluate(
      policy("ALLOW", {
        vercelProject: "axiomgate-preview",
        vercelUser: "mokimeow",
      }),
    );
    expect(result.decision).toBe("ALLOW");
  });

  it("denies the wrong Vercel project", () => {
    const result = evaluate(
      policy("ALLOW", { vercelProject: "expected-preview" }),
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("does not match required project");
  });

  it("denies a wrong Vercel identity", () => {
    const result = evaluate(
      policy("ALLOW", { vercelUser: "mokimeow" }),
      {},
      identityReport("mokimeow", "someone-else"),
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("does not match required user");
  });

  it("passes through REQUIRE_APPROVAL after restrictions pass", () => {
    const result = evaluate(
      policy("REQUIRE_APPROVAL", { githubLogin: "mokimeow" }),
    );
    expect(result.decision).toBe("REQUIRE_APPROVAL");
    expect(result.reasons[0]).toContain("requires approval");
  });

  it("allows a listed action when every check passes", () => {
    const result = evaluate(policy());
    expect(result.decision).toBe("ALLOW");
    expect(result.reasons[0]).toContain("all restrictions passed");
  });

  it("denies unknown restriction keys", () => {
    const result = evaluate(policy("ALLOW", { arbitraryScope: "all" }));
    expect(result.decision).toBe("DENY");
    expect(result.reasons[0]).toContain("fails closed");
  });

  it("denies UNKNOWN or UNAVAILABLE policy decisions", () => {
    expect(evaluate(policy("UNKNOWN")).decision).toBe("DENY");
    expect(evaluate(policy("UNAVAILABLE")).decision).toBe("DENY");
  });
});
