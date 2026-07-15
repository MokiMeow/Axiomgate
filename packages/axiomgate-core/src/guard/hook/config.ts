import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { stableStringify } from "../../mission/index.js";

export interface HookConfigOptions {
  readonly cliEntryPath?: string;
  readonly nodePath?: string;
}

export interface GeneratedHookConfig {
  readonly command: string;
  readonly overrides: readonly [string, string];
  readonly codexArgs: readonly string[];
  readonly configHash: `sha256:${string}`;
}

function commandArgument(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function generateHookConfig(
  missionDir: string,
  options: HookConfigOptions = {},
): GeneratedHookConfig {
  const nodePath = resolve(options.nodePath ?? process.execPath);
  const cliEntryPath = resolve(options.cliEntryPath ?? process.argv[1]!);
  const resolvedMissionDir = resolve(missionDir);
  const command = [
    commandArgument(nodePath),
    commandArgument(cliEntryPath),
    "hook",
    "--mission",
    commandArgument(resolvedMissionDir),
  ].join(" ");
  const hook = `[{matcher=".*",hooks=[{type="command",command=${JSON.stringify(
    command,
  )}}]}]`;
  const overrides = [
    `hooks.PreToolUse=${hook}`,
    `hooks.PermissionRequest=${hook}`,
  ] as const;
  const configHash = `sha256:${createHash("sha256")
    .update(stableStringify({ command, overrides }))
    .digest("hex")}` as const;

  return {
    command,
    overrides,
    codexArgs: overrides.flatMap((override) => ["-c", override]),
    configHash,
  };
}
