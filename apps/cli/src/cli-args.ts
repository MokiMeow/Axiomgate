import { resolve } from "node:path";

export function hasHelpFlag(args: readonly string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

export function friendlyMissionError(
  error: unknown,
  missionId: string | undefined,
  projectPath: string,
): string {
  const message = error instanceof Error ? error.message : "unknown error";
  if (
    missionId !== undefined &&
    /(?:invalid mission id|enoent|no such file|read failure)/iu.test(message)
  ) {
    return `Mission not found: ${missionId}. Check ${resolve(projectPath, ".axiomgate", "missions")} for a valid mission ID.`;
  }
  return message;
}
