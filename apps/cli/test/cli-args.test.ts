import { describe, expect, it } from "vitest";

import { friendlyMissionError, hasHelpFlag } from "../src/cli-args.js";

describe("CLI argument handling", () => {
  it.each([
    [["mission", "run", "--help"], true],
    [["receipt", "verify", "-h"], true],
    [["mission", "run", "msn_fixture"], false],
  ] as const)("detects help flags in %j", (args, expected) => {
    expect(hasHelpFlag(args)).toBe(expected);
  });

  it("turns missing mission filesystem errors into a friendly message", () => {
    const result = friendlyMissionError(
      new Error("ENOENT: no such file or directory, open 'contract.json'"),
      "msn_missing",
      "C:/fixture",
    );
    expect(result).toContain("Mission not found: msn_missing");
    expect(result).not.toContain("ENOENT");
  });

  it("preserves unrelated mission errors", () => {
    expect(
      friendlyMissionError(new Error("identity differs"), "msn_fixture", "."),
    ).toBe("identity differs");
  });
});
