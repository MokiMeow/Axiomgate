import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  commandStatusToCheckState,
  detectNativeChecks,
  parsePatchPilotOutput,
  scanDiffForSecrets,
} from "../src/index.js";

describe("native project checks", () => {
  it("detects npm test/build scripts and Python pytest without inventing commands", () => {
    const workspace = mkdtempSync(join(tmpdir(), "axiomgate-check-detect-"));
    try {
      writeFileSync(
        join(workspace, "package.json"),
        JSON.stringify({
          scripts: {
            test: "node --test",
            "test:lockout": "node --test spec/lockout.behavior.mjs",
            build: "tsc",
          },
        }),
        "utf8",
      );
      writeFileSync(join(workspace, "requirements.txt"), "pytest==8.4.0\n", "utf8");

      expect(detectNativeChecks(workspace)).toEqual([
        { kind: "target.test", command: "npm", args: ["test"] },
        {
          kind: "target.lockout-test",
          command: "npm",
          args: ["run", "test:lockout"],
        },
        { kind: "target.build", command: "npm", args: ["run", "build"] },
        { kind: "target.test", command: "python", args: ["-m", "pytest"] },
      ]);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it.each([
    ["SUCCESS", "PASS"],
    ["FAILED", "FAIL"],
    ["UNAVAILABLE", "UNKNOWN"],
    ["TIMED_OUT", "BLOCKED"],
  ] as const)("maps command status %s to %s", (status, expected) => {
    expect(commandStatusToCheckState(status)).toBe(expected);
  });
});

describe("parsePatchPilotOutput", () => {
  it("parses the real captured v0.1.3 JSON shape into typed findings", () => {
    const result = parsePatchPilotOutput(
      readFileSync(
        join(import.meta.dirname, "fixtures", "patchpilot-scan-real.json"),
        "utf8",
      ),
    );

    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.scanner).toBe("osv-api");
      expect(result.findings).toHaveLength(7);
      expect(result.findings[0]).toEqual({
        package: "lodash",
        ecosystem: "npm",
        version: "4.17.11",
        fixedVersion: "4.6.1",
        severity: "critical",
        advisory: "GHSA-jf85-cpcp-j695",
        dependencyType: "direct",
        reachability: "reachable",
        reachabilityNote:
          "Imported in first-party source — treat as reachable.",
      });
    }
  });

  it("returns UNKNOWN for malformed scan output instead of crashing", () => {
    expect(parsePatchPilotOutput("not-json")).toEqual({
      status: "UNKNOWN",
      findings: [],
      reason: "PatchPilot output is not valid JSON",
    });
  });
});

describe("scanDiffForSecrets", () => {
  it("flags a planted fake credential pattern and labels the fallback heuristic", () => {
    expect(
      scanDiffForSecrets(
        '+const api_key = "AXIOMGATE_FAKE_0123456789ABCDEF";\n',
      ),
    ).toMatchObject({
      status: "FAIL",
      scanner: "builtin-regex-heuristic",
      findings: [
        expect.objectContaining({
          line: 1,
          pattern: "assigned-credential",
        }),
      ],
    });
  });

  it("does not flag a clean diff", () => {
    expect(scanDiffForSecrets('+console.log("hello");\n')).toEqual({
      status: "PASS",
      scanner: "builtin-regex-heuristic",
      findings: [],
    });
  });
});
