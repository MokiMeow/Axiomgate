import { describe, expect, it } from "vitest";

import {
  demoModeEnabled,
  resolveDashboardMissions,
} from "../dashboard-data.mjs";

describe("local dashboard clone, demo, and live separation", () => {
  const sample = { id: "msn_sample", label: "SAMPLE" };

  it("keeps a fresh clone empty when demo mode is absent", async () => {
    const result = await resolveDashboardMissions({
      liveMissionIds: [],
      loadLiveMission: async () => null,
      loadSampleMissions: async () => [sample],
      demoMode: false,
    });
    expect(result).toEqual({ demo: false, missions: [] });
  });

  it("loads the curated SAMPLE only in explicit demo mode", async () => {
    const result = await resolveDashboardMissions({
      liveMissionIds: [],
      loadLiveMission: async () => null,
      loadSampleMissions: async () => [sample, { id: "msn_sample_2" }],
      demoMode: true,
    });
    expect(result).toEqual({
      demo: true,
      missions: [sample, { id: "msn_sample_2", label: "SAMPLE" }],
    });
  });

  it("always prefers real missions and removes the demo banner", async () => {
    const live = { id: "msn_live", label: "LIVE" };
    const result = await resolveDashboardMissions({
      liveMissionIds: [live.id],
      loadLiveMission: async () => live,
      loadSampleMissions: async () => [sample],
      demoMode: true,
    });
    expect(result).toEqual({ demo: false, missions: [live] });
  });

  it("requires the exact true value for demo mode", () => {
    expect(demoModeEnabled("true")).toBe(true);
    expect(demoModeEnabled("TRUE")).toBe(true);
    expect(demoModeEnabled(undefined)).toBe(false);
    expect(demoModeEnabled("1")).toBe(false);
  });
});
