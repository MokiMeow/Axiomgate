import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { z } from "zod";

import type { CommandResult } from "../../guard/index.js";
import type { VerificationCheckState } from "../types.js";

export const NativeCheckCommandSchema = z.strictObject({
  kind: z.enum(["target.test", "target.lockout-test", "target.build"]),
  command: z.string().min(1),
  args: z.array(z.string()),
});

export type NativeCheckCommand = z.infer<typeof NativeCheckCommandSchema>;

export function detectNativeChecks(workspace: string): NativeCheckCommand[] {
  const root = resolve(workspace);
  const checks: NativeCheckCommand[] = [];
  const packagePath = join(root, "package.json");
  if (existsSync(packagePath)) {
    const value = JSON.parse(readFileSync(packagePath, "utf8")) as Record<
      string,
      unknown
    >;
    const scripts =
      typeof value.scripts === "object" &&
      value.scripts !== null &&
      !Array.isArray(value.scripts)
        ? (value.scripts as Record<string, unknown>)
        : {};
    if (typeof scripts.test === "string") {
      checks.push({ kind: "target.test", command: "npm", args: ["test"] });
    }
    if (typeof scripts["test:lockout"] === "string") {
      checks.push({
        kind: "target.lockout-test",
        command: "npm",
        args: ["run", "test:lockout"],
      });
    }
    if (typeof scripts.build === "string") {
      checks.push({
        kind: "target.build",
        command: "npm",
        args: ["run", "build"],
      });
    }
  }
  if (existsSync(join(root, "requirements.txt"))) {
    checks.push({
      kind: "target.test",
      command: "python",
      args: ["-m", "pytest"],
    });
  }
  return z.array(NativeCheckCommandSchema).parse(checks);
}

export function commandStatusToCheckState(
  status: CommandResult["status"],
): VerificationCheckState {
  switch (status) {
    case "SUCCESS":
      return "PASS";
    case "FAILED":
      return "FAIL";
    case "TIMED_OUT":
      return "BLOCKED";
    case "UNAVAILABLE":
      return "UNKNOWN";
  }
}
