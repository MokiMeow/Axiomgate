export type JsonRecord = Record<string, unknown>;

export interface ParsedCodexStream {
  readonly sessionId: string | undefined;
  readonly events: readonly JsonRecord[];
  readonly items: readonly JsonRecord[];
  readonly commandExecutions: readonly JsonRecord[];
  readonly errors: readonly string[];
  readonly usages: readonly JsonRecord[];
  readonly truncated: boolean;
  readonly lastEvent: JsonRecord | undefined;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

export function parseCodexJsonl(stream: string): ParsedCodexStream {
  const events: JsonRecord[] = [];
  const items: JsonRecord[] = [];
  const commandExecutions: JsonRecord[] = [];
  const errors: string[] = [];
  const usages: JsonRecord[] = [];
  let sessionId: string | undefined;
  let truncated = false;

  for (const rawLine of stream.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    let event: JsonRecord | undefined;
    try {
      event = asRecord(JSON.parse(line));
    } catch {
      truncated = true;
      break;
    }
    if (event === undefined || typeof event.type !== "string") {
      truncated = true;
      break;
    }
    events.push(event);

    if (
      event.type === "thread.started" &&
      typeof event.thread_id === "string"
    ) {
      sessionId = event.thread_id;
    }
    const item = asRecord(event.item);
    if (item !== undefined) {
      items.push(item);
      if (item.type === "command_execution") {
        commandExecutions.push(item);
      }
      if (item.type === "error" && typeof item.message === "string") {
        errors.push(item.message);
      }
    }
    if (event.type === "error" && typeof event.message === "string") {
      errors.push(event.message);
    }
    const usage = asRecord(event.usage);
    if (usage !== undefined) {
      usages.push(usage);
    }
  }

  return {
    sessionId,
    events,
    items,
    commandExecutions,
    errors,
    usages,
    truncated,
    lastEvent: events.at(-1),
  };
}
