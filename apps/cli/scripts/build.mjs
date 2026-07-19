import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(packageRoot, "dist");

rmSync(outputDirectory, { recursive: true, force: true });

await build({
  entryPoints: [resolve(packageRoot, "src", "index.ts")],
  outfile: resolve(outputDirectory, "index.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  legalComments: "none",
  logLevel: "info",
});
