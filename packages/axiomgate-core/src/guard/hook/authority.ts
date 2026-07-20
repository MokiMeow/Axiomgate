import { basename, dirname, resolve } from "node:path";

import type { HookToolPayload } from "./classifier.js";

const AXIOMGATE_SEGMENT = /(?:^|[\\/])\.axiomgate(?:[\\/]|$)/iu;
const PATCH_PATH = /^\*\*\*\s+(?:Add|Update|Delete) File:\s*(.+)$/gmu;
const PATCH_MOVE_PATH = /^\*\*\*\s+Move to:\s*(.+)$/gmu;
const PATH_KEY =
  /^(?:path|file|fileName|filename|filePath|file_path|target|targetPath|target_path|destination|destinationPath|destination_path|dest|newPath|new_path|to)$/iu;
const WRITE_TOOL_NAME =
  /(?:^|__|_)(?:apply_patch|write|create|update|edit|delete|remove|move|rename|copy|patch)(?:_|$)/iu;
const SHELL_SUBSTITUTION = /(?:`|\$\()/u;
const OUTPUT_REDIRECTION = />{1,2}/u;

const SIMPLE_READ_COMMAND = /^(?:ls|dir|pwd|cat|type|head|tail|wc|grep|findstr|where|which|tree|echo)(?:\s|$)/iu;
const RIPGREP_READ_COMMAND = /^rg(?:\.exe)?(?:\s|$)/iu;
const POWERSHELL_READ_COMMAND = /^(?:get-childitem|get-content|get-location|get-item|get-command|select-string|test-path|resolve-path|measure-object)(?:\s|$)/iu;
const GIT_READ_COMMAND = /^git(?:\.exe)?\s+(?:status|diff|log|show|rev-parse|remote\s+(?:-v|get-url)|branch\s+(?:--show-current|--list))(?:\s|$)/iu;

function normalizedPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase();
}

function axiomGateRoot(missionDir: string): string {
  let cursor = resolve(missionDir);
  while (true) {
    if (basename(cursor).toLowerCase() === ".axiomgate") return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) return resolve(missionDir);
    cursor = parent;
  }
}

function inside(candidate: string, root: string): boolean {
  const normalizedCandidate = normalizedPath(candidate);
  const normalizedRoot = normalizedPath(root);
  return normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

function resolvesToGovernedState(
  candidate: string,
  cwd: string,
  root: string,
): boolean {
  const cleaned = candidate.trim().replace(/^["']|["']$/gu, "");
  if (cleaned.length === 0) return false;
  const resolved = resolve(cwd, cleaned);
  return inside(resolved, root) || AXIOMGATE_SEGMENT.test(normalizedPath(resolved));
}

function patchTargets(patch: string): string[] {
  const paths: string[] = [];
  for (const expression of [PATCH_PATH, PATCH_MOVE_PATH]) {
    expression.lastIndex = 0;
    for (const match of patch.matchAll(expression)) {
      if (match[1] !== undefined) paths.push(match[1]);
    }
  }
  return paths;
}

function structuredPathValues(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (PATH_KEY.test(key) && typeof child === "string") paths.push(child);
    if (typeof child === "object" && child !== null) {
      paths.push(...structuredPathValues(child));
    }
  }
  return paths;
}

function isReadSegment(segment: string): boolean {
  const value = segment.trim();
  if (value.length === 0) return false;
  if (SHELL_SUBSTITUTION.test(value) || OUTPUT_REDIRECTION.test(value)) {
    return false;
  }
  if (/\b(?:--pre|--hostname-bin|--ext-diff|--textconv|-exec)\b/iu.test(value)) {
    return false;
  }
  return SIMPLE_READ_COMMAND.test(value) ||
    RIPGREP_READ_COMMAND.test(value) ||
    POWERSHELL_READ_COMMAND.test(value) ||
    GIT_READ_COMMAND.test(value);
}

/**
 * The shell fallback is intentionally an allowlist. Anything not demonstrably
 * read-only becomes UNKNOWN and is denied by policy rather than being guessed
 * safe from the absence of a known mutation pattern.
 */
export function isDemonstrablyReadOnlyShellCommand(command: string): boolean {
  const trimmed = command.trim();
  if (trimmed.length === 0 || /[\r\n]/u.test(trimmed)) return false;
  const segments = trimmed.split(/\s*(?:&&|\|\||[;|])\s*/u);
  return segments.length > 0 && segments.every(isReadSegment);
}

function commandReferencesGovernedState(
  command: string,
  cwd: string,
  root: string,
): boolean {
  if (AXIOMGATE_SEGMENT.test(command.replaceAll("\\", "/"))) return true;
  const pathLike = command.match(/[A-Za-z]:[\\/][^\s"']+|\.{0,2}[\\/][^\s"']+/gu) ?? [];
  return pathLike.some((candidate) => resolvesToGovernedState(candidate, cwd, root));
}

export interface GovernedStateWriteCheck {
  readonly blocked: boolean;
  readonly reason?: string;
}

/**
 * This check is independent of mission policy: no ALLOW rule can authorize a
 * model-visible tool to mutate the policy, approvals, snapshots, or evidence
 * used to govern that same model. Moving authority outside the writable
 * workspace remains the stronger long-term boundary; this is the Build Week
 * defense-in-depth mitigation.
 */
export function checkGovernedStateWrite(
  payload: HookToolPayload,
  missionDir: string,
  cwd: string,
): GovernedStateWriteCheck {
  const root = axiomGateRoot(missionDir);
  const toolName = payload.tool_name.toLowerCase();
  const patch = typeof payload.tool_input.patch === "string"
    ? payload.tool_input.patch
    : toolName === "apply_patch" && typeof payload.tool_input.command === "string"
      ? payload.tool_input.command
      : undefined;
  if (
    patch !== undefined &&
    patchTargets(patch).some((path) => resolvesToGovernedState(path, cwd, root))
  ) {
    return {
      blocked: true,
      reason: "fail-closed: writes to governed AxiomGate state are forbidden",
    };
  }

  const structuredPaths = structuredPathValues(payload.tool_input);
  if (
    WRITE_TOOL_NAME.test(toolName) &&
    structuredPaths.some((path) => resolvesToGovernedState(path, cwd, root))
  ) {
    return {
      blocked: true,
      reason: "fail-closed: writes to governed AxiomGate state are forbidden",
    };
  }

  const command = typeof payload.tool_input.command === "string"
    ? payload.tool_input.command
    : undefined;
  if (
    command !== undefined &&
    !isDemonstrablyReadOnlyShellCommand(command) &&
    commandReferencesGovernedState(command, cwd, root)
  ) {
    return {
      blocked: true,
      reason: "fail-closed: writes to governed AxiomGate state are forbidden",
    };
  }

  return { blocked: false };
}
