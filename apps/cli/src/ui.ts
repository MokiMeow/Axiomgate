const ESC = "\u001b[";

export type UiTone = "accent" | "success" | "failure" | "warning" | "muted";
export type UiStatus = "success" | "failure" | "warning" | "neutral";

export interface UiOptions {
  readonly isTTY?: boolean;
  readonly noColor?: boolean;
  readonly color?: boolean;
}

export interface KeyValueRow {
  readonly key: string;
  readonly value: string | number;
}

export interface TerminalUi {
  readonly colorEnabled: boolean;
  readonly unicodeEnabled: boolean;
  paint(value: string, tone: UiTone): string;
  glyph(status: UiStatus): string;
  header(command: string, detail?: string): string;
  rule(label?: string): string;
  rows(values: readonly KeyValueRow[]): string;
  table(headers: readonly string[], rows: readonly (readonly string[])[]): string;
  callout(status: UiStatus, title: string, lines?: readonly string[]): string;
}

const COLORS: Readonly<Record<UiTone, string>> = {
  accent: "38;5;208",
  success: "32",
  failure: "31",
  warning: "33",
  muted: "2",
};

const UNICODE_GLYPHS: Readonly<Record<UiStatus, string>> = {
  success: "✓",
  failure: "✕",
  warning: "▲",
  neutral: "·",
};

const ASCII_GLYPHS: Readonly<Record<UiStatus, string>> = {
  success: "[OK]",
  failure: "[X]",
  warning: "[!]",
  neutral: "[-]",
};

function pad(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function formatTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map((row) => row[index]?.length ?? 0),
    ),
  );
  return [headers, ...rows]
    .map((row) =>
      headers
        .map((_, index) => pad(row[index] ?? "", widths[index] ?? 0))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

export function createUi(options: UiOptions = {}): TerminalUi {
  const isTTY = options.isTTY ?? Boolean(process.stdout.isTTY);
  const noColor = options.noColor ?? Object.hasOwn(process.env, "NO_COLOR");
  const colorEnabled = options.color ?? (isTTY && !noColor);
  const unicodeEnabled = isTTY;

  const paint = (value: string, tone: UiTone): string =>
    colorEnabled ? `${ESC}${COLORS[tone]}m${value}${ESC}0m` : value;
  const glyph = (status: UiStatus): string => {
    const value = (unicodeEnabled ? UNICODE_GLYPHS : ASCII_GLYPHS)[status];
    const tone =
      status === "success"
        ? "success"
        : status === "failure"
          ? "failure"
          : status === "warning"
            ? "warning"
            : "muted";
    return paint(value, tone);
  };

  return {
    colorEnabled,
    unicodeEnabled,
    paint,
    glyph,
    header(command, detail) {
      const mark = paint(unicodeEnabled ? "◆ AXIOMGATE" : "AXIOMGATE", "accent");
      const suffix = detail === undefined ? command : `${command} · ${detail}`;
      return `${mark} ${paint(`/ ${suffix}`, "muted")}`;
    },
    rule(label) {
      const line = (unicodeEnabled ? "─" : "-").repeat(54);
      return label === undefined
        ? paint(line, "muted")
        : `${paint(label.toUpperCase(), "accent")} ${paint(line.slice(label.length + 1), "muted")}`;
    },
    rows(values) {
      const width = Math.max(0, ...values.map((row) => row.key.length));
      return values
        .map((row) => `${paint(pad(row.key, width), "muted")}  ${row.value}`)
        .join("\n");
    },
    table(headers, rows) {
      return formatTable(headers, rows);
    },
    callout(status, title, lines = []) {
      const content = [`${glyph(status)} ${title}`, ...lines];
      const width = Math.max(...content.map((line) => line.length));
      if (!unicodeEnabled) {
        const edge = `+${"-".repeat(width + 2)}+`;
        return [edge, ...content.map((line) => `| ${pad(line, width)} |`), edge].join("\n");
      }
      const edge = `┌${"─".repeat(width + 2)}┐`;
      const bottom = `└${"─".repeat(width + 2)}┘`;
      return [edge, ...content.map((line) => `│ ${pad(line, width)} │`), bottom].join("\n");
    },
  };
}

export const ui = createUi();
