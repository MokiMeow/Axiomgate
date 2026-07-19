import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  platformCommand,
  runCommand,
} from "./lib/command.mjs";

const dryRun = process.argv.includes("--dry-run");
const npm = platformCommand("npm");
const npx = platformCommand("npx");

if (dryRun) {
  console.log("DRY RUN (no registry request)");
  console.log("CHECK 1: npm view axiomgate version --registry=https://registry.npmjs.org/ --json");
  console.log("CHECK 2: npx -y axiomgate@latest doctor");
  process.exit(0);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "axiomgate-published-"));
let failed = false;

function report(label, result, validate) {
  const accepted = result.status === "SUCCESS" && validate(result);
  console.log(`${accepted ? "PASS" : "FAIL"} ${label}`);
  const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  if (output.length > 0) console.log(output.replaceAll(temporaryRoot, "<temp>"));
  if (!accepted) failed = true;
}

try {
  const version = runCommand(
    npm,
    ["view", "axiomgate", "version", "--registry=https://registry.npmjs.org/", "--json"],
    { cwd: temporaryRoot, timeoutMs: 60_000 },
  );
  report("registry exposes axiomgate version", version, (result) => {
    try {
      return typeof JSON.parse(result.stdout) === "string";
    } catch {
      return false;
    }
  });

  const doctor = runCommand(npx, ["-y", "axiomgate@latest", "doctor"], {
    cwd: temporaryRoot,
    env: { ...process.env, CODEX_HOME: join(temporaryRoot, "codex-home"), FORCE_COLOR: "0", NO_COLOR: "1" },
    timeoutMs: 120_000,
  });
  report(
    "fresh npx doctor",
    doctor,
    (result) => result.stdout.includes("doctor") && result.stdout.includes("Node"),
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.exitCode = failed ? 1 : 0;
