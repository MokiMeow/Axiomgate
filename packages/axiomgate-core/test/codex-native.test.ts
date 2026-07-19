import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  codexNativeStatus,
  installCodexIntegration,
  parseCodexAgentDefinition,
  type CommandRunner,
} from "../src/index.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function frontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
  if (match === null) return {};
  return Object.fromEntries(
    match[1]!
      .split(/\r?\n/u)
      .flatMap((line) => {
        const separator = line.indexOf(":");
        return separator < 0
          ? []
          : [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]];
      }),
  );
}

describe("AxiomGate Codex skill", () => {
  it("has discoverable metadata and references only implemented CLI workflows", () => {
    const skill = readFileSync(
      resolve(repositoryRoot, ".agents/skills/axiomgate/SKILL.md"),
      "utf8",
    );
    const metadata = frontmatter(skill);
    expect(metadata.name).toBe("axiomgate-governance");
    expect(metadata.description).toContain("identity");
    expect(metadata.description).toContain("authority");
    expect(metadata.description).toContain("evidence");

    const commands = [...skill.matchAll(/`(axiomgate [^`]+)`/gu)].map(
      (match) => match[1],
    );
    expect(commands).toEqual([
      "axiomgate mission verify <id>",
      "axiomgate mission status <id>",
    ]);
    const cli = readFileSync(resolve(repositoryRoot, "apps/cli/src/index.ts"), "utf8");
    for (const command of commands) {
      const words = command!.replace(/ <id>$/u, "").split(" ");
      expect(cli).toContain(`missionCommand === "${words.at(-1)}"`);
    }
  });
});

describe("AxiomGate verifier agent", () => {
  it("is a schema-valid, read-only independent verifier", () => {
    const definition = parseCodexAgentDefinition(
      readFileSync(
        resolve(repositoryRoot, ".agents/agents/axiomgate-verifier.toml"),
        "utf8",
      ),
    );
    expect(definition).toMatchObject({
      name: "axiomgate-verifier",
      model: "gpt-5.6-terra",
      model_reasoning_effort: "high",
      sandbox_mode: "read-only",
    });
    expect(definition.description.toLowerCase()).toContain("independent");
    expect(definition.developer_instructions).toContain("Do not modify files");
  });

  it("plans exact paths, installs idempotently, and preserves unrelated files", () => {
    const codexHome = mkdtempSync(join(tmpdir(), "axiomgate-codex-home-"));
    const unrelated = join(codexHome, "unrelated.txt");
    writeFileSync(unrelated, "keep me\n", "utf8");
    try {
      const dryRun = installCodexIntegration({
        sourceRoot: repositoryRoot,
        codexHome,
        dryRun: true,
      });
      expect(dryRun.actions).toEqual([
        expect.objectContaining({
          target: join(codexHome, "skills", "axiomgate", "SKILL.md"),
          status: "PLANNED",
        }),
        expect.objectContaining({
          target: join(
            codexHome,
            "skills",
            "axiomgate",
            "agents",
            "openai.yaml",
          ),
          status: "PLANNED",
        }),
        expect.objectContaining({
          target: join(codexHome, "agents", "axiomgate-verifier.toml"),
          status: "PLANNED",
        }),
      ]);
      expect(existsSync(join(codexHome, "skills", "axiomgate"))).toBe(false);

      const installed = installCodexIntegration({
        sourceRoot: repositoryRoot,
        codexHome,
      });
      expect(installed.actions.map((action) => action.status)).toEqual([
        "WRITTEN",
        "WRITTEN",
        "WRITTEN",
      ]);
      const second = installCodexIntegration({
        sourceRoot: repositoryRoot,
        codexHome,
      });
      expect(second.actions.map((action) => action.status)).toEqual([
        "UNCHANGED",
        "UNCHANGED",
        "UNCHANGED",
      ]);
      expect(readFileSync(unrelated, "utf8")).toBe("keep me\n");
    } finally {
      rmSync(codexHome, { recursive: true, force: true });
    }
  });
});

describe("AxiomGate Codex plugin", () => {
  it("packages the skill, verifier, and MCP registration in a valid marketplace shape", () => {
    const pluginRoot = resolve(repositoryRoot, "plugin/plugins/axiomgate");
    const manifest = JSON.parse(
      readFileSync(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"),
    ) as Record<string, unknown>;
    const marketplace = JSON.parse(
      readFileSync(
        resolve(repositoryRoot, "plugin/.agents/plugins/marketplace.json"),
        "utf8",
      ),
    ) as { name: string; plugins: { name: string; source: { path: string } }[] };
    const repositoryMarketplace = JSON.parse(
      readFileSync(
        resolve(repositoryRoot, ".agents/plugins/marketplace.json"),
        "utf8",
      ),
    ) as { name: string; plugins: { name: string; source: { path: string } }[] };
    const mcp = JSON.parse(
      readFileSync(resolve(pluginRoot, ".mcp.json"), "utf8"),
    ) as { mcpServers: { axiomgate: { command: string; args: string[] } } };
    expect(manifest).toMatchObject({
      name: "axiomgate",
      skills: "./skills/",
      mcpServers: "./.mcp.json",
      interface: {
        composerIcon: "./assets/axiomgate.svg",
        logo: "./assets/axiomgate.svg",
      },
    });
    expect(manifest.version).toMatch(/^0\.1\.0(?:\+codex\.[0-9A-Za-z.-]+)?$/u);
    expect(existsSync(resolve(pluginRoot, "assets/axiomgate.svg"))).toBe(true);
    expect(marketplace).toMatchObject({
      name: "axiomgate-build-week",
      plugins: [{
        name: "axiomgate",
        source: { path: "./plugins/axiomgate" },
      }],
    });
    expect(mcp.mcpServers.axiomgate).toEqual({
      command: "npx",
      args: ["-y", "axiomgate@latest", "mcp"],
    });
    expect(repositoryMarketplace).toMatchObject({
      name: "axiomgate-build-week",
      plugins: [{
        name: "axiomgate",
        source: { path: "./plugin/plugins/axiomgate" },
      }],
    });
    expect(
      readFileSync(resolve(pluginRoot, "skills/axiomgate/SKILL.md"), "utf8"),
    ).toBe(
      readFileSync(resolve(repositoryRoot, ".agents/skills/axiomgate/SKILL.md"), "utf8"),
    );
    expect(
      readFileSync(resolve(pluginRoot, "agents/axiomgate-verifier.toml"), "utf8"),
    ).toBe(
      readFileSync(resolve(repositoryRoot, ".agents/agents/axiomgate-verifier.toml"), "utf8"),
    );
  });

  it("prefers supported plugin install and is idempotent", () => {
    const codexHome = mkdtempSync(join(tmpdir(), "axiomgate-plugin-home-"));
    let marketplaceInstalled = false;
    let pluginInstalled = false;
    let mcpInstalled = false;
    const cliEntryPath = resolve(repositoryRoot, "apps/cli/dist/index.js");
    const runner: CommandRunner = (command, args) => {
      const key = args.join(" ");
      let status: "SUCCESS" | "FAILED" = "SUCCESS";
      let stdout = "";
      if (key.endsWith("plugin --help")) {
        stdout = "Commands: add marketplace";
      } else if (key.includes("plugin marketplace list --json")) {
        stdout = JSON.stringify({
          marketplaces: marketplaceInstalled
            ? [{ root: resolve(repositoryRoot, "plugin") }]
            : [],
        });
      } else if (key.includes("plugin marketplace add")) {
        marketplaceInstalled = true;
        stdout = "{}";
      } else if (key.includes("plugin list --json")) {
        stdout = JSON.stringify({
          installed: pluginInstalled
            ? [{
                pluginId: "axiomgate@axiomgate-build-week",
                installed: true,
                enabled: true,
              }]
            : [],
        });
      } else if (key.includes("plugin add axiomgate@axiomgate-build-week")) {
        pluginInstalled = true;
        stdout = "{}";
      } else if (key.includes("mcp get axiomgate")) {
        if (mcpInstalled) {
          stdout = `command: ${process.execPath}\nargs: ${cliEntryPath} mcp\n`;
        } else {
          status = "FAILED";
        }
      } else if (key.includes("mcp add axiomgate")) {
        mcpInstalled = true;
      }
      return {
        command,
        args,
        status,
        exitCode: status === "SUCCESS" ? 0 : 1,
        stdout,
        stderr: "",
        durationMs: 1,
      };
    };
    try {
      const dryRun = installCodexIntegration({
        sourceRoot: repositoryRoot,
        codexHome,
        dryRun: true,
        runner,
        codexLaunch: { command: "codex", argsPrefix: [] },
        cliEntryPath,
        nodePath: process.execPath,
      });
      expect(dryRun.strategy).toBe("PLUGIN");
      expect(dryRun.actions.map((action) => action.status)).toEqual([
        "PLANNED",
        "PLANNED",
        "PLANNED",
        "PLANNED",
      ]);
      expect(marketplaceInstalled).toBe(false);
      expect(pluginInstalled).toBe(false);
      expect(mcpInstalled).toBe(false);

      const first = installCodexIntegration({
        sourceRoot: repositoryRoot,
        codexHome,
        runner,
        codexLaunch: { command: "codex", argsPrefix: [] },
        cliEntryPath,
        nodePath: process.execPath,
      });
      expect(first.strategy).toBe("PLUGIN");
      expect(first.actions.map((action) => action.status)).toEqual([
        "WRITTEN",
        "WRITTEN",
        "WRITTEN",
        "WRITTEN",
      ]);
      const second = installCodexIntegration({
        sourceRoot: repositoryRoot,
        codexHome,
        runner,
        codexLaunch: { command: "codex", argsPrefix: [] },
        cliEntryPath,
        nodePath: process.execPath,
      });
      expect(second.actions.map((action) => action.status)).toEqual([
        "UNCHANGED",
        "UNCHANGED",
        "UNCHANGED",
        "UNCHANGED",
      ]);
    } finally {
      rmSync(codexHome, { recursive: true, force: true });
    }
  });

  it("treats an installed and enabled plugin as a healthy skill source", () => {
    const codexHome = mkdtempSync(join(tmpdir(), "axiomgate-plugin-status-"));
    try {
      const runner: CommandRunner = (command, args) => ({
        command,
        args,
        status: "SUCCESS",
        exitCode: 0,
        stdout: JSON.stringify({
          installed: [{
            pluginId: "axiomgate@axiomgate-build-week",
            installed: true,
            enabled: true,
          }],
        }),
        stderr: "",
        durationMs: 1,
      });
      const status = codexNativeStatus(codexHome, {
          runner,
          codexLaunch: { command: "codex", argsPrefix: [] },
        });
      expect(status.skill).toMatchObject({
        installed: true,
        via: "plugin",
        pluginId: "axiomgate@axiomgate-build-week",
      });
      expect(status.verifierAgent).toMatchObject({
        installed: true,
        via: "plugin",
        pluginId: "axiomgate@axiomgate-build-week",
      });
    } finally {
      rmSync(codexHome, { recursive: true, force: true });
    }
  });
});
