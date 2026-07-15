import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

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

export interface RunStreamingCommandOptions extends RunCommandOptions {
  readonly input?: string;
  readonly onStdoutLine?: (line: string) => void;
}

export type StreamingCommandRunner = (
  command: string,
  args: readonly string[],
  options?: RunStreamingCommandOptions,
) => Promise<CommandResult>;

export interface StagedCommandWrite {
  readonly data: string;
  readonly delayMs: number;
}

export interface RunStagedCommandOptions extends RunCommandOptions {
  readonly writes: readonly StagedCommandWrite[];
  readonly completeWhenStdoutLine: (line: string) => boolean;
}

export type StagedCommandRunner = (
  command: string,
  args: readonly string[],
  options?: RunStagedCommandOptions,
) => Promise<CommandResult>;

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

export function runStreamingCommand(
  command: string,
  args: readonly string[],
  options: RunStreamingCommandOptions = {},
): Promise<CommandResult> {
  const startedAt = Date.now();
  const executable = resolveExecutable(command);
  if (executable === undefined) {
    return Promise.resolve({
      command,
      args,
      status: "UNAVAILABLE",
      exitCode: 127,
      stdout: "",
      stderr: `Executable not found: ${command}`,
      durationMs: Date.now() - startedAt,
    });
  }
  const invocation = commandInvocation(executable, args);

  return new Promise((resolveResult) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd: options.cwd,
      env: invocation.env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let lineBuffer = "";
    let timedOut = false;
    let settled = false;
    const finish = (result: CommandResult) => {
      if (!settled) {
        settled = true;
        resolveResult(result);
      }
    };
    const emitLines = (chunk: string, final = false) => {
      lineBuffer += chunk;
      const lines = lineBuffer.split(/\n/u);
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        options.onStdoutLine?.(line.replace(/\r$/u, ""));
      }
      if (final && lineBuffer.length > 0) {
        options.onStdoutLine?.(lineBuffer.replace(/\r$/u, ""));
        lineBuffer = "";
      }
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      emitLines(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      finish({
        command,
        args,
        status: "UNAVAILABLE",
        exitCode: 127,
        stdout,
        stderr: stderr || error.message,
        durationMs: Date.now() - startedAt,
      });
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      emitLines("", true);
      finish({
        command,
        args,
        status: timedOut
          ? "TIMED_OUT"
          : exitCode === 0
            ? "SUCCESS"
            : "FAILED",
        exitCode: timedOut ? 124 : (exitCode ?? 1),
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    });
    child.stdin.end(options.input ?? "");
  });
}

export function runStagedCommand(
  command: string,
  args: readonly string[],
  options: RunStagedCommandOptions,
): Promise<CommandResult> {
  const startedAt = Date.now();
  const executable = resolveExecutable(command);
  if (executable === undefined) {
    return Promise.resolve({
      command,
      args,
      status: "UNAVAILABLE",
      exitCode: 127,
      stdout: "",
      stderr: `Executable not found: ${command}`,
      durationMs: Date.now() - startedAt,
    });
  }
  const invocation = commandInvocation(executable, args);
  return new Promise((resolveResult) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd: options.cwd,
      env: invocation.env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let lineBuffer = "";
    let completed = false;
    let timedOut = false;
    let settled = false;
    const writeTimers: Array<ReturnType<typeof setTimeout>> = [];
    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      for (const timer of writeTimers) clearTimeout(timer);
      resolveResult(result);
    };
    const inspectLines = (chunk: string) => {
      lineBuffer += chunk;
      const lines = lineBuffer.split(/\n/u);
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (options.completeWhenStdoutLine(line.replace(/\r$/u, ""))) {
          completed = true;
          child.kill();
          return;
        }
      }
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      inspectLines(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      finish({
        command,
        args,
        status: "UNAVAILABLE",
        exitCode: 127,
        stdout,
        stderr: stderr || error.message,
        durationMs: Date.now() - startedAt,
      });
    });
    for (const write of options.writes) {
      writeTimers.push(
        setTimeout(() => {
          if (!child.killed && child.stdin.writable) child.stdin.write(write.data);
        }, write.delayMs),
      );
    }
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      finish({
        command,
        args,
        status: completed
          ? "SUCCESS"
          : timedOut
            ? "TIMED_OUT"
            : exitCode === 0
              ? "SUCCESS"
              : "FAILED",
        exitCode: completed ? 0 : timedOut ? 124 : (exitCode ?? 1),
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}
