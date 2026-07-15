import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import {
  ActionPolicyEntrySchema,
  MissionContractSchema,
  Sha256Schema,
  hashContract,
  stableStringify,
  type MissionContract,
} from "../../mission/index.js";
import type { IdentityReport, IdentitySource } from "../identity/index.js";
import { generateHookConfig, type HookConfigOptions } from "./config.js";

const CapturedAtSchema = z.iso.datetime({ offset: true });
const ConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

function identityFieldSchema<
  const S extends IdentitySource,
  T extends z.ZodType,
>(
  source: S,
  value: T,
) {
  return z.discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("RESOLVED"),
      value,
      source: z.literal(source),
      confidence: ConfidenceSchema,
      capturedAt: CapturedAtSchema,
    }),
    z.strictObject({
      status: z.literal("UNAVAILABLE"),
      source: z.literal(source),
      reason: z.string().min(1),
      capturedAt: CapturedAtSchema,
    }),
  ]);
}

const IdentityReportSchema = z.strictObject({
  githubLogin: identityFieldSchema("gh api user", z.string().min(1)),
  gitRemotes: identityFieldSchema(
    "git remote -v",
    z.array(
      z.strictObject({
        name: z.string().min(1),
        url: z.string().min(1),
        direction: z.enum(["fetch", "push"]),
      }),
    ),
  ),
  vercelUser: identityFieldSchema("vercel whoami", z.string().min(1)),
  vercelProject: identityFieldSchema(
    ".vercel/project.json",
    z.strictObject({
      projectId: z.string().min(1),
      orgId: z.string().min(1),
      projectName: z.string().min(1).optional(),
    }),
  ),
});

const MissionSnapshotContentSchema = z.strictObject({
  contract: MissionContractSchema,
  policy: z.array(ActionPolicyEntrySchema),
  identity: IdentityReportSchema,
  hookConfigHash: Sha256Schema,
});

export const MissionSnapshotSchema = MissionSnapshotContentSchema.extend({
  snapshotHash: Sha256Schema,
}).strict();

export type MissionSnapshot = z.infer<typeof MissionSnapshotSchema>;

export interface CreateMissionSnapshotInput {
  readonly contract: MissionContract;
  readonly policy: MissionContract["actionPolicy"];
  readonly identity: IdentityReport;
  readonly hookConfigHash: string;
}

export type SnapshotLoadResult =
  | { readonly status: "VALID"; readonly snapshot: MissionSnapshot }
  | { readonly status: "INVALID"; readonly reason: string };

export type EnforcementVerification =
  | {
      readonly status: "VERIFIED";
      readonly configHash: string;
      readonly snapshotHash: string;
      readonly snapshot: MissionSnapshot;
    }
  | { readonly status: "REFUSED"; readonly reason: string };

function snapshotHash(
  content: z.infer<typeof MissionSnapshotContentSchema>,
): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(stableStringify(content))
    .digest("hex")}`;
}

export function createMissionSnapshot(
  input: CreateMissionSnapshotInput,
): MissionSnapshot {
  const content = MissionSnapshotContentSchema.parse(input);
  if (hashContract(content.contract) !== content.contract.hash) {
    throw new Error("Mission contract hash is invalid");
  }
  if (stableStringify(content.policy) !== stableStringify(content.contract.actionPolicy)) {
    throw new Error("Mission snapshot policy differs from the contract policy");
  }

  return MissionSnapshotSchema.parse({
    ...content,
    snapshotHash: snapshotHash(content),
  });
}

export function writeMissionSnapshot(
  missionDir: string,
  snapshot: MissionSnapshot,
): void {
  const parsed = MissionSnapshotSchema.parse(snapshot);
  mkdirSync(missionDir, { recursive: true });
  writeFileSync(
    join(missionDir, "mission-snapshot.json"),
    `${JSON.stringify(parsed, null, 2)}\n`,
    "utf8",
  );
}

export function loadMissionSnapshot(missionDir: string): SnapshotLoadResult {
  try {
    const parsed = MissionSnapshotSchema.parse(
      JSON.parse(
        readFileSync(join(missionDir, "mission-snapshot.json"), "utf8"),
      ),
    );
    const { snapshotHash: storedHash, ...content } = parsed;
    if (snapshotHash(content) !== storedHash) {
      return { status: "INVALID", reason: "Mission snapshot hash mismatch" };
    }
    if (hashContract(parsed.contract) !== parsed.contract.hash) {
      return { status: "INVALID", reason: "Mission contract hash mismatch" };
    }
    if (
      stableStringify(parsed.policy) !==
      stableStringify(parsed.contract.actionPolicy)
    ) {
      return { status: "INVALID", reason: "Snapshot policy mismatch" };
    }

    return { status: "VALID", snapshot: parsed };
  } catch (error) {
    return {
      status: "INVALID",
      reason: error instanceof Error ? error.message : "Mission snapshot invalid",
    };
  }
}

export function verifyEnforcement(
  missionDir: string,
  options: HookConfigOptions = {},
): EnforcementVerification {
  const loaded = loadMissionSnapshot(missionDir);
  if (loaded.status === "INVALID") {
    return { status: "REFUSED", reason: loaded.reason };
  }

  try {
    const config = generateHookConfig(missionDir, options);
    if (config.configHash !== loaded.snapshot.hookConfigHash) {
      return { status: "REFUSED", reason: "Hook configuration hash mismatch" };
    }

    return {
      status: "VERIFIED",
      configHash: config.configHash,
      snapshotHash: loaded.snapshot.snapshotHash,
      snapshot: loaded.snapshot,
    };
  } catch (error) {
    return {
      status: "REFUSED",
      reason: error instanceof Error ? error.message : "Enforcement unavailable",
    };
  }
}
