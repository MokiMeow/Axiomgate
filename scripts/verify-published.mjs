import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  platformCommand,
  runCommand,
} from "./lib/command.mjs";

const dryRun = process.argv.includes("--dry-run");
const expectedVersion = "0.1.1";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receiptFixture = join(repositoryRoot, "scripts", "fixtures", "publish-receipt.json");
const npm = platformCommand("npm");
const npx = platformCommand("npx");
const gh = platformCommand("gh");
const git = platformCommand("git");

if (dryRun) {
  console.log("DRY RUN (no registry request)");
  console.log(`CHECK 1: npm view axiomgate version equals ${expectedVersion}`);
  console.log(`CHECK 2: npx -y axiomgate@${expectedVersion} doctor`);
  console.log(`CHECK 3: npx -y axiomgate@${expectedVersion} replay evidence-gate`);
  console.log("CHECK 4: published receipt verify PASS and tampered FAIL");
  console.log("CHECK 5: GitHub main equals local HEAD and README contains the 0.1.1 quickstart");
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

function reportExpectedFailure(label, result, validate) {
  const accepted = result.status === "FAILED" && result.exitCode !== 0 && validate(result);
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
      return JSON.parse(result.stdout) === expectedVersion;
    } catch {
      return false;
    }
  });

  const doctor = runCommand(npx, ["-y", `axiomgate@${expectedVersion}`, "doctor"], {
    cwd: temporaryRoot,
    env: { ...process.env, CODEX_HOME: join(temporaryRoot, "codex-home"), FORCE_COLOR: "0", NO_COLOR: "1" },
    timeoutMs: 120_000,
  });
  report(
    "fresh npx doctor",
    doctor,
    (result) => result.stdout.includes("doctor") && result.stdout.includes("Node"),
  );

  const replay = runCommand(npx, ["-y", `axiomgate@${expectedVersion}`, "replay", "evidence-gate"], {
    cwd: temporaryRoot,
    env: { ...process.env, CODEX_HOME: join(temporaryRoot, "codex-home"), FORCE_COLOR: "0", NO_COLOR: "1" },
    timeoutMs: 120_000,
  });
  report(
    "fresh npx individual evidence-gate replay",
    replay,
    (result) => result.stdout.includes("INCOMPLETE / UNVERIFIED") && result.stdout.includes("PASS"),
  );

  const receipt = join(temporaryRoot, "receipt.json");
  const tamperedReceipt = join(temporaryRoot, "receipt-tampered.json");
  copyFileSync(receiptFixture, receipt);
  const tampered = JSON.parse(readFileSync(receipt, "utf8"));
  tampered.evidenceRecords[0].record.outputHash = `sha256:${"d".repeat(64)}`;
  writeFileSync(tamperedReceipt, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");

  const valid = runCommand(npx, ["-y", `axiomgate@${expectedVersion}`, "receipt", "verify", receipt], {
    cwd: temporaryRoot,
    timeoutMs: 120_000,
  });
  report(
    "published receipt verification accepts intact fixture",
    valid,
    (result) => result.stdout.includes("PASS") && result.stdout.includes("RECEIPT INTEGRITY"),
  );

  const invalid = runCommand(npx, ["-y", `axiomgate@${expectedVersion}`, "receipt", "verify", tamperedReceipt], {
    cwd: temporaryRoot,
    timeoutMs: 120_000,
  });
  reportExpectedFailure(
    "published receipt verification rejects tampered fixture",
    invalid,
    (result) => `${result.stdout}\n${result.stderr}`.includes("FAIL"),
  );

  const localHead = runCommand(git, ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    timeoutMs: 30_000,
  });
  report("local release head is readable", localHead, (result) => /^[0-9a-f]{40}\s*$/u.test(result.stdout));

  const githubHead = runCommand(gh, ["api", "repos/MokiMeow/Axiomgate/commits/main", "--jq", ".sha"], {
    cwd: temporaryRoot,
    timeoutMs: 60_000,
  });
  report(
    "GitHub main matches local release head",
    githubHead,
    (result) => result.stdout.trim() === localHead.stdout.trim(),
  );

  const githubReadme = runCommand(gh, [
    "api",
    "repos/MokiMeow/Axiomgate/readme",
    "-H",
    "Accept: application/vnd.github.raw+json",
  ], {
    cwd: temporaryRoot,
    timeoutMs: 60_000,
  });
  report(
    "GitHub README exposes the 0.1.1 quickstart",
    githubReadme,
    (result) => result.stdout.includes("# AxiomGate") && result.stdout.includes("axiomgate@0.1.1"),
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.exitCode = failed ? 1 : 0;
