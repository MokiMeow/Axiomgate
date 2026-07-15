import { z } from "zod";

export const SecretFindingSchema = z.strictObject({
  line: z.number().int().positive(),
  pattern: z.enum(["aws-access-key", "assigned-credential"]),
  detail: z.string().min(1),
});

export type SecretFinding = z.infer<typeof SecretFindingSchema>;

export const SecretScanResultSchema = z.strictObject({
  status: z.enum(["PASS", "FAIL"]),
  scanner: z.literal("builtin-regex-heuristic"),
  findings: z.array(SecretFindingSchema),
});

export type SecretScanResult = z.infer<typeof SecretScanResultSchema>;

export function scanDiffForSecrets(diff: string): SecretScanResult {
  const findings: SecretFinding[] = [];
  for (const [index, line] of diff.split(/\r?\n/u).entries()) {
    if (!line.startsWith("+") || line.startsWith("+++")) {
      continue;
    }
    if (/\bAKIA[0-9A-Z]{16}\b/u.test(line)) {
      findings.push({
        line: index + 1,
        pattern: "aws-access-key",
        detail: "Added line matches an AWS access-key identifier pattern",
      });
    }
    if (
      /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/iu.test(
        line,
      )
    ) {
      findings.push({
        line: index + 1,
        pattern: "assigned-credential",
        detail: "Added line assigns a long credential-like value",
      });
    }
  }
  return SecretScanResultSchema.parse({
    status: findings.length === 0 ? "PASS" : "FAIL",
    scanner: "builtin-regex-heuristic",
    findings,
  });
}
