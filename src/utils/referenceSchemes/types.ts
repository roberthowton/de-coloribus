export interface ParsedRef {
  [part: string]: string;
}

export interface MarkerCtx {
  /** The raw ref string (e.g. "791a1") */
  ref: string;
  /** Whether this is the very first line of the document */
  isFirstLine: boolean;
}

export interface ReferenceScheme {
  readonly id: string;
  /** Parse a raw ref string into named parts. Returns null if ref doesn't conform. */
  parse(ref: string): ParsedRef | null;
  /** Text for the always-present inline marker (narrow viewports). */
  inlineMarker(parsed: ParsedRef, ctx: MarkerCtx): string;
  /** Text for the optional margin block marker (wide viewports). */
  blockMarker(parsed: ParsedRef, ctx: MarkerCtx): string;
  /** Whether a block marker should be shown for this ref. */
  showsBlockMarker(parsed: ParsedRef): boolean;
  /**
   * Label shown in the starting-page slot.
   * If absent, the first-line ref is shown verbatim.
   */
  startingPageLabel?(firstRef: string): string;
}
