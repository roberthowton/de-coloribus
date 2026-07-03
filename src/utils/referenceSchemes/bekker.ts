import type { MarkerCtx, ParsedRef, ReferenceScheme } from "./types";

// Bekker pagination: {page}{column}{line}, e.g. "791a1", "791b10"
// Pages are 3-digit integers; columns are "a" or "b" only.
const BEKKER_FULL_REGEX = /^(\d+)([ab])(\d+)$/;

// Line numbers shown as block margin markers (same cadence as a printed edition).
export const BEKKER_LINE_NUMBERS_TO_DISPLAY = [
  "1", "5", "10", "15", "20", "25", "30", "35",
];

export function isBekkerRef(ref: string): boolean {
  return BEKKER_FULL_REGEX.test(ref);
}

export function parseBekkerReference(
  ref: string,
): { page: string; column: string; line: string } | null {
  const m = BEKKER_FULL_REGEX.exec(ref);
  if (!m) return null;
  return { page: m[1], column: m[2], line: m[3] };
}

export const bekkerScheme: ReferenceScheme = {
  id: "bekker",

  parse(ref: string): ParsedRef | null {
    const parts = parseBekkerReference(ref);
    if (!parts) return null;
    return parts;
  },

  inlineMarker(parsed: ParsedRef, _ctx: MarkerCtx): string {
    const { page, column, line } = parsed;
    if (line === "1" && column === "a") return `${page}a`;
    if (line === "1") return "b";
    return line;
  },

  blockMarker(parsed: ParsedRef, ctx: MarkerCtx): string {
    const { page, column, line } = parsed;
    // First line of the whole document: show "page + column" (e.g. "791a")
    if (ctx.isFirstLine) return `${page}${column}`;
    // First line of a new column: show just the column letter
    if (line === "1") return column;
    return line;
  },

  showsBlockMarker(parsed: ParsedRef): boolean {
    return BEKKER_LINE_NUMBERS_TO_DISPLAY.includes(parsed.line);
  },

  startingPageLabel(firstRef: string): string {
    const parts = parseBekkerReference(firstRef);
    return parts ? parts.page : firstRef;
  },
};
