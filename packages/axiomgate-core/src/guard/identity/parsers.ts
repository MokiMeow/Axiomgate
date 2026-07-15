import type { GitRemote, VercelProjectIdentity } from "./types.js";

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

function parseJsonObject(
  input: string,
): ParseResult<Record<string, unknown>> {
  if (input.trim().length === 0) {
    return { ok: false, reason: "Output was empty" };
  }

  try {
    const value: unknown = JSON.parse(input);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, reason: "Expected a JSON object" };
    }

    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, reason: "Output was not valid JSON" };
  }
}

export function parseGithubLogin(input: string): ParseResult<string> {
  const parsed = parseJsonObject(input);
  if (!parsed.ok) {
    return parsed;
  }

  return typeof parsed.value.login === "string" && parsed.value.login.length > 0
    ? { ok: true, value: parsed.value.login }
    : { ok: false, reason: "GitHub response did not include a login" };
}

export function parseGitRemotes(
  input: string,
): ParseResult<readonly GitRemote[]> {
  const lines = input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { ok: false, reason: "Git repository has no configured remotes" };
  }

  const remotes: GitRemote[] = [];
  for (const line of lines) {
    const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/u.exec(line);
    if (match === null) {
      return { ok: false, reason: `Malformed git remote line: ${line}` };
    }

    remotes.push({
      name: match[1]!,
      url: match[2]!,
      direction: match[3] as "fetch" | "push",
    });
  }

  return { ok: true, value: remotes };
}

export function parseVercelWhoami(input: string): ParseResult<string> {
  const value = input.trim();
  if (value.length === 0) {
    return { ok: false, reason: "Vercel identity output was empty" };
  }

  if (/\s/u.test(value)) {
    return { ok: false, reason: "Vercel identity output was malformed" };
  }

  return { ok: true, value };
}

export function parseVercelProjectJson(
  input: string,
): ParseResult<VercelProjectIdentity> {
  const parsed = parseJsonObject(input);
  if (!parsed.ok) {
    return parsed;
  }

  const { projectId, orgId, projectName } = parsed.value;
  if (
    typeof projectId !== "string" ||
    projectId.length === 0 ||
    typeof orgId !== "string" ||
    orgId.length === 0
  ) {
    return {
      ok: false,
      reason: "Vercel project file requires projectId and orgId",
    };
  }

  if (projectName !== undefined && typeof projectName !== "string") {
    return { ok: false, reason: "Vercel projectName must be a string" };
  }

  return {
    ok: true,
    value: {
      projectId,
      orgId,
      ...(projectName === undefined ? {} : { projectName }),
    },
  };
}

export interface InspectedVercelProject {
  readonly id: string;
  readonly name: string;
}

export function parseVercelProjectInspect(
  input: string,
): ParseResult<InspectedVercelProject> {
  const trimmed = input.trim();
  if (trimmed.startsWith("{")) {
    const parsed = parseJsonObject(trimmed);
    if (!parsed.ok) {
      return parsed;
    }

    const id = parsed.value.id ?? parsed.value.projectId;
    const name = parsed.value.name ?? parsed.value.projectName;
    return typeof id === "string" && typeof name === "string"
      ? { ok: true, value: { id, name } }
      : { ok: false, reason: "Vercel inspect JSON omitted id or name" };
  }

  const id = /^\s*(?:Project\s+)?ID\s+([^\s]+)\s*$/imu.exec(input)?.[1];
  const name = /^\s*Name\s+([^\s]+)\s*$/imu.exec(input)?.[1];
  return id !== undefined && name !== undefined
    ? { ok: true, value: { id, name } }
    : { ok: false, reason: "Vercel inspect output omitted ID or Name" };
}
