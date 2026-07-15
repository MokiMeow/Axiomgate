import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  parseGithubLogin,
  parseGitRemotes,
  parseVercelProjectInspect,
  parseVercelProjectJson,
  parseVercelWhoami,
  resolveIdentity,
  verifyDeployTarget,
  type CommandResult,
  type CommandRunner,
} from "../src/index.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name: string): string =>
  readFileSync(join(fixtures, name), "utf8");

function commandResult(
  status: CommandResult["status"],
  stdout = "",
  stderr = "",
): CommandResult {
  return {
    command: "fixture",
    args: [],
    status,
    exitCode:
      status === "SUCCESS"
        ? 0
        : status === "UNAVAILABLE"
          ? 127
          : status === "TIMED_OUT"
            ? 124
            : 1,
    stdout,
    stderr,
    durationMs: 1,
  };
}

describe("identity fixture parsers", () => {
  it("parses a GitHub API user", () => {
    expect(parseGithubLogin(fixture("gh-user.json"))).toEqual({
      ok: true,
      value: "mokimeow",
    });
  });

  it("rejects malformed and empty GitHub output", () => {
    expect(parseGithubLogin(fixture("gh-user-malformed.txt")).ok).toBe(false);
    expect(parseGithubLogin(fixture("empty.txt")).ok).toBe(false);
  });

  it("parses git remote -v output", () => {
    const parsed = parseGitRemotes(fixture("git-remotes.txt"));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toHaveLength(2);
      expect(parsed.value[0]).toEqual({
        name: "origin",
        url: "https://github.com/mokimeow/AxiomGate.git",
        direction: "fetch",
      });
    }
  });

  it("rejects malformed and empty git remote output", () => {
    expect(parseGitRemotes(fixture("git-remotes-malformed.txt")).ok).toBe(
      false,
    );
    expect(parseGitRemotes(fixture("empty.txt")).ok).toBe(false);
  });

  it("parses a linked Vercel project", () => {
    expect(parseVercelProjectJson(fixture("vercel-project.json"))).toEqual({
      ok: true,
      value: {
        projectId: "prj_axiomgate",
        orgId: "team_mokimeow",
        projectName: "axiomgate-preview",
      },
    });
  });

  it("rejects malformed and empty Vercel project files", () => {
    expect(
      parseVercelProjectJson(fixture("vercel-project-malformed.json")).ok,
    ).toBe(false);
    expect(parseVercelProjectJson(fixture("empty.txt")).ok).toBe(false);
  });

  it("parses Vercel whoami output and rejects empty output", () => {
    expect(parseVercelWhoami(fixture("vercel-whoami.txt"))).toEqual({
      ok: true,
      value: "mokimeow",
    });
    expect(parseVercelWhoami(fixture("empty.txt")).ok).toBe(false);
  });

  it("parses current Vercel project inspect text output", () => {
    expect(
      parseVercelProjectInspect(fixture("vercel-project-inspect.txt")),
    ).toEqual({
      ok: true,
      value: { id: "prj_axiomgate", name: "axiomgate-preview" },
    });
  });
});

describe("resolveIdentity", () => {
  it("resolves all identity fields from injected command fixtures", () => {
    const runner: CommandRunner = (command) => {
      if (command === "gh") {
        return commandResult("SUCCESS", fixture("gh-user.json"));
      }
      if (command === "git") {
        return commandResult("SUCCESS", fixture("git-remotes.txt"));
      }
      return commandResult("SUCCESS", fixture("vercel-whoami.txt"));
    };

    const report = resolveIdentity({
      cwd: "C:/fixture",
      runner,
      now: () => new Date("2026-07-15T12:00:00.000Z"),
      readTextFile: () => fixture("vercel-project.json"),
    });

    expect(report.githubLogin.status).toBe("RESOLVED");
    expect(report.gitRemotes.status).toBe("RESOLVED");
    expect(report.vercelUser.status).toBe("RESOLVED");
    expect(report.vercelProject.status).toBe("RESOLVED");
    expect(report.githubLogin).toMatchObject({
      value: "mokimeow",
      source: "gh api user",
      confidence: "HIGH",
      capturedAt: "2026-07-15T12:00:00.000Z",
    });
  });

  it("degrades unavailable tools and files without throwing", () => {
    const report = resolveIdentity({
      runner: () => commandResult("UNAVAILABLE"),
      readTextFile: () => {
        throw new Error("fixture file missing");
      },
    });

    expect(report.githubLogin.status).toBe("UNAVAILABLE");
    expect(report.gitRemotes.status).toBe("UNAVAILABLE");
    expect(report.vercelUser.status).toBe("UNAVAILABLE");
    expect(report.vercelProject).toMatchObject({
      status: "UNAVAILABLE",
      reason: "fixture file missing",
    });
  });
});

