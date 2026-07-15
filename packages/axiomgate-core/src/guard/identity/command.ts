import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";
import { spawnSync } from "node:child_process";

export const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;

export type CommandStatus =
  | "SUCCESS"
  | "FAILED"
  | "UNAVAILABLE"
  | "TIMED_OUT";

export interface CommandResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly status: CommandStatus;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export interface RunCommandOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: RunCommandOptions,
) => CommandResult;

function resolveExecutable(command: string): string | undefined {
  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return existsSync(command) ? command : undefined;
  }

  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const hasExtension = extname(command).length > 0;
  const extensions =
    process.platform === "win32" && !hasExtension
      ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .map((extension) => extension.toLowerCase())
      : [""];

  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function commandInvocation(
  executable: string,
  args: readonly string[],
): {
  executable: string;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
} {
  if (
    process.platform !== "win32" ||
    ![".cmd", ".bat"].includes(extname(executable).toLowerCase())
  ) {
    return { executable, args };
  }

  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$commandPath = $env:AXIOMGATE_COMMAND_PATH",
    "$commandArgs = @(ConvertFrom-Json -InputObject $env:AXIOMGATE_COMMAND_ARGS)",
    "& $commandPath @commandArgs",
    "if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }",
  ].join("\n");
  const encodedScript = Buffer.from(script, "utf16le").toString("base64");

  return {
    executable: "powershell.exe",
    args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript],
    env: {
      ...process.env,
      AXIOMGATE_COMMAND_PATH: executable,
      AXIOMGATE_COMMAND_ARGS: JSON.stringify(args),
    },
  };
}

export function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions = {},
): CommandResult {
  const startedAt = Date.now();
  const executable = resolveExecutable(command);

  if (executable === undefined) {
    return {
      command,
      args,
      status: "UNAVAILABLE",
      exitCode: 127,
      stdout: "",
      stderr: `Executable not found: ${command}`,
      durationMs: Date.now() - startedAt,
    };
  }

  const invocation = commandInvocation(executable, args);
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: invocation.env,
    shell: false,
    timeout: options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    windowsHide: true,
  });
  const durationMs = Date.now() - startedAt;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  if (errorCode === "ETIMEDOUT") {
    return {
      command,
      args,
      status: "TIMED_OUT",
      exitCode: 124,
      stdout,
      stderr,
      durationMs,
    };
  }

  if (result.error !== undefined) {
    return {
      command,
      args,
      status: "UNAVAILABLE",
      exitCode: 127,
      stdout,
      stderr: stderr || result.error.message,
      durationMs,
    };
  }

  return {
    command,
    args,
    status: result.status === 0 ? "SUCCESS" : "FAILED",
    exitCode: result.status ?? 1,
    stdout,
    stderr,
    durationMs,
  };
}
