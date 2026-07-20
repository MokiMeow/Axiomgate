import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard section experience", () => {
  it("renders feedback immediately and reuses recent data during tab changes", async () => {
    const sections = await readFile(resolve("apps/web/public/sections.js"), "utf8");

    expect(sections).toContain("function renderLoading");
    expect(sections).toContain("renderLoading(view, key);");
    expect(sections).toContain("renderActive(false, false)");
    expect(sections).toContain("const CAPACITY_CACHE_MS = 60_000;");
    expect(sections).toContain("isCacheFresh(capacityCache.at, CAPACITY_CACHE_MS)");
  });

  it("uses compact mobile navigation and card-like receipt rows", async () => {
    const [sections, styles] = await Promise.all([
      readFile(resolve("apps/web/public/sections.js"), "utf8"),
      readFile(resolve("apps/web/public/styles.css"), "utf8"),
    ]);

    expect(sections).toContain('const table = E("table", "receipt-table")');
    expect(sections).toContain('data-label="Mission"');
    expect(sections).toContain(".sect-nav {");
    expect(sections).toContain("flex-wrap: nowrap;");
    expect(sections).toContain("overflow-x: auto;");
    expect(styles).toContain(".receipt-table tr.receipt-record");
    expect(styles).toContain("content: attr(data-label);");
    expect(styles).toContain("align-self: start;");
    expect(styles).toContain("grid-template-rows: max-content 1fr;");
  });
});
