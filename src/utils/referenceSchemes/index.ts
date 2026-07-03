import { isBekkerRef, bekkerScheme } from "./bekker";
import { opaqueScheme } from "./opaque";
import type { ReferenceScheme } from "./types";

export type { ReferenceScheme, ParsedRef, MarkerCtx } from "./types";
export { bekkerScheme, parseBekkerReference, isBekkerRef, BEKKER_LINE_NUMBERS_TO_DISPLAY } from "./bekker";
export { opaqueScheme } from "./opaque";

const registry: Record<string, ReferenceScheme> = {
  bekker: bekkerScheme,
  opaque: opaqueScheme,
};

/**
 * Resolve the reference scheme for a TEI document.
 *
 * Selection order:
 * 1. Infer Bekker from the document: any <div type="Bekker-page"> present, OR
 *    first lb@n matching the Bekker shape (/^\d+[ab]\d+$/).
 * 2. Explicit override via meta `referenceScheme` field.
 * 3. Opaque fallback (renders text, no markers, never crashes).
 */
export const resolveScheme = (
  xmlDoc: Document,
  meta?: { referenceScheme?: string },
): ReferenceScheme => {
  // 1. Infer from XML conventions
  const hasBekkerDiv =
    xmlDoc.querySelector('div[type="Bekker-page"]') !== null;
  if (hasBekkerDiv) return bekkerScheme;

  const firstLb = xmlDoc.querySelector("lb[n]");
  if (firstLb) {
    const n = firstLb.getAttribute("n") ?? "";
    if (isBekkerRef(n)) return bekkerScheme;
  }

  // 2. Explicit meta override
  if (meta?.referenceScheme) {
    return registry[meta.referenceScheme] ?? opaqueScheme;
  }

  // 3. Opaque fallback
  return opaqueScheme;
};
