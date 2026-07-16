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
  installCodexIntegration,
  parseCodexAgentDefinition,
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
