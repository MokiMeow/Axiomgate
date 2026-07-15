import { z } from "zod";

const RawPatchPilotFindingSchema = z.object({
  package: z.string().min(1),
  ecosystem: z.string().min(1),
  currentVersion: z.string().min(1),
  fixedVersion: z.string().min(1),
  severity: z.string().min(1),
  advisory: z.string().min(1),
  dependencyType: z.string().min(1),
  reachability: z.string().min(1),
  reachabilityNote: z.string().min(1),
});

const RawPatchPilotOutputSchema = z.object({
  target: z.string().min(1),
  scanner: z.string().min(1),
  count: z.number().int().nonnegative(),
  findings: z.array(RawPatchPilotFindingSchema),
});

export const PatchPilotFindingSchema = z.strictObject({
  package: z.string().min(1),
  ecosystem: z.string().min(1),
  version: z.string().min(1),
  fixedVersion: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low", "unknown"]),
  advisory: z.string().min(1),
  dependencyType: z.string().min(1),
  reachability: z.enum(["reachable", "likely_unused", "unknown"]),
  reachabilityNote: z.string().min(1),
});

export type PatchPilotFinding = z.infer<typeof PatchPilotFindingSchema>;

export type PatchPilotParseResult =
  | {
      readonly status: "VALID";
      readonly scanner: string;
      readonly findings: readonly PatchPilotFinding[];
    }
  | {
      readonly status: "UNKNOWN";
      readonly findings: readonly [];
      readonly reason: string;
    };

function severity(value: string): PatchPilotFinding["severity"] {
  const normalized = value.toLowerCase();
  return normalized === "critical" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
    ? normalized
    : "unknown";
}

function reachability(value: string): PatchPilotFinding["reachability"] {
  const normalized = value.toLowerCase();
  if (normalized === "imported" || normalized === "reachable") {
    return "reachable";
  }
  if (normalized === "unused" || normalized === "transitive") {
    return "likely_unused";
  }
  return "unknown";
}

export function parsePatchPilotOutput(output: string): PatchPilotParseResult {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    return {
      status: "UNKNOWN",
      findings: [],
      reason: "PatchPilot output is not valid JSON",
    };
  }
  const parsed = RawPatchPilotOutputSchema.safeParse(value);
  if (!parsed.success || parsed.data.count !== parsed.data.findings.length) {
    return {
      status: "UNKNOWN",
      findings: [],
      reason: "PatchPilot output does not match the v0.1.3 JSON contract",
    };
  }
  return {
    status: "VALID",
    scanner: parsed.data.scanner,
    findings: parsed.data.findings.map((finding) =>
      PatchPilotFindingSchema.parse({
        package: finding.package,
        ecosystem: finding.ecosystem,
        version: finding.currentVersion,
        fixedVersion: finding.fixedVersion,
        severity: severity(finding.severity),
        advisory: finding.advisory,
        dependencyType: finding.dependencyType,
        reachability: reachability(finding.reachability),
        reachabilityNote: finding.reachabilityNote,
      }),
    ),
  };
}

export function patchPilotArgs(workspace: string): readonly string[] {
  return [
    "--yes",
    "patchpilot-cli@0.1.3",
    "scan",
    workspace,
    "--json",
    "--fail-on",
    "low",
  ];
}
