function stableSerialize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
}

export function contentHash(value) {
  const serialized = stableSerialize(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function contentChanged(previousHash, nextValue) {
  const nextHash = contentHash(nextValue);
  return {
    changed: previousHash !== nextHash,
    hash: nextHash,
  };
}

export function resolvePollInterval(configuredValue, demo = false) {
  const configured = Number(configuredValue);
  if (Number.isFinite(configured) && configured >= 1_000) {
    return Math.min(configured, 60_000);
  }
  return demo ? 10_000 : 3_000;
}
