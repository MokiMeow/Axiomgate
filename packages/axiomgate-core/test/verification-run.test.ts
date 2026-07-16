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
  createMission,
  missionDirectory,
  verifyMission,
  type CommandRunner,
  type IdentityReport,
} from "../src/index.js";

function verificationIdentity(capturedAt: string): IdentityReport {
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
      reason: "not needed",
      capturedAt,
    },
    vercelProject: {
      status: "UNAVAILABLE",
      source: ".vercel/project.json",
      reason: "not needed",
      capturedAt,
    },
  };
}

describe("verifyMission", () => {
  it("fans one shared command result out to every mapped criterion", () => {
    const workspace = mkdtempSync(join(tmpdir(), "axiomgate-verify-fanout-"));
    try {
      writeFileSync(
        join(workspace, "package.json"),
        JSON.stringify({ scripts: { test: "node --test" } }),
        "utf8",
      );
      const hookConfigOptions = {
        cliEntryPath: join(workspace, "cli", "index.js"),
        nodePath: process.execPath,
      };
      createMission(
        workspace,
        {
          objective: "Verify shared test evidence",
          criteria: [
            { id: "criterion_lockout", statement: "Lockout passes", evidenceTypes: ["test"] },
            { id: "criterion_regression", statement: "Regression passes", evidenceTypes: ["regression_test"] },
            { id: "criterion_secret", statement: "No secrets", evidenceTypes: ["secret_scan"] },
          ],
        },
        {
          id: "msn_verify_fanout",
          hookConfigOptions,
          resolveIdentity: () => verificationIdentity("2026-07-16T01:00:00.000Z"),
        },
      );
      const runner: CommandRunner = (command, args) => ({
        command,
        args,
        status: command === "gitleaks" ? "UNAVAILABLE" : "SUCCESS",
        exitCode: command === "gitleaks" ? 127 : 0,
        stdout: command === "git" ? "" : "passed",
        stderr: command === "gitleaks" ? "not installed" : "",
        durationMs: 1,
      });

      const result = verifyMission(workspace, "msn_verify_fanout", {
        hookConfigOptions,
        resolveIdentity: () => verificationIdentity("2026-07-16T01:01:00.000Z"),
        runner,
        currentCommit: () => "abc123",
      });
      const testEvidence = result.evidence.filter(
        (record) => record.command === "npm test",
      );
      expect(testEvidence.map((record) => record.criterionId).sort()).toEqual([
        "criterion_lockout",
        "criterion_regression",
      ]);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("persists typed results and never reports PASS while a required scan is UNKNOWN", () => {
    const workspace = mkdtempSync(join(tmpdir(), "axiomgate-verify-run-"));
    try {
      writeFileSync(
        join(workspace, "package.json"),
        JSON.stringify({ scripts: { test: "node --test", build: "node --check index.js" } }),
        "utf8",
      );
      const hookConfigOptions = {
        cliEntryPath: join(workspace, "cli", "index.js"),
        nodePath: process.execPath,
      };
      createMission(
        workspace,
        { objective: "Verify fixture" },
        {
          id: "msn_verify_run",
          hookConfigOptions,
          resolveIdentity: () =>
            verificationIdentity("2026-07-15T22:00:00.000Z"),
        },
      );
      const runner: CommandRunner = (command, args) => {
        const joined = [command, ...args].join(" ");
        if (command === "git" && args.includes("--name-only")) {
          return {
            command,
            args,
            status: "SUCCESS",
            exitCode: 0,
            stdout: "package.json\n",
            stderr: "",
            durationMs: 1,
          };
        }
        if (command === "git") {
          return {
            command,
            args,
            status: "SUCCESS",
            exitCode: 0,
            stdout: "diff --git a/package.json b/package.json\n",
            stderr: "",
            durationMs: 1,
          };
        }
        if (command === "gitleaks") {
          return {
            command,
            args,
            status: "UNAVAILABLE",
            exitCode: 127,
            stdout: "",
            stderr: "Executable not found: gitleaks",
            durationMs: 1,
          };
        }
        if (command === "npx") {
          return {
            command,
            args,
            status: "SUCCESS",
            exitCode: 0,
            stdout: "malformed",
            stderr: "",
            durationMs: 1,
          };
        }
        return {
          command,
          args,
          status: "SUCCESS",
          exitCode: 0,
          stdout: `${joined} passed`,
          stderr: "",
          durationMs: 1,
        };
      };

      const result = verifyMission(workspace, "msn_verify_run", {
        runId: "verify_fixture",
        hookConfigOptions,
        resolveIdentity: () =>
          verificationIdentity("2026-07-15T22:01:00.000Z"),
        runner,
        currentCommit: () => "abc123",
        now: () => new Date("2026-07-15T22:02:00.000Z"),
      });

      expect(result.run.overall).toBe("UNKNOWN");
      expect(
        result.run.checks.find((check) => check.kind === "dependency.scan"),
      ).toMatchObject({
        status: "UNKNOWN",
        reason: "PatchPilot output is not valid JSON",
      });
      expect(result.run.events.at(-1)).toMatchObject({
        type: "verification.completed",
        status: "UNKNOWN",
      });
      const missionDir = missionDirectory(workspace, "msn_verify_run");
      expect(
        JSON.parse(
          readFileSync(
            join(missionDir, "verification", "verify_fixture.json"),
            "utf8",
          ),
        ),
      ).toMatchObject({ id: "verify_fixture", overall: "UNKNOWN" });
      const eventLines = readFileSync(join(missionDir, "events.jsonl"), "utf8")
        .trim()
        .split(/\r?\n/u)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(eventLines.some((event) => event.type === "verification.completed")).toBe(true);
      expect(
        eventLines.filter((event) => event.source === "command").length,
      ).toBeGreaterThanOrEqual(4);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves default identity commands from the governed workspace", () => {
    const workspace = mkdtempSync(join(tmpdir(), "axiomgate-verify-identity-"));
    try {
      const capturedAt = "2026-07-15T22:10:00.000Z";
      const identity: IdentityReport = {
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
              url: "https://github.com/MokiMeow/fixture.git",
              direction: "fetch",
            },
            {
              name: "origin",
              url: "https://github.com/MokiMeow/fixture.git",
              direction: "push",
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
          reason: "not configured",
          capturedAt,
        },
      };
      writeFileSync(
        join(workspace, "package.json"),
        JSON.stringify({ scripts: { test: "node --test", build: "node --check index.js" } }),
        "utf8",
      );
      const hookConfigOptions = {
        cliEntryPath: join(workspace, "cli", "index.js"),
        nodePath: process.execPath,
      };
      createMission(
        workspace,
        { objective: "Verify identity cwd" },
        {
          id: "msn_verify_identity",
          hookConfigOptions,
          resolveIdentity: () => identity,
        },
      );
      const identityRunner: CommandRunner = (command, args, options) => {
        expect(options?.cwd).toBe(workspace);
        const stdout = command === "gh"
          ? '{"login":"MokiMeow"}'
          : command === "git"
            ? "origin\thttps://github.com/MokiMeow/fixture.git (fetch)\norigin\thttps://github.com/MokiMeow/fixture.git (push)\n"
            : "mokimeow\n";
        return { command, args, status: "SUCCESS", exitCode: 0, stdout, stderr: "", durationMs: 1 };
      };
      const runner: CommandRunner = (command, args) => ({
        command,
        args,
        status: "SUCCESS",
        exitCode: 0,
        stdout: command === "npx" ? '{"target":"fixture","scanner":"osv-api","count":0,"findings":[]}' : "",
        stderr: "",
        durationMs: 1,
      });

      expect(() =>
        verifyMission(workspace, "msn_verify_identity", {
          hookConfigOptions,
          identityRunner,
          runner,
          currentCommit: () => "abc123",
        }),
      ).not.toThrow();
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
