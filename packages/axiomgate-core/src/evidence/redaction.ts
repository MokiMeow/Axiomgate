const SECRET_PATTERNS: readonly [RegExp, string][] = [
  [
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9_-]{20,})\b/gu,
    "[REDACTED_TOKEN]",
  ],
  [/\bAKIA[0-9A-Z]{16}\b/gu, "[REDACTED_AWS_ACCESS_KEY]"],
  [
    /(\b(?:authorization)\b\s*[:=]\s*(?:Bearer|Basic)\s+)[A-Za-z0-9._~+/=-]{8,}/giu,
    "$1[REDACTED]",
  ],
  [
    /(\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|secret)\b\s*["']?\s*[:=]\s*["']?)[A-Za-z0-9_./+=-]{12,}/giu,
    "$1[REDACTED]",
  ],
  [
    /(https?:\/\/[^\s:/@]+:)[^\s/@]+(@)/giu,
    "$1[REDACTED]$2",
  ],
  [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
    "[REDACTED_PRIVATE_KEY]",
  ],
];

export function redactSensitiveText(value: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    value,
  );
}

export function redactSensitiveValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactSensitiveText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactSensitiveValue(item)]),
    ) as T;
  }
  return value;
}
