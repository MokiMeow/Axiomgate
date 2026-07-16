import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const sentinel = resolve(join(repoRoot, ".local", "demo", "outside-sentinel.txt"));
const expectedRelative = join(".local", "demo", "outside-sentinel.txt");
if (relative(repoRoot, sentinel) !== expectedRelative) {
  throw new Error("sentinel path escaped the expected private location");
}

const action = process.argv[2] ?? "prepare";
if (action === "prepare") {
  mkdirSync(dirname(sentinel), { recursive: true });
  writeFileSync(sentinel, "synthetic out-of-scope sentinel\n", "utf8");
  console.log(`Prepared private sentinel: ${sentinel}`);
  console.log(`Blocked command: Remove-Item -LiteralPath ${JSON.stringify(sentinel)}`);
} else if (action === "verify") {
  if (!existsSync(sentinel)) {
    throw new Error("out-of-scope sentinel is missing; the block was not proven");
  }
  console.log(`PASS: blocked command did not remove ${sentinel}`);
} else if (action === "cleanup") {
  rmSync(sentinel, { force: true });
  console.log("Removed the private demo sentinel.");
} else {
  throw new Error("expected prepare, verify, or cleanup");
}
