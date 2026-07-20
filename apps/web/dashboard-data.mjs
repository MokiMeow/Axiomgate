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
  loadSampleMissions,
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

  const samples = await loadSampleMissions();
  const missions = Array.isArray(samples)
    ? samples.filter(Boolean).map((sample) => ({ ...sample, label: "SAMPLE" }))
    : [];
  return {
    demo: missions.length > 0,
    missions,
  };
}
