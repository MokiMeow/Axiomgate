import {
  copyFileSync,
  existsSync,
  mkdirSync,
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
  requireSuccess,
  runCommand,
} from "./lib/command.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repositoryRoot, "apps", "cli");
const fixturePath = join(repositoryRoot, "scripts", "fixtures", "publish-receipt.json");
const temporaryRoot = mkdtempSync(join(tmpdir(), "axiomgate-pack-"));
const packDirectory = join(temporaryRoot, "pack");
const installDirectory = join(temporaryRoot, "installed");
const isolatedCodexHome = join(temporaryRoot, "codex-home");

function sanitize(value) {
  return value.replaceAll(temporaryRoot, "<temp>");
}

function printResult(label, result) {
  console.log(`\n=== ${label} (exit=${result.exitCode ?? "none"}, ${result.durationMs}ms) ===`);
  const output = sanitize([result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n"));
  if (output.length > 0) console.log(output);
}

function parsePackOutput(stdout) {
  const start = stdout.lastIndexOf("\n[");
  const value = JSON.parse(start === -1 ? stdout : stdout.slice(start + 1));
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("npm pack did not return one package record");
  }
  return value[0];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  mkdirSync(packDirectory, { recursive: true });
  mkdirSync(installDirectory, { recursive: true });
  mkdirSync(isolatedCodexHome, { recursive: true });

  const npm = platformCommand("npm");
  const packed = requireSuccess(
    "npm pack",
    runCommand(npm, ["pack", "--json", "--pack-destination", packDirectory], {
      cwd: packageRoot,
      timeoutMs: 120_000,
    }),
  );
  printResult("npm pack", packed);
  const pack = parsePackOutput(packed.stdout);
  assert(pack.name === "axiomgate" && pack.version === "0.1.2", "unexpected package identity");
  const packedPaths = pack.files.map((file) => file.path).sort();
  assert(
    JSON.stringify(packedPaths) === JSON.stringify(["README.md", "dist/index.js", "package.json"]),
    `unexpected tarball contents: ${packedPaths.join(", ")}`,
  );
  const tarball = join(packDirectory, pack.filename);
  assert(existsSync(tarball), "npm pack did not create the reported tarball");

  writeFileSync(
    join(installDirectory, "package.json"),
    `${JSON.stringify({ name: "axiomgate-packed-proof", private: true }, null, 2)}\n`,
    "utf8",
  );
  const installed = requireSuccess(
    "tarball install",
    runCommand(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarball], {
      cwd: installDirectory,
      timeoutMs: 120_000,
    }),
  );
  printResult("fresh tarball install", installed);

  const installedManifest = JSON.parse(
    readFileSync(join(installDirectory, "node_modules", "axiomgate", "package.json"), "utf8"),
  );
  assert(installedManifest.dependencies === undefined, "published manifest has runtime dependencies");
  assert(installedManifest.engines?.node === ">=20", "published manifest has the wrong Node engine");

  const shim = join(
    installDirectory,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "axiomgate.cmd" : "axiomgate",
  );
  assert(existsSync(shim), "installed axiomgate command shim is missing");
  const environment = {
    ...process.env,
    CODEX_HOME: isolatedCodexHome,
    FORCE_COLOR: "0",
    NO_COLOR: "1",
  };

  const help = requireSuccess(
    "axiomgate --help",
    runCommand(shim, ["--help"], { cwd: installDirectory, env: environment, timeoutMs: 30_000 }),
  );
  assert(help.stdout.includes("axiomgate receipt verify"), "help output omitted receipt verification");
  printResult("installed axiomgate --help", help);

  const doctor = requireSuccess(
    "axiomgate doctor",
    runCommand(shim, ["doctor"], { cwd: installDirectory, env: environment, timeoutMs: 45_000 }),
  );
  assert(doctor.stdout.includes("doctor") && doctor.stdout.includes("Node"), "doctor output was incomplete");
  printResult("installed axiomgate doctor", doctor);

  const wrongTarget = requireSuccess(
    "wrong-target replay",
    runCommand(shim, ["replay", "wrong-target"], {
      cwd: installDirectory,
      env: environment,
      timeoutMs: 30_000,
    }),
  );
  assert(
    wrongTarget.stdout.includes("EXISTS_NOT_OWNED") && wrongTarget.stdout.includes("PASS"),
    "individual wrong-target replay did not pass",
  );
  printResult("installed replay wrong-target", wrongTarget);

  const copiedReceipt = join(installDirectory, "receipt.json");
  copyFileSync(fixturePath, copiedReceipt);
  const validReceipt = requireSuccess(
    "valid receipt verification",
    runCommand(shim, ["receipt", "verify", copiedReceipt], {
      cwd: installDirectory,
      env: environment,
      timeoutMs: 30_000,
    }),
  );
  assert(validReceipt.stdout.includes("PASS") && validReceipt.stdout.includes("RECEIPT INTEGRITY"), "valid receipt did not pass");
  printResult("installed receipt verify (intact)", validReceipt);

  const tamperedReceipt = join(installDirectory, "receipt-tampered.json");
  const tampered = JSON.parse(readFileSync(copiedReceipt, "utf8"));
  tampered.evidenceRecords[0].record.outputHash = `sha256:${"c".repeat(64)}`;
  writeFileSync(tamperedReceipt, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
  const invalidReceipt = runCommand(shim, ["receipt", "verify", tamperedReceipt], {
    cwd: installDirectory,
    env: environment,
    timeoutMs: 30_000,
  });
  assert(invalidReceipt.status === "FAILED" && invalidReceipt.exitCode !== 0, "tampered receipt unexpectedly succeeded");
  assert(`${invalidReceipt.stdout}\n${invalidReceipt.stderr}`.includes("FAIL"), "tampered receipt did not report FAIL");
  printResult("installed receipt verify (tampered)", invalidReceipt);

  const mcpInput = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "publish-proof", version: "1" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "axiomgate_receipt_verify", arguments: { file: copiedReceipt } } },
  ].map((message) => JSON.stringify(message)).join("\n") + "\n";
  const mcp = requireSuccess(
    "MCP stdio probe",
    runCommand(shim, ["mcp"], {
      cwd: installDirectory,
      env: environment,
      input: mcpInput,
      timeoutMs: 30_000,
    }),
  );
  const responses = mcp.stdout.trim().split(/\r?\n/u).map((line) => JSON.parse(line));
  const initialized = responses.find((response) => response.id === 1);
  const tools = responses.find((response) => response.id === 2);
  const toolCall = responses.find((response) => response.id === 3);
  assert(initialized?.result?.serverInfo?.version === "0.1.2", "MCP server version mismatch");
  assert(tools?.result?.tools?.length === 6, "MCP tools/list did not return six tools");
  const toolPayload = JSON.parse(toolCall?.result?.content?.[0]?.text ?? "null");
  assert(toolPayload?.valid === true, "MCP receipt verification did not return valid=true");
  printResult("installed MCP initialize + tools/list + receipt call", mcp);

  console.log("\nPASS packed distribution: clean tarball, installed shim, individual replay, receipt tamper detection, and MCP stdio.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
