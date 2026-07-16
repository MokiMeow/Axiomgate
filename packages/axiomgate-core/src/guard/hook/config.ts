import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";

import { stableStringify } from "../../mission/index.js";

export interface HookConfigOptions {
  readonly cliEntryPath?: string;
  readonly nodePath?: string;
  readonly approvalsReviewer?: string;
}

export interface GeneratedHookConfig {
  readonly command: string;
  readonly overrides: readonly [string, string];
  readonly codexArgs: readonly string[];
  readonly configHash: `sha256:${string}`;
}

function commandArgument(value: string): string {
  if (/^[A-Za-z0-9_.-]+$/u.test(value)) {
    return value;
  }
  if (process.platform === "win32") {
    return `"${value.replaceAll("\\", "/").replaceAll('"', '""')}"`;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function generateHookConfig(
  missionDir: string,
  options: HookConfigOptions = {},
): GeneratedHookConfig {
  const configuredNodePath = options.nodePath ?? process.execPath;
  const nodePath =
    process.platform === "win32" &&
    basename(configuredNodePath).toLowerCase() === "node.exe"
      ? "node"
      : resolve(configuredNodePath);
  const cliEntryPath = resolve(options.cliEntryPath ?? process.argv[1]!);
  const resolvedMissionDir = resolve(missionDir);
  const command = [
    commandArgument(nodePath),
    commandArgument(cliEntryPath),
    "hook",
    "--mission",
    commandArgument(resolvedMissionDir),
    ...(options.approvalsReviewer === undefined
      ? []
      : ["--approvals-reviewer", commandArgument(options.approvalsReviewer)]),
  ].join(" ");
  const hook = `[${["Bash", "apply_patch"]
    .map(
      (matcher) =>
        `{matcher=${JSON.stringify(matcher)},hooks=[{type="command",command=${JSON.stringify(command)}}]}`,
    )
    .join(",")}]`;
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
