import type { ReferenceScheme } from "./utils/referenceSchemes";

/** Configuration for a single-language critical edition text. */
export interface EditionConfig {
  /** Title rendered in the reader (per language, for future expansion). */
  teiTitle: { gr: string; en: string };
  /** The first lb@n value in the processed document, e.g. "791a1". */
  firstLineReference: string;
  /** Citation scheme resolved by processTei; populated automatically. */
  referenceScheme: ReferenceScheme;
}

/** Alias kept for compatibility with copied openplato behavior modules. */
export type DialogueConfig = EditionConfig;
