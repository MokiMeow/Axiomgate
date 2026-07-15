import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface LedgerTotals {
  readonly builderTokens: number;
  readonly verifierTokens: number;
  readonly totalTokens: number;
  readonly hasVerificationRun: boolean;
}

function observedTokens(usage: unknown): number {
  if (typeof usage !== "object" || usage === null || Array.isArray(usage)) {
    return 0;
  }
  const record = usage as Record<string, unknown>;
  const input =
    typeof record.input_tokens === "number" && record.input_tokens >= 0
      ? record.input_tokens
      : 0;
  const output =
    typeof record.output_tokens === "number" && record.output_tokens >= 0
      ? record.output_tokens
      : 0;
  return input + output;
}

export function readLedgerTotals(missionDir: string): LedgerTotals {
  const path = join(missionDir, "ledger.jsonl");
  if (!existsSync(path)) {
    return {
      builderTokens: 0,
      verifierTokens: 0,
      totalTokens: 0,
      hasVerificationRun: false,
    };
  }
  let builderTokens = 0;
  let verifierTokens = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/u)) {
    if (line.trim().length === 0) {
      continue;
    }
    const entry = JSON.parse(line) as Record<string, unknown>;
    const tokens = observedTokens(entry.usage);
    if (entry.role === "verifier") {
      verifierTokens += tokens;
    } else {
      builderTokens += tokens;
    }
  }
  return {
    builderTokens,
    verifierTokens,
    totalTokens: builderTokens + verifierTokens,
    hasVerificationRun: verifierTokens > 0,
  };
}
