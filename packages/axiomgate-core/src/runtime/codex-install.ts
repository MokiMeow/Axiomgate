import { z } from "zod";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { CodexReasoningEffortSchema } from "../mission/index.js";
import type { CommandRunner } from "../guard/index.js";

export const CodexAgentDefinitionSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1),
  developer_instructions: z.string().min(1),
  model: z.string().min(1),
  model_reasoning_effort: CodexReasoningEffortSchema,
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
  readonly runner?: CommandRunner;
  readonly codexLaunch?: {
    readonly command: string;
    readonly argsPrefix: readonly string[];
  };
  readonly cliEntryPath?: string;
  readonly nodePath?: string;
}

export interface CodexInstallResult {
  readonly mode: "DRY_RUN" | "INSTALL";
  readonly strategy: "PLUGIN" | "FILESYSTEM_FALLBACK";
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

function filesystemInstall(
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
    strategy: "FILESYSTEM_FALLBACK",
    actions: mappings.map(([source, target]) =>
      installFile(source, target, dryRun),
    ),
  };
}

function commandAction(
  runner: CommandRunner,
  command: string,
  args: readonly string[],
  source: string,
  target: string,
  dryRun: boolean,
): CodexInstallAction {
  if (dryRun) return { source, target, status: "PLANNED" };
  const result = runner(command, args, { timeoutMs: 30_000 });
  if (result.status === "SUCCESS") {
    return { source, target, status: "WRITTEN" };
  }
  const output = `${result.stdout}\n${result.stderr}`;
  return {
    source,
    target,
    status: /already|exists|configured/iu.test(output) ? "UNCHANGED" : "CONFLICT",
  };
}

function pluginInstall(
  options: InstallCodexIntegrationOptions,
  runner: CommandRunner,
  launch: NonNullable<InstallCodexIntegrationOptions["codexLaunch"]>,
): CodexInstallResult {
  const sourceRoot = resolve(options.sourceRoot);
  const codexHome = resolve(options.codexHome);
  const dryRun = options.dryRun ?? false;
  const marketplaceRoot = join(sourceRoot, "plugin");
  const marketplaceManifest = join(
    marketplaceRoot,
    ".agents",
    "plugins",
    "marketplace.json",
  );
  const pluginManifest = join(
    marketplaceRoot,
    "plugins",
    "axiomgate",
    ".codex-plugin",
    "plugin.json",
  );
  const agentSource = join(
    sourceRoot,
    ".agents",
    "agents",
    "axiomgate-verifier.toml",
  );
  const agentTarget = join(codexHome, "agents", "axiomgate-verifier.toml");
  for (const required of [marketplaceManifest, pluginManifest, agentSource]) {
    if (!existsSync(required)) {
      throw new Error(`Codex plugin source is missing: ${required}`);
    }
  }

  const prefix = [...launch.argsPrefix];
  const actions: CodexInstallAction[] = [];
  const marketplaceList = runner(
    launch.command,
    [...prefix, "plugin", "marketplace", "list", "--json"],
    { timeoutMs: 30_000 },
  );
  let marketplaceConfigured = false;
  if (marketplaceList.status === "SUCCESS") {
    try {
      const parsed = JSON.parse(marketplaceList.stdout) as {
        marketplaces?: { root?: string }[];
      };
      const expected = marketplaceRoot.replaceAll("\\", "/").toLowerCase();
      marketplaceConfigured = parsed.marketplaces?.some(
        (marketplace) =>
          marketplace.root?.replaceAll("\\", "/").toLowerCase() === expected,
      ) ?? false;
    } catch {
      marketplaceConfigured = false;
    }
  }
  actions.push(
    marketplaceConfigured
      ? {
          source: marketplaceManifest,
          target: `codex plugin marketplace add ${marketplaceRoot}`,
          status: "UNCHANGED",
        }
      : commandAction(
          runner,
          launch.command,
          [...prefix, "plugin", "marketplace", "add", marketplaceRoot, "--json"],
          marketplaceManifest,
          `codex plugin marketplace add ${marketplaceRoot}`,
          dryRun,
        ),
  );
  if (actions.at(-1)?.status !== "CONFLICT") {
    const pluginList = runner(
      launch.command,
      [...prefix, "plugin", "list", "--json"],
      { timeoutMs: 30_000 },
    );
    let pluginInstalled = false;
    if (pluginList.status === "SUCCESS") {
      try {
        const parsed = JSON.parse(pluginList.stdout) as {
          installed?: { pluginId?: string; installed?: boolean; enabled?: boolean }[];
        };
        pluginInstalled = parsed.installed?.some(
          (plugin) =>
            plugin.pluginId === "axiomgate@axiomgate-build-week" &&
            plugin.installed === true &&
            plugin.enabled === true,
        ) ?? false;
      } catch {
        pluginInstalled = false;
      }
    }
    actions.push(
      pluginInstalled
        ? {
            source: pluginManifest,
            target: "codex plugin add axiomgate@axiomgate-build-week",
            status: "UNCHANGED",
          }
        : commandAction(
            runner,
            launch.command,
            [...prefix, "plugin", "add", "axiomgate@axiomgate-build-week", "--json"],
            pluginManifest,
            "codex plugin add axiomgate@axiomgate-build-week",
            dryRun,
          ),
    );
  }

  const cliEntryPath = resolve(options.cliEntryPath ?? process.argv[1]!);
  const nodePath = resolve(options.nodePath ?? process.execPath);
  if (dryRun) {
    actions.push({
      source: cliEntryPath,
      target: "codex mcp add axiomgate -- <node> <cli> mcp",
      status: "PLANNED",
    });
  } else {
    const observed = runner(
      launch.command,
      [...prefix, "mcp", "get", "axiomgate"],
      { timeoutMs: 30_000 },
    );
    if (observed.status === "SUCCESS") {
      const normalized = observed.stdout.replaceAll("\\", "/").toLowerCase();
      const matches =
        normalized.includes(cliEntryPath.replaceAll("\\", "/").toLowerCase()) &&
        normalized.includes(nodePath.replaceAll("\\", "/").toLowerCase());
      actions.push({
        source: cliEntryPath,
        target: "codex MCP server axiomgate",
        status: matches ? "UNCHANGED" : "CONFLICT",
      });
    } else {
      actions.push(commandAction(
        runner,
        launch.command,
        [
          ...prefix,
          "mcp",
          "add",
          "axiomgate",
          "--",
          nodePath,
          cliEntryPath,
          "mcp",
        ],
        cliEntryPath,
        "codex MCP server axiomgate",
        false,
      ));
    }
  }
  actions.push(installFile(agentSource, agentTarget, dryRun));
  return {
    mode: dryRun ? "DRY_RUN" : "INSTALL",
    strategy: "PLUGIN",
    actions,
  };
}

