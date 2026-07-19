import { describe, expect, it } from "vitest";

import { createUi } from "../src/ui.js";

describe("terminal presentation", () => {
  it("disables ANSI when NO_COLOR is set", () => {
    const output = createUi({ isTTY: true, noColor: true }).header("doctor");
    expect(output).not.toContain("\u001b[");
    expect(output).toContain("AXIOMGATE");
  });

  it("disables ANSI and uses ASCII glyphs outside a TTY", () => {
    const terminal = createUi({ isTTY: false, noColor: false });
    expect(terminal.colorEnabled).toBe(false);
    expect(terminal.glyph("success")).toBe("[OK]");
    expect(terminal.glyph("failure")).toBe("[X]");
    expect(terminal.glyph("warning")).toBe("[!]");
    expect(terminal.glyph("neutral")).toBe("[-]");
  });

  it("maps verdict glyphs and emits ANSI in a color TTY", () => {
    const terminal = createUi({ isTTY: true, noColor: false });
    expect(terminal.glyph("success")).toContain("✓");
    expect(terminal.glyph("failure")).toContain("✕");
    expect(terminal.glyph("warning")).toContain("▲");
    expect(terminal.glyph("neutral")).toContain("·");
    expect(terminal.glyph("success")).toContain("\u001b[");
  });

  it("aligns key/value rows and tables", () => {
    const terminal = createUi({ isTTY: false });
    expect(
      terminal.rows([
        { key: "Node", value: "v24" },
        { key: "Codex CLI", value: "0.144.6" },
      ]),
    ).toBe("Node       v24\nCodex CLI  0.144.6");
    expect(
      terminal.table(
        ["Criterion", "Verdict"],
        [["lockout", "PASS"], ["security", "UNKNOWN"]],
      ),
    ).toBe(
      "Criterion  Verdict\nlockout    PASS\nsecurity   UNKNOWN",
    );
  });
});
