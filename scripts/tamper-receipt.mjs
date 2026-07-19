import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const input = process.argv[2];
const output = process.argv[3];

if (input === undefined || output === undefined) {
  console.error("Usage: node scripts/tamper-receipt.mjs <input.json> <output.json>");
  process.exitCode = 1;
} else {
  const parsed = JSON.parse(readFileSync(resolve(input), "utf8"));
  const first = parsed.evidenceRecords?.[0]?.record;
  if (first === undefined || typeof first.outputHash !== "string") {
    throw new Error("receipt has no evidence record to tamper");
  }
  first.outputHash = `sha256:${"c".repeat(64)}`;
  const target = resolve(output);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(`Tampered receipt written: ${output}`);
}
