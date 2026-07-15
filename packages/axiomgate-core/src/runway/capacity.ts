import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { z } from "zod";

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
