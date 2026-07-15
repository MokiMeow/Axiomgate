import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

export const MissionSessionSchema = z.strictObject({
  id: z.string().min(1),
  role: z.enum(["builder", "verifier"]),
});

export type MissionSession = z.infer<typeof MissionSessionSchema>;

const StoredSessionsSchema = z.array(
  z.union([z.string().min(1), MissionSessionSchema]),
);

export function readMissionSessions(missionDir: string): MissionSession[] {
  const path = join(missionDir, "sessions.json");
  if (!existsSync(path)) {
    return [];
  }
  return StoredSessionsSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  ).map((entry) =>
    typeof entry === "string" ? { id: entry, role: "builder" as const } : entry,
  );
}

export function appendMissionSession(
  missionDir: string,
  sessionId: string | undefined,
  role: MissionSession["role"],
): void {
  if (sessionId === undefined) {
    return;
  }
  const sessions = readMissionSessions(missionDir);
  if (!sessions.some((entry) => entry.id === sessionId && entry.role === role)) {
    sessions.push({ id: sessionId, role });
  }
  writeFileSync(
    join(missionDir, "sessions.json"),
    `${JSON.stringify(sessions, null, 2)}\n`,
    "utf8",
  );
}
