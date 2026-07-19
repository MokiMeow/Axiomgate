import { describe, expect, it } from "vitest";

import { runSubmissionReplay } from "../src/index.js";

describe("credential-free submission replay", () => {
  it("executes all three governance regressions through production logic", () => {
    expect(runSubmissionReplay()).toEqual([
      expect.objectContaining({
        id: "wrong-target",
        status: "PASS",
        observed: "EXISTS_NOT_OWNED",
      }),
      expect.objectContaining({
        id: "approval-binding",
        status: "PASS",
        observed: "approval command hash does not match",
      }),
      expect.objectContaining({
        id: "evidence-gate",
        status: "PASS",
        observed: "INCOMPLETE / UNVERIFIED",
      }),
    ]);
  });
});
