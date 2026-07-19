import { spawnSync } from "node:child_process";

export function platformCommand(name) {
  return process.platform === "win32" && !/\.(?:cmd|bat|exe)$/iu.test(name)
    ? `${name}.cmd`
    : name;
}

export function runCommand(command, args = [], options = {}) {
  const startedAt = Date.now();
  const isCommandScript =
    process.platform === "win32" && /\.(?:cmd|bat)$/iu.test(command);
  const executable = isCommandScript
    ? (process.env.ComSpec ?? "cmd.exe")
    : command;
  const executableArgs = isCommandScript
    ? ["/d", "/s", "/c", command, ...args]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 60_000,
    windowsHide: true,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
  });
  const status = result.error?.code === "ETIMEDOUT"
    ? "TIMED_OUT"
    : result.error !== undefined
      ? "UNAVAILABLE"
      : result.status === 0
        ? "SUCCESS"
        : "FAILED";
  return {
    command,
    args,
    status,
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
    durationMs: Date.now() - startedAt,
  };
}

export function requireSuccess(label, result) {
  if (result.status !== "SUCCESS") {
    throw new Error(
      `${label} failed (${result.status}, exit=${result.exitCode ?? "none"})\n${result.stderr || result.stdout}`,
    );
  }
  return result;
}
