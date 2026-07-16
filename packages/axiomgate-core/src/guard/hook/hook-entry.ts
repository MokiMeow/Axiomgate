import { processHookInvocation } from "./decision.js";
import type { HookConfigOptions } from "./config.js";

export function runHookEntry(
  rawInput: string,
  missionDir: string,
  configOptions: HookConfigOptions = {},
): string {
  try {
    return JSON.stringify(
      processHookInvocation(rawInput, missionDir, {
        configOptions,
        ...(configOptions.approvalsReviewer === undefined
          ? {}
          : { approvalsReviewer: configOptions.approvalsReviewer }),
      }).output,
    );
  } catch (error) {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: hookEventName(rawInput),
        permissionDecision: "deny",
        permissionDecisionReason: `fail-closed: hook entry error: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      },
    });
  }
}

function hookEventName(rawInput: string): string {
  try {
    const parsed: unknown = JSON.parse(rawInput);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const value = (parsed as Record<string, unknown>).hook_event_name;
      if (typeof value === "string" && value.length > 0) return value;
    }
  } catch {
    // The fail-closed output below still needs a protocol-valid event name.
  }
  return "PreToolUse";
}
