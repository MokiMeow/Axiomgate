import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  compileMission,
  ReasoningEffortSchema,
  renderModelDirectorVocabulary,
  toCodexReasoningEffort,
  toDisplayReasoningEffort,
  ULTRA_CAPABILITY_NOTE,
  type ReasoningEffort,
} from "../src/index.js";

interface WireFixture {
  readonly codexVersion: string;
  readonly results: ReadonlyArray<{
    readonly value: string;
    readonly accepted: boolean;
    readonly exitCode: number;
  }>;
}

describe("Model Director effort vocabulary", () => {
  it("records the empirically accepted codex-cli 0.144.4 wire values", () => {
    const fixture = JSON.parse(
      readFileSync(
        join(
          import.meta.dirname,
          "fixtures",
          "codex-effort-wire-0.144.4.json",
        ),
        "utf8",
      ),
    ) as WireFixture;

    expect(fixture.codexVersion).toBe("0.144.4");
    expect(
      fixture.results.filter((result) => result.accepted).map((result) => result.value),
    ).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(fixture.results.find((result) => result.value === "light")).toEqual(
      expect.objectContaining({ accepted: false, exitCode: 1 }),
    );
  });

  it.each([
    ["light", "low"],
    ["medium", "medium"],
    ["high", "high"],
    ["xhigh", "xhigh"],
    ["max", "max"],
  ] as const)("maps display effort %s to CLI wire effort %s", (display, wire) => {
    expect(ReasoningEffortSchema.parse(display)).toBe(display);
    expect(toCodexReasoningEffort(display)).toBe(wire);
  });

  it.each([
    ["none", "light"],
    ["minimal", "light"],
    ["low", "light"],
    ["medium", "medium"],
    ["high", "high"],
    ["xhigh", "xhigh"],
    ["max", "max"],
  ] as const)("normalizes persisted effort %s to display effort %s", (stored, display) => {
    expect(toDisplayReasoningEffort(stored)).toBe(display);
  });

  it("excludes legacy wire labels and Ultra from the display effort domain", () => {
    for (const invalid of ["none", "minimal", "low", "ultra"]) {
      expect(ReasoningEffortSchema.safeParse(invalid).success).toBe(false);
    }
    expect(renderModelDirectorVocabulary()).toContain(
      "Light, Medium, High, Xhigh, Max",
    );
  });

  it("represents Ultra as a non-orchestrated native multi-agent capability", () => {
    const build = compileMission(
      { objective: "Implement a normal local change" },
      { id: "msn_ultra_note" },
    ).contract.modelPlan.find((phase) => phase.phase === "build");

    expect(build).toMatchObject({
      effort: "high" satisfies ReasoningEffort,
      multiAgent: false,
      capabilityNote: ULTRA_CAPABILITY_NOTE,
    });
    expect(ULTRA_CAPABILITY_NOTE).toContain("native Codex multi-agent mode");
    expect(ULTRA_CAPABILITY_NOTE).toContain("does not orchestrate Ultra");
  });
});
