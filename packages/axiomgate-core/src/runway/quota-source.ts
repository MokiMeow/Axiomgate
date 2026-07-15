type JsonObject = Record<string, unknown>;

import {
  runStagedCommand,
  type StagedCommandRunner,
} from "../guard/identity/command.js";

export interface BankedReset {
  readonly id: string;
  readonly resetType: string;
  readonly status: string;
  readonly grantedAt: string;
  readonly expiresAt: string;
}

export interface CapacitySource {
  readonly limitId: string;
  readonly windowLabel: string;
  readonly usedPercent: number;
  readonly resetsAt: string;
  readonly planType: string;
  readonly credits: {
    readonly balance: string | null;
    readonly unlimited: boolean | null;
  };
  readonly bankedResets: readonly BankedReset[];
  readonly source: "codex-app-server";
  readonly confidence: "high";
  readonly capturedAt: string;
}

export type CodexRateLimitsResult =
  | {
      readonly status: "AVAILABLE";
      readonly sources: readonly CapacitySource[];
      readonly availableResetCount: number;
      readonly rateLimitReachedType: string | null;
    }
  | { readonly status: "UNAVAILABLE"; readonly reason: string };

export interface ReadCodexRateLimitsOptions {
  readonly runner?: StagedCommandRunner;
  readonly cacheTtlMs?: number;
  readonly timeoutMs?: number;
  readonly now?: () => Date;
}

let cached:
  | { readonly at: number; readonly result: CodexRateLimitsResult }
  | undefined;

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function isoTime(value: unknown): string | undefined {
  const date =
    typeof value === "number"
      ? new Date(value * 1_000)
      : typeof value === "string"
        ? new Date(value)
        : undefined;
  return date !== undefined && !Number.isNaN(date.getTime())
    ? date.toISOString()
    : undefined;
}

export function windowLabel(minutes: number): string {
  if (minutes <= 300) return "5-hour";
  if (minutes >= 10_000 && minutes <= 10_160) return "weekly";
  return `${minutes}min`;
}

function parseBankedResets(value: unknown): BankedReset[] {
  const credits = object(value)?.credits;
  if (!Array.isArray(credits)) return [];
  return credits.flatMap((entry) => {
    const candidate = object(entry);
    if (candidate === undefined) return [];
    const grantedAt = isoTime(candidate.grantedAt);
    const expiresAt = isoTime(candidate.expiresAt);
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.resetType !== "string" ||
      typeof candidate.status !== "string" ||
      grantedAt === undefined ||
      expiresAt === undefined
    ) {
      return [];
    }
    return [{
      id: candidate.id,
      resetType: candidate.resetType,
      status: candidate.status,
      grantedAt,
      expiresAt,
    }];
  });
}

function parseLimitWindows(
  value: unknown,
  bankedResets: readonly BankedReset[],
  capturedAt: string,
): CapacitySource[] {
  const limit = object(value);
  if (limit === undefined || typeof limit.limitId !== "string") return [];
  const limitId = limit.limitId;
  const credits = object(limit.credits);
  const planType = typeof limit.planType === "string" ? limit.planType : "UNKNOWN";
  const creditRecord = {
    balance: typeof credits?.balance === "string" ? credits.balance : null,
    unlimited: typeof credits?.unlimited === "boolean" ? credits.unlimited : null,
  };

  return [limit.primary, limit.secondary].flatMap((rawWindow) => {
    const window = object(rawWindow);
    if (window === undefined) return [];
    const usedPercent = finiteNumber(window.usedPercent);
    const duration = finiteNumber(window.windowDurationMins);
    const resetsAt = isoTime(window.resetsAt);
    if (usedPercent === undefined || duration === undefined || resetsAt === undefined) {
      return [];
    }
    return [{
      limitId,
      windowLabel: windowLabel(duration),
      usedPercent,
      resetsAt,
      planType,
      credits: creditRecord,
      bankedResets,
      source: "codex-app-server" as const,
      confidence: "high" as const,
      capturedAt,
    }];
  });
}

