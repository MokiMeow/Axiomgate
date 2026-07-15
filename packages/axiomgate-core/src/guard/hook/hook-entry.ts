import { processHookInvocation } from "./decision.js";
import type { HookConfigOptions } from "./config.js";

export function runHookEntry(
  rawInput: string,
  missionDir: string,
  configOptions: HookConfigOptions = {},
): string {
  try {
    return JSON.stringify(
      processHookInvocation(rawInput, missionDir, { configOptions }).output,
    );
  } catch (error) {
    return JSON.stringify({
      hookSpecificOutput: {
        permissionDecision: "deny",
        permissionDecisionReason: `fail-closed: hook entry error: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      },
    });
  }
}
