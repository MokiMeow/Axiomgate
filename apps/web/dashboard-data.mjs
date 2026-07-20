export function demoModeEnabled(value = process.env.AXIOMGATE_DEMO) {
  return String(value || "").toLowerCase() === "true";
}

/**
 * Live governed missions always take precedence. The bundled sample is an
 * explicit hosting/demo surface, never an implicit fresh-clone fallback.
 */
export async function resolveDashboardMissions({
  liveMissionIds,
  loadLiveMission,
  loadSampleMission,
  demoMode = false,
}) {
  if (liveMissionIds.length > 0) {
    const loaded = await Promise.all(
      liveMissionIds.map((id) => loadLiveMission(id)),
    );
    return {
      demo: false,
      missions: loaded.filter(Boolean),
    };
  }

  if (!demoMode) {
    return { demo: false, missions: [] };
  }

  const sample = await loadSampleMission();
  return {
    demo: sample !== null,
    missions: sample === null ? [] : [{ ...sample, label: "SAMPLE" }],
  };
}
