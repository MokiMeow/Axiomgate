import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createLoginServer } from "../src/app.js";

if (typeof createLoginServer !== "function") {
  throw new Error("login server export is unavailable");
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const sources = ["app.js", "server.js"];
mkdirSync(output, { recursive: true });

const hashes = {};
for (const source of sources) {
  const sourcePath = join(root, "src", source);
  const outputPath = join(output, source);
  const content = readFileSync(sourcePath);
  copyFileSync(sourcePath, outputPath);
  hashes[source] = createHash("sha256").update(content).digest("hex");
}

writeFileSync(
  join(output, "build-manifest.json"),
  `${JSON.stringify({ format: "node-esm", files: hashes }, null, 2)}\n`,
  "utf8",
);
console.log(`Built ${sources.length} server modules into dist/`);
