import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEnforcementProbePlan,
  createEnforcementProbeContract,
  enforcementDriftWarning,
  verifyEnforcementInstallation,
} from "../src/index.js";

describe("verifyEnforcementInstallation", () => {
  it("validates config generation offline without recording a live verification", async () => {
    const homeDir = mkdtempSync(join(tmpdir(), "axiomgate-enforcement-home-"));
    try {
      const result = await verifyEnforcementInstallation({
        offline: true,
        homeDir,
        codexVersion: "codex-cli 0.144.4",
        hookConfigOptions: {
          cliEntryPath: "C:/Program Files/AxiomGate/cli.js",
          nodePath: process.execPath,
        },
        now: () => new Date("2026-07-15T21:00:00.000Z"),
      });

      expect(result).toMatchObject({
        status: "PASS",
        mode: "OFFLINE",
        version: "codex-cli 0.144.4",
        verifiedAt: null,
      });
      expect(result.configHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(
        existsSync(join(homeDir, ".axiomgate", "enforcement-verified.json")),
      ).toBe(false);
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });
});

describe("buildEnforcementProbePlan", () => {
  it("constructs a fresh Luna/low governed git-push probe", () => {
    const contract = createEnforcementProbeContract(
      "probe_mission",
      new Date("2026-07-15T21:00:00.000Z"),
    );
    const plan = buildEnforcementProbePlan({
      contract,
      missionDir: "C:/temp probe/.axiomgate/missions/probe_mission",
      projectPath: "C:/temp probe",
      hookConfigOptions: {
        cliEntryPath: "C:/Program Files/AxiomGate/cli.js",
        nodePath: process.execPath,
      },
    });

    expect(
      contract.actionPolicy
        .filter((entry) => entry.action !== "repository.read")
        .every((entry) => entry.decision === "DENY"),
    ).toBe(true);
    expect(plan).toMatchObject({
      model: "gpt-5.6-luna",
      effort: "low",
      stdin: expect.stringContaining("git push origin main"),
    });
    expect(plan.args).not.toContain("resume");
    expect(plan.args).toContain("--dangerously-bypass-hook-trust");
  });
});

describe("enforcementDriftWarning", () => {
  it("warns on a Codex version change and stays quiet on an exact match", () => {
    expect(
      enforcementDriftWarning("codex-cli 0.145.0", {
        version: "codex-cli 0.144.4",
        verifiedAt: "2026-07-15T21:00:00.000Z",
      }),
    ).toBe(
      "WARNING: codex version changed since last verified (codex-cli 0.144.4 -> codex-cli 0.145.0) - run axiomgate verify-enforcement",
    );
    expect(
      enforcementDriftWarning("codex-cli 0.144.4", {
        version: "codex-cli 0.144.4",
        verifiedAt: "2026-07-15T21:00:00.000Z",
      }),
    ).toBeUndefined();
  });
});