const context = {
  missionId: "msn_guard",
  criterionId: "ac_target",
  freshForCommit: "abc123",
  label: "REPLAY",
} as const;

function verificationOptions(result: CommandResult, projectJson?: string) {
  return {
    runner: (() => result) satisfies CommandRunner,
    now: () => new Date("2026-07-15T12:00:00.000Z"),
    createEvidenceId: () => "ev_fixture",
    writeEvidence: () => undefined,
    readTextFile: () => projectJson ?? fixture("vercel-project.json"),
  };
}

describe("verifyDeployTarget", () => {
  it("verifies an owned GitHub repository and hashes its raw evidence", () => {
    const output = fixture("github-repo-owned.json");
    const result = verifyDeployTarget(
      {
        type: "github_repo",
        owner: "mokimeow",
        repo: "AxiomGate",
        expectedOwner: "mokimeow",
      },
      context,
      verificationOptions(commandResult("SUCCESS", output)),
    );

    expect(result.verdict).toBe("VERIFIED_OWNED");
    expect(result.evidence).toMatchObject({ source: "api", exitCode: 0 });
    expect(result.evidence?.outputHash).toBe(
      `sha256:${createHash("sha256").update(output).digest("hex")}`,
    );
  });

  it("rejects a GitHub repository owned by another account", () => {
    const result = verifyDeployTarget(
      {
        type: "github_repo",
        owner: "someone-else",
        repo: "AxiomGate",
        expectedOwner: "mokimeow",
      },
      context,
      verificationOptions(
        commandResult("SUCCESS", fixture("github-repo-not-owned.json")),
      ),
    );
    expect(result.verdict).toBe("EXISTS_NOT_OWNED");
  });

  it("reports a GitHub 404 as not found", () => {
    const result = verifyDeployTarget(
      {
        type: "github_repo",
        owner: "mokimeow",
        repo: "missing",
        expectedOwner: "mokimeow",
      },
      context,
      verificationOptions(
        commandResult("FAILED", "", fixture("github-404.txt")),
      ),
    );
    expect(result.verdict).toBe("NOT_FOUND");
  });

  it("reports an unavailable GitHub CLI without throwing", () => {
    const result = verifyDeployTarget(
      {
        type: "github_repo",
        owner: "mokimeow",
        repo: "AxiomGate",
        expectedOwner: "mokimeow",
      },
      context,
      verificationOptions(commandResult("UNAVAILABLE")),
    );
    expect(result.verdict).toBe("UNAVAILABLE");
    expect(result.evidence?.exitCode).toBe(127);
  });

  it("verifies a linked Vercel project in the expected account", () => {
    const result = verifyDeployTarget(
      {
        type: "vercel_project",
        project: "axiomgate-preview",
        expectedAccount: "team_mokimeow",
      },
      context,
      verificationOptions(
        commandResult("SUCCESS", fixture("vercel-project-inspect.txt")),
      ),
    );
    expect(result.verdict).toBe("VERIFIED_OWNED");
    expect(result.evidence?.source).toBe("command");
  });

  it("rejects a Vercel project linked to another account", () => {
    const result = verifyDeployTarget(
      {
        type: "vercel_project",
        project: "axiomgate-preview",
        expectedAccount: "team_other",
      },
      context,
      verificationOptions(
        commandResult("SUCCESS", fixture("vercel-project-inspect.txt")),
      ),
    );
    expect(result.verdict).toBe("EXISTS_NOT_OWNED");
  });

  it("reports a missing Vercel project", () => {
    const result = verifyDeployTarget(
      {
        type: "vercel_project",
        project: "missing",
        expectedAccount: "team_mokimeow",
      },
      context,
      verificationOptions(
        commandResult("FAILED", "", fixture("vercel-404.txt")),
      ),
    );
    expect(result.verdict).toBe("NOT_FOUND");
  });

  it("reports an unavailable Vercel CLI without throwing", () => {
    const result = verifyDeployTarget(
      {
        type: "vercel_project",
        project: "axiomgate-preview",
        expectedAccount: "team_mokimeow",
      },
      context,
      verificationOptions(commandResult("UNAVAILABLE")),
    );
    expect(result.verdict).toBe("UNAVAILABLE");
  });
});

const liveIt = process.env.AXIOM_LIVE_SMOKE === "1" ? it : it.skip;

liveIt("resolves the current local identity without throwing", () => {
  const report = resolveIdentity();
  expect(report.githubLogin).toBeDefined();
  expect(report.gitRemotes).toBeDefined();
  expect(report.vercelUser).toBeDefined();
  expect(report.vercelProject).toBeDefined();
});
