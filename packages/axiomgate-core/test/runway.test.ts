import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkpointFromRun,
  detectLoopRecommendation,
  evaluateRealCapacityReserve,
  evaluateVerificationReserve,
  expiringBankedResetReminder,
  expiringResetReminder,
  liveLimitSummary,
  readCapacitySnapshot,
  resolveRunwayCapacity,
  renderRunwayCapacity,
  renderCapacitySnapshot,
  setCapacitySnapshot,
  parseCodexJsonl,
} from "../src/index.js";

const LIVE_CAPACITY = {
  status: "AVAILABLE" as const,
  sources: [
    {
      limitId: "codex",
      windowLabel: "weekly",
      usedPercent: 62,
      resetsAt: "2026-07-22T13:55:33.000Z",
      planType: "pro",
      credits: { balance: "0", unlimited: false },
      bankedResets: [
        {
          id: "reset_1",
          resetType: "weekly",
          status: "available",
          grantedAt: "2026-07-15T00:00:00.000Z",
          expiresAt: "2026-07-18T17:00:00.000Z",
        },
      ],
      source: "codex-app-server" as const,
      confidence: "high" as const,
      capturedAt: "2026-07-16T00:00:00.000Z",
    },
  ],
  availableResetCount: 1,
  rateLimitReachedType: null,
};

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

describe("real capacity reserve", () => {
  it.each([
    [60, 19, "OK"],
    [60, 20, "OK"],
    [60, 21, "WARNING"],
  ] as const)(
    "evaluates used=%i projected=%i as %s against a 20% reserve",
    (usedPercent, projectedBuildPercent, status) => {
      expect(
        evaluateRealCapacityReserve({
          usedPercent,
          projectedBuildPercent,
          reservePercent: 20,
          hasVerificationRun: false,
        }),
      ).toMatchObject({
        status,
        usedPercent,
        projectedBuildPercent,
        projectedUsedPercent: usedPercent + projectedBuildPercent,
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
  it("prefers live Codex capacity and renders source-labelled windows", async () => {
    const capacity = await resolveRunwayCapacity(".", {
      readLive: async () => LIVE_CAPACITY,
    });
    expect(capacity.status).toBe("LIVE");
    expect(renderRunwayCapacity(capacity)).toContain(
      "codex | weekly | 62% | 2026-07-22T13:55:33.000Z | pro | codex-app-server/high",
    );
  });

  it("falls back to manual values when the app-server is unavailable", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "axiomgate-runway-fallback-"));
    try {
      setCapacitySnapshot(projectPath, { plan: "plus", resetsAvailable: 1 });
      const capacity = await resolveRunwayCapacity(projectPath, {
        readLive: async () => ({ status: "UNAVAILABLE", reason: "method error" }),
      });
      expect(capacity).toMatchObject({
        status: "MANUAL",
        liveUnavailableReason: "method error",
      });
      expect(renderRunwayCapacity(capacity)).toContain("manual fallback");
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });

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

  it.each([
    ["2026-07-18T17:00:00.000Z", true],
    ["2026-07-18T19:00:00.000Z", false],
  ] as const)("reminds for a real banked reset expiring at %s", (expiry, expected) => {
    const live = {
      ...LIVE_CAPACITY,
      sources: LIVE_CAPACITY.sources.map((source) => ({
        ...source,
        bankedResets: source.bankedResets.map((reset) => ({ ...reset, expiresAt: expiry })),
      })),
    };
    expect(
      expiringBankedResetReminder(
        { ...live, status: "LIVE" },
        new Date("2026-07-15T18:00:00.000Z"),
      ) !== undefined,
    ).toBe(expected);
  });

  it("reports a real reached limit with reset and banked-reset details", () => {
    const live = {
      ...LIVE_CAPACITY,
      status: "LIVE" as const,
      rateLimitReachedType: "weekly",
    };
    expect(liveLimitSummary(live)).toEqual({
      limited: true,
      resetsAt: "2026-07-22T13:55:33.000Z",
      availableResetCount: 1,
      rateLimitReachedType: "weekly",
    });
  });
});
