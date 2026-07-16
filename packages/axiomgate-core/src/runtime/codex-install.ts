import { z } from "zod";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { ReasoningEffortSchema } from "../mission/index.js";

export const CodexAgentDefinitionSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1),
  developer_instructions: z.string().min(1),
  model: z.string().min(1),
  model_reasoning_effort: ReasoningEffortSchema,
  sandbox_mode: z.literal("read-only"),
});

export type CodexAgentDefinition = z.infer<typeof CodexAgentDefinitionSchema>;

export function parseCodexAgentDefinition(toml: string): CodexAgentDefinition {
  const entries = toml
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator < 1) throw new Error(`invalid agent TOML line: ${line}`);
      const key = line.slice(0, separator).trim();
      const rawValue = line.slice(separator + 1).trim();
      let value: unknown;
      try {
        value = JSON.parse(rawValue);
      } catch {
        throw new Error(`invalid agent TOML value for ${key}`);
      }
      return [key, value] as const;
    });
  return CodexAgentDefinitionSchema.parse(Object.fromEntries(entries));
}

export type CodexInstallActionStatus =
  | "PLANNED"
  | "WRITTEN"
  | "UNCHANGED"
  | "CONFLICT";

export interface CodexInstallAction {
  readonly source: string;
  readonly target: string;
  readonly status: CodexInstallActionStatus;
}

export interface InstallCodexIntegrationOptions {
  readonly sourceRoot: string;
  readonly codexHome: string;
  readonly dryRun?: boolean;
}

export interface CodexInstallResult {
  readonly mode: "DRY_RUN" | "INSTALL";
  readonly actions: readonly CodexInstallAction[];
}

function installFile(
  source: string,
  target: string,
  dryRun: boolean,
): CodexInstallAction {
  if (!existsSync(source)) {
    throw new Error(`Codex integration source is missing: ${source}`);
  }
  const content = readFileSync(source, "utf8");
  if (existsSync(target)) {
    return {
      source,
      target,
      status:
        readFileSync(target, "utf8") === content ? "UNCHANGED" : "CONFLICT",
    };
  }
  if (!dryRun) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }
  return { source, target, status: dryRun ? "PLANNED" : "WRITTEN" };
}

export function installCodexIntegration(
  options: InstallCodexIntegrationOptions,
): CodexInstallResult {
  const sourceRoot = resolve(options.sourceRoot);
  const codexHome = resolve(options.codexHome);
  const dryRun = options.dryRun ?? false;
  const mappings = [
    [
      join(sourceRoot, ".agents", "skills", "axiomgate", "SKILL.md"),
      join(codexHome, "skills", "axiomgate", "SKILL.md"),
    ],
    [
      join(
        sourceRoot,
        ".agents",
        "skills",
        "axiomgate",
        "agents",
        "openai.yaml",
      ),
      join(codexHome, "skills", "axiomgate", "agents", "openai.yaml"),
    ],
    [
      join(
        sourceRoot,
        ".agents",
        "agents",
        "axiomgate-verifier.toml",
      ),
      join(codexHome, "agents", "axiomgate-verifier.toml"),
    ],
  ] as const;
  return {
    mode: dryRun ? "DRY_RUN" : "INSTALL",
    actions: mappings.map(([source, target]) =>
      installFile(source, target, dryRun),
    ),
  };
}

export interface CodexNativeStatus {
  readonly skill: { readonly installed: boolean; readonly path: string };
  readonly verifierAgent: { readonly installed: boolean; readonly path: string };
}

export function codexNativeStatus(codexHome: string): CodexNativeStatus {
  const home = resolve(codexHome);
  const skillPath = join(home, "skills", "axiomgate", "SKILL.md");
  const agentPath = join(home, "agents", "axiomgate-verifier.toml");
  return {
    skill: { installed: existsSync(skillPath), path: skillPath },
    verifierAgent: { installed: existsSync(agentPath), path: agentPath },
  };
}
