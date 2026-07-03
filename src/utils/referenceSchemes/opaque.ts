import type { MarkerCtx, ParsedRef, ReferenceScheme } from "./types";

/**
 * Fallback scheme for documents whose reference convention is unrecognised.
 * Refs are treated as opaque keys — they anchor notes but produce no margin
 * markers. Rendering never throws.
 */
export const opaqueScheme: ReferenceScheme = {
  id: "opaque",

  parse(ref: string): ParsedRef {
    return { ref };
  },

  inlineMarker(_parsed: ParsedRef, _ctx: MarkerCtx): string {
    return "";
  },

  blockMarker(_parsed: ParsedRef, _ctx: MarkerCtx): string {
    return "";
  },

  showsBlockMarker(_parsed: ParsedRef): boolean {
    return false;
  },
};
