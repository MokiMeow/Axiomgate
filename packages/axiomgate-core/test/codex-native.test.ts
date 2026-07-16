import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