function responseObject(raw: string | unknown): JsonObject | undefined {
  if (typeof raw !== "string") return object(raw);
  try {
    const parsed = object(JSON.parse(raw));
    if (object(parsed?.result)?.rateLimits !== undefined) return parsed;
  } catch {
    // App-server streams JSON-RPC objects as one JSON object per line.
  }
  const lines = raw.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  for (const line of lines.reverse()) {
    try {
      const parsed = object(JSON.parse(line));
      if (object(parsed?.result)?.rateLimits !== undefined) return parsed;
    } catch {
      // Notifications and malformed lines cannot supply a rate-limit result.
    }
  }
  return undefined;
}

export function parseCodexRateLimits(
  raw: string | unknown,
  now: () => Date = () => new Date(),
): CodexRateLimitsResult {
  const response = responseObject(raw);
  const result = object(response?.result);
  const primaryLimit = object(result?.rateLimits);
  if (result === undefined || primaryLimit === undefined) {
    return {
      status: "UNAVAILABLE",
      reason: "Codex app-server returned no valid rate-limit response",
    };
  }
  const capturedAt = now().toISOString();
  const resetCredits = object(result.rateLimitResetCredits);
  const bankedResets = parseBankedResets(resetCredits);
  const sources = parseLimitWindows(primaryLimit, bankedResets, capturedAt);
  const byLimit = object(result.rateLimitsByLimitId);
  if (byLimit !== undefined) {
    for (const [limitId, value] of Object.entries(byLimit)) {
      if (limitId === primaryLimit.limitId) continue;
      sources.push(...parseLimitWindows(value, bankedResets, capturedAt));
    }
  }
  if (sources.length === 0) {
    return {
      status: "UNAVAILABLE",
      reason: "Codex app-server returned no usable rate-limit windows",
    };
  }
  return {
    status: "AVAILABLE",
    sources,
    availableResetCount:
      typeof resetCredits?.availableCount === "number"
        ? resetCredits.availableCount
        : bankedResets.length,
    rateLimitReachedType:
      typeof primaryLimit.rateLimitReachedType === "string"
        ? primaryLimit.rateLimitReachedType
        : null,
  };
}

export async function readCodexRateLimits(
  options: ReadCodexRateLimitsOptions = {},
): Promise<CodexRateLimitsResult> {
  const now = options.now ?? (() => new Date());
  const cacheTtlMs = options.cacheTtlMs ?? 60_000;
  const nowMs = now().getTime();
  if (cacheTtlMs > 0 && cached !== undefined && nowMs - cached.at < cacheTtlMs) {
    return cached.result;
  }
  const runner = options.runner ?? runStagedCommand;
  const line = (value: unknown) => `${JSON.stringify(value)}\n`;
  const commandResult = await runner("codex", ["app-server"], {
    timeoutMs: options.timeoutMs ?? 15_000,
    writes: [
      {
        delayMs: 0,
        data: line({
          method: "initialize",
          id: 0,
          params: {
            clientInfo: {
              name: "axiomgate",
              title: "AxiomGate",
              version: "0.1.0",
            },
            capabilities: {
              experimentalApi: true,
              optOutNotificationMethods: [],
            },
          },
        }),
      },
      { delayMs: 700, data: line({ method: "initialized", params: {} }) },
      {
        delayMs: 1_400,
        data: line({ method: "account/rateLimits/read", id: 1, params: {} }),
      },
    ],
    completeWhenStdoutLine: (outputLine) => {
      try {
        const value = object(JSON.parse(outputLine));
        return value?.id === 1;
      } catch {
        return false;
      }
    },
  });
  const result =
    commandResult.status === "SUCCESS"
      ? parseCodexRateLimits(commandResult.stdout, now)
      : {
          status: "UNAVAILABLE" as const,
          reason:
            `Codex app-server ${commandResult.status.toLowerCase().replaceAll("_", " ")}: ` +
            (commandResult.stderr.trim() || `exit ${commandResult.exitCode}`),
        };
  if (cacheTtlMs > 0) cached = { at: nowMs, result };
  return result;
}
