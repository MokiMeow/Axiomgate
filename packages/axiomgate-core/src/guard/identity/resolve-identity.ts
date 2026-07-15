import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runCommand, type CommandResult, type CommandRunner } from "./command.js";
import {
  parseGithubLogin,
  parseGitRemotes,
  parseVercelProjectJson,
  parseVercelWhoami,
  type ParseResult,
} from "./parsers.js";
import type {
  IdentityField,
  IdentityReport,
  IdentitySource,
} from "./types.js";

export interface ResolveIdentityOptions {
  readonly cwd?: string;
  readonly runner?: CommandRunner;
  readonly now?: () => Date;
  readonly readTextFile?: (path: string) => string;
}

function unavailable<T, S extends IdentitySource>(
  source: S,
  reason: string,
  capturedAt: string,
): IdentityField<T, S> {
  return { status: "UNAVAILABLE", source, reason, capturedAt };
}

function fromCommand<T, S extends IdentitySource>(
  result: CommandResult,
  source: S,
  capturedAt: string,
  parser: (output: string) => ParseResult<T>,
): IdentityField<T, S> {
  if (result.status !== "SUCCESS") {
    return unavailable(
      source,
      `${source} ${result.status.toLowerCase()} (exit ${result.exitCode})`,
      capturedAt,
    );
  }

  const parsed = parser(result.stdout);
  return parsed.ok
    ? {
        status: "RESOLVED",
        value: parsed.value,
        source,
        confidence: "HIGH",
        capturedAt,
      }
    : unavailable(source, parsed.reason, capturedAt);
}

export function resolveIdentity(
  options: ResolveIdentityOptions = {},
): IdentityReport {
  const cwd = options.cwd ?? process.cwd();
  const runner = options.runner ?? runCommand;
  const capturedAt = (options.now ?? (() => new Date()))().toISOString();
  const readTextFile = options.readTextFile ?? ((path) => readFileSync(path, "utf8"));

  const githubLogin = fromCommand(
    runner("gh", ["api", "user"], { cwd }),
    "gh api user",
    capturedAt,
    parseGithubLogin,
  );
  const gitRemotes = fromCommand(
    runner("git", ["remote", "-v"], { cwd }),
    "git remote -v",
    capturedAt,
    parseGitRemotes,
  );
  const vercelUser = fromCommand(
    runner("vercel", ["whoami", "--no-color"], { cwd }),
    "vercel whoami",
    capturedAt,
    parseVercelWhoami,
  );

  let vercelProject: IdentityReport["vercelProject"];
  try {
    const parsed = parseVercelProjectJson(
      readTextFile(join(cwd, ".vercel", "project.json")),
    );
    vercelProject = parsed.ok
      ? {
          status: "RESOLVED",
          value: parsed.value,
          source: ".vercel/project.json",
          confidence: "HIGH",
          capturedAt,
        }
      : unavailable(".vercel/project.json", parsed.reason, capturedAt);
  } catch (error) {
    vercelProject = unavailable(
      ".vercel/project.json",
      error instanceof Error ? error.message : "Vercel project file unavailable",
      capturedAt,
    );
  }

  return { githubLogin, gitRemotes, vercelUser, vercelProject };
}
