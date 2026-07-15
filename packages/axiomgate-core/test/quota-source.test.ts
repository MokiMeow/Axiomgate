import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseCodexRateLimits,
  readCodexRateLimits,
  windowLabel,
} from "../src/index.js";

describe("Codex quota source", () => {
  it("parses every real app-server limit window without inventing message counts", () => {
    const parsed = parseCodexRateLimits(
      readFileSync(
        join(import.meta.dirname, "fixtures", "codex-rate-limits.json"),
        "utf8",
      ),
      () => new Date("2026-07-16T00:00:00.000Z"),
    );

    expect(parsed.status).toBe("AVAILABLE");
    if (parsed.status !== "AVAILABLE") return;
    expect(parsed.sources).toEqual([
      {
        limitId: "codex",
        windowLabel: "weekly",
        usedPercent: 3,
        resetsAt: "2026-07-22T13:55:33.000Z",
        planType: "pro",
        credits: { balance: "0", unlimited: false },
        bankedResets: [
          {
            id: "reset_1",
            resetType: "weekly",
            status: "available",
            grantedAt: "2026-07-15T00:00:00.000Z",
            expiresAt: "2026-07-18T00:00:00.000Z",
          },
        ],
        source: "codex-app-server",
        confidence: "high",
        capturedAt: "2026-07-16T00:00:00.000Z",
      },
      expect.objectContaining({
        limitId: "codex_bengalfox",
        windowLabel: "weekly",
        usedPercent: 0,
      }),
      expect.objectContaining({
        limitId: "codex_bengalfox",
        windowLabel: "5-hour",
        usedPercent: 4,
        resetsAt: "2026-07-16T02:00:00.000Z",
      }),
    ]);
    for (const source of parsed.sources) {
      expect(source).not.toHaveProperty("messageCount");
      expect(source).not.toHaveProperty("messagesRemaining");
    }
  });

  it.each([
    [300, "5-hour"],
    [10080, "weekly"],
    [720, "720min"],
  ] as const)("labels a %i minute window as %s", (minutes, label) => {
    expect(windowLabel(minutes)).toBe(label);
  });

  it("returns UNAVAILABLE for malformed app-server output", () => {
    expect(parseCodexRateLimits("not-json")).toEqual({
      status: "UNAVAILABLE",
      reason: "Codex app-server returned no valid rate-limit response",
    });
  });

  it("uses the staged app-server handshake and degrades command failure", async () => {
    const result = await readCodexRateLimits({
      cacheTtlMs: 0,
      runner: async (command, args, options) => {
        expect(command).toBe("codex");
        expect(args).toEqual(["app-server"]);
        expect(options?.writes.map((write) => JSON.parse(write.data))).toEqual([
          expect.objectContaining({ method: "initialize", id: 0 }),
          { method: "initialized", params: {} },
          { method: "account/rateLimits/read", id: 1, params: {} },
        ]);
        return {
          command,
          args,
          status: "UNAVAILABLE",
          exitCode: 127,
          stdout: "",
          stderr: "Executable not found: codex",
          durationMs: 1,
        };
      },
    });

    expect(result).toEqual({
      status: "UNAVAILABLE",
      reason: "Codex app-server unavailable: Executable not found: codex",
    });
  });
});
