import { createHash } from "node:crypto";

import { MissionContractSchema, type MissionContract } from "./mission-contract.js";
import { IsoDateTimeSchema } from "./primitives.js";

function serialize(value: unknown, ancestors: Set<object>): string | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return JSON.stringify(value);
  }

  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return undefined;
  }

  if (typeof value === "bigint") {
    throw new TypeError("Cannot stable-stringify a bigint");
  }

  if (ancestors.has(value)) {
    throw new TypeError("Cannot stable-stringify a circular structure");
  }

  ancestors.add(value);

  let serialized: string;
  if (Array.isArray(value)) {
    const items = value.map((item) => serialize(item, ancestors) ?? "null");
    serialized = `[${items.join(",")}]`;
  } else {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const item = serialize((value as Record<string, unknown>)[key], ancestors);
        return item === undefined ? [] : [`${JSON.stringify(key)}:${item}`];
      });
    serialized = `{${entries.join(",")}}`;
  }

  ancestors.delete(value);
  return serialized;
}

export function stableStringify(value: unknown): string {
  const serialized = serialize(value, new Set());
  if (serialized === undefined) {
    throw new TypeError("Value is not JSON-serializable");
  }

  return serialized;
}

export function hashContract<T extends object>(contract: T): `sha256:${string}` {
  const { hash: _omitted, ...hashable } = contract as T & { hash?: unknown };
  const digest = createHash("sha256")
    .update(stableStringify(hashable), "utf8")
    .digest("hex");

  return `sha256:${digest}`;
}

export function bumpContractVersion(
  contract: MissionContract,
  updatedAt = new Date().toISOString(),
): MissionContract {
  const parsed = MissionContractSchema.parse(contract);
  const nextUpdatedAt = IsoDateTimeSchema.parse(updatedAt);
  const next = {
    ...parsed,
    version: parsed.version + 1,
    updatedAt: nextUpdatedAt,
  };

  return MissionContractSchema.parse({
    ...next,
    hash: hashContract(next),
  });
}
