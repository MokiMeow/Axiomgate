import { describe, expect, it } from "vitest";

import { runSubmissionReplay, selectSubmissionReplay } from "../src/index.js";

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

  it.each(["wrong-target", "approval-binding", "evidence-gate"])(
    "selects the %s scenario independently",
    (scenario) => {
      expect(selectSubmissionReplay(scenario)).toEqual([
        expect.objectContaining({ id: scenario, status: "PASS" }),
      ]);
    },
  );

  it("rejects an unknown replay scenario", () => {
    expect(() => selectSubmissionReplay("unknown")).toThrow(
      "replay scenario must be",
    );
  });
});
