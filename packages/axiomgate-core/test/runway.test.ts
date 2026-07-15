import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkpointFromRun,
  detectLoopRecommendation,
  evaluateVerificationReserve,
  expiringResetReminder,
  readCapacitySnapshot,
  renderCapacitySnapshot,
  setCapacitySnapshot,
  parseCodexJsonl,
} from "../src/index.js";

describe("evaluateVerificationReserve", () => {
  it.each([
    [79, 100, false, "OK"],
    [80, 100, false, "OK"],
    [81, 100, false, "WARNING"],
    [100, 100, true, "OK"],
  ] as const)(
    "evaluates builder=%i total=%i verification=%s as %s",
    (builderTokens, totalTokens, hasVerificationRun, status) => {
      expect(
        evaluateVerificationReserve({
          builderTokens,
          totalTokens,
          reservePercent: 20,
          hasVerificationRun,
        }),
      ).toMatchObject({
        status,
        builderTokens,
        totalTokens,
        thresholdTokens: 80,
        thresholdPercent: 80,
      });
    },
  );
});

describe("rate-limit checkpoint", () => {
  it("detects usage-limit JSONL and captures a parseable reset time", () => {
    const parsed = parseCodexJsonl(
      readFileSync(join(import.meta.dirname, "fixtures", "rate-limit.jsonl"), "utf8"),
    );
    expect(
      checkpointFromRun({
        missionId: "msn_limit",
        parsed,
        commandStatus: "FAILED",
        stderr: "",
        model: "gpt-5.6-sol",
        effort: "high",
        now: () => new Date("2026-07-15T20:00:00.000Z"),
      }),
    ).toMatchObject({
      reason: "rate_limit",
      resetAt: "2026-07-16T03:30:00.000Z",
      sessionId: "rate-limited-session",
    });
  });

  it("records UNKNOWN reset time when limit wording has no timestamp", () => {
    expect(
      checkpointFromRun({
        missionId: "msn_limit_unknown",
        parsed: parseCodexJsonl(
          '{"type":"thread.started","thread_id":"limit-unknown"}',
        ),
        commandStatus: "FAILED",
        stderr: "usage limit reached; try again later",
        model: "gpt-5.6-sol",
        effort: "high",
        now: () => new Date("2026-07-15T20:00:00.000Z"),
      }),
    ).toMatchObject({
      reason: "rate_limit",
      resetAt: null,
    });
  });
});

describe("detectLoopRecommendation", () => {
  it("flags the same command and error signature failing three times", () => {
    expect(
      detectLoopRecommendation([
        {
          runId: "run_1",
          commandFailures: [{ command: "pnpm test", error: "exit 1: boom" }],
          fileChanges: 1,
          newEvidence: 0,
        },
        {
          runId: "run_2",
          commandFailures: [{ command: "pnpm test", error: "exit 1: boom" }],
          fileChanges: 1,
          newEvidence: 0,
        },
        {
          runId: "run_3",
          commandFailures: [{ command: "pnpm test", error: "exit 1: boom" }],
          fileChanges: 1,
          newEvidence: 0,
        },
      ]),
    ).toEqual({
      signal: "repeated_failure",
      evidence: [
        "command=pnpm test",
        "error=exit 1: boom",
        "occurrences=3",
      ],
      recommendation: "pause and diagnose",
    });
  });

  it("flags three consecutive runs with no file changes or new evidence", () => {
    expect(
      detectLoopRecommendation([
        { runId: "run_1", commandFailures: [], fileChanges: 0, newEvidence: 0 },
        { runId: "run_2", commandFailures: [], fileChanges: 0, newEvidence: 0 },
        { runId: "run_3", commandFailures: [], fileChanges: 0, newEvidence: 0 },
      ]),
    ).toEqual({
      signal: "no_progress",
      evidence: ["consecutiveRuns=3", "fileChanges=0", "newEvidence=0"],
      recommendation: "split task",
    });
  });

  it("does not flag healthy progress", () => {
    expect(
      detectLoopRecommendation([
        { runId: "run_1", commandFailures: [], fileChanges: 0, newEvidence: 0 },
        { runId: "run_2", commandFailures: [], fileChanges: 2, newEvidence: 1 },
        { runId: "run_3", commandFailures: [], fileChanges: 0, newEvidence: 0 },
      ]),
    ).toBeUndefined();
  });
});

describe("capacity snapshot", () => {
  it("round-trips manual source-labelled capacity without inventing fields", () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-runway-"));
    try {
      const snapshot = setCapacitySnapshot(
        projectPath,
        {
          plan: "plus",
          resetsAvailable: 1,
          resetExpires: "2026-07-30",
        },
        () => new Date("2026-07-15T20:00:00.000Z"),
      );

      expect(readCapacitySnapshot(projectPath)).toEqual(snapshot);
      expect(snapshot).toEqual({
        plan: {
          value: "plus",
          source: "manual",
          confidence: "HIGH",
          capturedAt: "2026-07-15T20:00:00.000Z",
        },
        resetsAvailable: {
          value: 1,
          source: "manual",
          confidence: "HIGH",
          capturedAt: "2026-07-15T20:00:00.000Z",
        },
        resetExpires: {
          value: "2026-07-30",
          source: "manual",
          confidence: "HIGH",
          capturedAt: "2026-07-15T20:00:00.000Z",
        },
      });
      expect(
        JSON.parse(
          readFileSync(join(projectPath, ".axiomgate", "runway.json"), "utf8"),
        ),
      ).toEqual(snapshot);
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it("renders absent capacity as UNKNOWN", () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-runway-unknown-"));
    try {
      expect(renderCapacitySnapshot(readCapacitySnapshot(projectPath))).toBe(
        "Runway: plan=UNKNOWN; resetsAvailable=UNKNOWN; resetExpires=UNKNOWN",
      );
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it.each([
    ["2026-07-18T17:00:00.000Z", true],
    ["2026-07-18T19:00:00.000Z", false],
  ] as const)("applies the 72-hour expiry window to %s", (expiry, expected) => {
    const capturedAt = "2026-07-15T18:00:00.000Z";
    const snapshot = {
      resetsAvailable: {
        value: 1,
        source: "manual" as const,
        confidence: "HIGH" as const,
        capturedAt,
      },
      resetExpires: {
        value: expiry,
        source: "manual" as const,
        confidence: "HIGH" as const,
        capturedAt,
      },
    };
    expect(
      expiringResetReminder(
        snapshot,
        new Date("2026-07-15T18:00:00.000Z"),
      ) !== undefined,
    ).toBe(expected);
  });
});