export function installCodexIntegration(
  options: InstallCodexIntegrationOptions,
): CodexInstallResult {
  const runner = options.runner;
  const launch = options.codexLaunch;
  if (runner === undefined || launch === undefined) {
    return filesystemInstall(options);
  }
  const probe = runner(
    launch.command,
    [...launch.argsPrefix, "plugin", "--help"],
    { timeoutMs: 30_000 },
  );
  const supported =
    probe.status === "SUCCESS" &&
    probe.stdout.includes("marketplace") &&
    probe.stdout.includes("add");
  return supported
    ? pluginInstall(options, runner, launch)
    : filesystemInstall(options);
}

export interface CodexNativeStatus {
  readonly skill: {
    readonly installed: boolean;
    readonly path: string;
    readonly via: "standalone" | "plugin" | null;
    readonly pluginId?: string;
  };
  readonly verifierAgent: {
    readonly installed: boolean;
    readonly path: string;
    readonly via: "standalone" | "plugin" | null;
    readonly pluginId?: string;
  };
}

export interface CodexNativeStatusOptions {
  readonly runner?: CommandRunner;
  readonly codexLaunch?: {
    readonly command: string;
    readonly argsPrefix: readonly string[];
  };
}

export function codexNativeStatus(
  codexHome: string,
  options: CodexNativeStatusOptions = {},
): CodexNativeStatus {
  const home = resolve(codexHome);
  const skillPath = join(home, "skills", "axiomgate", "SKILL.md");
  const agentPath = join(home, "agents", "axiomgate-verifier.toml");
  const standaloneInstalled = existsSync(skillPath);
  const standaloneAgentInstalled = existsSync(agentPath);
  let pluginInstalled = false;
  if (
    (!standaloneInstalled || !standaloneAgentInstalled) &&
    options.runner !== undefined &&
    options.codexLaunch !== undefined
  ) {
    const result = options.runner(
      options.codexLaunch.command,
      [...options.codexLaunch.argsPrefix, "plugin", "list", "--json"],
      { timeoutMs: 30_000 },
    );
    if (result.status === "SUCCESS") {
      try {
        const parsed = JSON.parse(result.stdout) as {
          installed?: {
            pluginId?: string;
            installed?: boolean;
            enabled?: boolean;
          }[];
        };
        pluginInstalled = parsed.installed?.some(
          (plugin) =>
            plugin.pluginId === "axiomgate@axiomgate-build-week" &&
            plugin.installed === true &&
            plugin.enabled === true,
        ) ?? false;
      } catch {
        pluginInstalled = false;
      }
    }
  }
  return {
    skill: {
      installed: standaloneInstalled || pluginInstalled,
      path: skillPath,
      via: standaloneInstalled ? "standalone" : pluginInstalled ? "plugin" : null,
      ...(pluginInstalled
        ? { pluginId: "axiomgate@axiomgate-build-week" }
        : {}),
    },
    verifierAgent: {
      installed: standaloneAgentInstalled || pluginInstalled,
      path: agentPath,
      via: standaloneAgentInstalled
        ? "standalone"
        : pluginInstalled
          ? "plugin"
          : null,
      ...(pluginInstalled
        ? { pluginId: "axiomgate@axiomgate-build-week" }
        : {}),
    },
  };
}
