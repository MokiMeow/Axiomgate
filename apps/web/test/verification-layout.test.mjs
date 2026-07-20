import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("verification remediation layout", () => {
  it("isolates long run ids from descriptions and verdict badges", async () => {
    const [app, styles] = await Promise.all([
      readFile(resolve("apps/web/public/app.js"), "utf8"),
      readFile(resolve("apps/web/public/styles.css"), "utf8"),
    ]);

    expect(app).toContain('"phase-row verification-row"');
    expect(styles).toContain(".verification-row {");
    expect(styles).toContain("grid-template-columns: minmax(128px, 0.48fr) minmax(220px, 1fr) auto;");
    expect(styles).toContain("overflow-wrap: anywhere;");
    expect(styles).toContain("grid-column: 1 / -1;");
  });
});
