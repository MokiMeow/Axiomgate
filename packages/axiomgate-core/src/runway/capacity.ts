import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { z } from "zod";

import {
  readCodexRateLimits,
  type CodexRateLimitsResult,
} from "./quota-source.js";

const SourceSchema = z.enum(["manual", "observed"]);
const ConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const captured = {
  source: SourceSchema,
  confidence: ConfidenceSchema,
  capturedAt: z.iso.datetime({ offset: true }),
} as const;

const PlanFieldSchema = z.strictObject({
  value: z.string().min(1),
  ...captured,
});
const ResetsFieldSchema = z.strictObject({
  value: z.number().int().nonnegative(),
  ...captured,
});
const ExpiryFieldSchema = z.strictObject({
  value: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value))),
  ...captured,
});

export const CapacitySnapshotSchema = z.strictObject({
  plan: PlanFieldSchema.optional(),
  resetsAvailable: ResetsFieldSchema.optional(),
  resetExpires: ExpiryFieldSchema.optional(),
});

export type CapacitySnapshot = z.infer<typeof CapacitySnapshotSchema>;

export interface SetCapacitySnapshotInput {
  readonly plan?: string;
  readonly resetsAvailable?: number;
  readonly resetExpires?: string;
}

export type RunwayCapacity =
  | (Omit<
      Extract<CodexRateLimitsResult, { readonly status: "AVAILABLE" }>,
      "status"
    > & { readonly status: "LIVE" })
  | {
      readonly status: "MANUAL";
      readonly snapshot: CapacitySnapshot;
      readonly liveUnavailableReason: string;
    }
  | { readonly status: "UNKNOWN"; readonly reason: string };

export interface ResolveRunwayCapacityOptions {
  readonly readLive?: () => Promise<CodexRateLimitsResult>;
}

function runwayPath(projectPath: string): string {
  return join(resolve(projectPath), ".axiomgate", "runway.json");
}

export function readCapacitySnapshot(projectPath: string): CapacitySnapshot {
  const path = runwayPath(projectPath);
  return existsSync(path)
    ? CapacitySnapshotSchema.parse(JSON.parse(readFileSync(path, "utf8")))
    : {};
}

export function setCapacitySnapshot(
  projectPath: string,
  input: SetCapacitySnapshotInput,
  now: () => Date = () => new Date(),
): CapacitySnapshot {
  if (
    input.plan === undefined &&
    input.resetsAvailable === undefined &&
    input.resetExpires === undefined
  ) {
    throw new Error("at least one runway field is required");
  }
  const capturedAt = now().toISOString();
  const metadata = {
    source: "manual" as const,
    confidence: "HIGH" as const,
    capturedAt,
  };
  const snapshot = CapacitySnapshotSchema.parse({
    ...readCapacitySnapshot(projectPath),
    ...(input.plan === undefined
      ? {}
      : { plan: { value: input.plan, ...metadata } }),
    ...(input.resetsAvailable === undefined
      ? {}
      : { resetsAvailable: { value: input.resetsAvailable, ...metadata } }),
    ...(input.resetExpires === undefined
      ? {}
      : { resetExpires: { value: input.resetExpires, ...metadata } }),
  });
  const path = runwayPath(projectPath);
  mkdirSync(join(resolve(projectPath), ".axiomgate"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

function display(
  field:
    | { readonly value: string | number; readonly source: string; readonly confidence: string }
    | undefined,
): string {
  return field === undefined
    ? "UNKNOWN"
    : `${field.value} [${field.source}/${field.confidence}]`;
}

export function renderCapacitySnapshot(snapshot: CapacitySnapshot): string {
  const parsed = CapacitySnapshotSchema.parse(snapshot);
  return (
    `Runway: plan=${display(parsed.plan)}; ` +
    `resetsAvailable=${display(parsed.resetsAvailable)}; ` +
    `resetExpires=${display(parsed.resetExpires)}`
  );
}

export function expiringResetReminder(
  snapshot: CapacitySnapshot,
  now: Date = new Date(),
): string | undefined {
  const parsed = CapacitySnapshotSchema.parse(snapshot);
  if (
    parsed.resetExpires === undefined ||
    (parsed.resetsAvailable?.value ?? 0) <= 0
  ) {
    return undefined;
  }
  const expiresAt = new Date(parsed.resetExpires.value).getTime();
  const remainingMs = expiresAt - now.getTime();
  if (remainingMs < 0 || remainingMs > 72 * 60 * 60 * 1_000) {
    return undefined;
  }
  return (
    `REMINDER: ${parsed.resetsAvailable?.value ?? 0} banked reset(s) expire at ` +
    `${parsed.resetExpires.value} (${parsed.resetExpires.source}); activation is never automatic.`
  );
}

export async function resolveRunwayCapacity(
  projectPath: string,
  options: ResolveRunwayCapacityOptions = {},
): Promise<RunwayCapacity> {
  const live = await (options.readLive ?? readCodexRateLimits)();
  if (live.status === "AVAILABLE") {
    return { ...live, status: "LIVE" };
  }
  const snapshot = readCapacitySnapshot(projectPath);
  if (Object.keys(snapshot).length > 0) {
    return {
      status: "MANUAL",
      snapshot,
      liveUnavailableReason: live.reason,
    };
  }
  return { status: "UNKNOWN", reason: live.reason };
}

export function renderRunwayCapacity(capacity: RunwayCapacity): string {
  if (capacity.status === "UNKNOWN") {
    return `Runway capacity: UNKNOWN (${capacity.reason})`;
  }
  if (capacity.status === "MANUAL") {
    return (
      `${renderCapacitySnapshot(capacity.snapshot)} ` +
      `(manual fallback; live UNAVAILABLE: ${capacity.liveUnavailableReason})`
    );
  }
  return [
    "Runway capacity (real Codex app-server data)",
    "Limit | Window | Used | Resets at | Plan | Source/confidence",
    ...capacity.sources.map(
      (source) =>
        `${source.limitId} | ${source.windowLabel} | ${source.usedPercent}% | ` +
        `${source.resetsAt} | ${source.planType} | ${source.source}/${source.confidence}`,
    ),
    `Banked resets | ${capacity.availableResetCount} | codex-app-server/high`,
  ].join("\n");
}

export function expiringBankedResetReminder(
  capacity: RunwayCapacity,
  now: Date = new Date(),
): string | undefined {
  if (capacity.status !== "LIVE" || capacity.availableResetCount <= 0) {
    return undefined;
  }
  const resets = new Map(
    capacity.sources.flatMap((source) => source.bankedResets).map((reset) => [reset.id, reset]),
  );
  const expiring = [...resets.values()]
    .filter((reset) => reset.status.toLowerCase() === "available")
    .filter((reset) => {
      const remainingMs = Date.parse(reset.expiresAt) - now.getTime();
      return remainingMs >= 0 && remainingMs <= 72 * 60 * 60 * 1_000;
    })
    .sort((left, right) => Date.parse(left.expiresAt) - Date.parse(right.expiresAt))[0];
  return expiring === undefined
    ? undefined
    : `REMINDER: banked reset ${expiring.id} expires at ${expiring.expiresAt} (codex-app-server/high); activation is never automatic.`;
}

export interface LiveLimitSummary {
  readonly limited: boolean;
  readonly resetsAt: string | null;
  readonly availableResetCount: number;
  readonly rateLimitReachedType: string | null;
}

export function liveLimitSummary(capacity: RunwayCapacity): LiveLimitSummary | undefined {
  if (capacity.status !== "LIVE") return undefined;
  const weekly =
    capacity.sources.find(
      (source) => source.limitId === "codex" && source.windowLabel === "weekly",
    ) ?? capacity.sources.find((source) => source.windowLabel === "weekly");
  return {
    limited:
      capacity.rateLimitReachedType !== null ||
      capacity.sources.some((source) => source.usedPercent >= 100),
    resetsAt: weekly?.resetsAt ?? null,
    availableResetCount: capacity.availableResetCount,
    rateLimitReachedType: capacity.rateLimitReachedType,
  };
}
