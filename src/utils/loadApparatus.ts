import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as yaml from "js-yaml";
import type { ApparatusEntry } from "../scripts/annotate";

export type ApparatusRef =
  | string
  | { start: string; end: string };

export type ApparatusRawEntry = {
  ref: ApparatusRef;
  lemma: string;
  note: string;
};

export type ApparatusFile = {
  sigla: Record<string, string>;
  entries: ApparatusRawEntry[];
};

export type ApparatusData = {
  sigla: Record<string, string>;
  entries: ApparatusEntry[];
  anchorPositions: string[];
};

function refIsRange(ref: ApparatusRef): ref is { start: string; end: string } {
  return typeof ref === "object" && "start" in ref;
}

/**
 * Format a display ref string: "10" for a single line, "10–11" for a range.
 * Extracts the line number from the Bekker ref (e.g. "791a10" → "10").
 */
function formatDisplayRef(ref: ApparatusRef): string {
  if (refIsRange(ref)) {
    const startLine = ref.start.replace(/^\d+[ab]/, "");
    const endLine = ref.end.replace(/^\d+[ab]/, "");
    return `${startLine}–${endLine}`;
  }
  return ref.replace(/^\d+[ab]/, "");
}

/**
 * Collect all anchor positions (unique refs) needed for injectAnchors.
 * Range entries contribute both start and end positions.
 */
function extractAnchorPositions(entries: ApparatusRawEntry[]): string[] {
  const positions = new Set<string>();

  for (const entry of entries) {
    if (refIsRange(entry.ref)) {
      positions.add(entry.ref.start);
      positions.add(entry.ref.end);
    } else {
      positions.add(entry.ref);
    }
  }

  return Array.from(positions).sort();
}

/**
 * Load apparatus data from the YAML file for a given work.
 * Returns sigla, processed entries (ready for the annotate script),
 * and the list of anchor positions needed by injectAnchors.
 */
export async function loadApparatus(work: string): Promise<ApparatusData> {
  const filePath = resolve(process.cwd(), `src/data/apparatus/${work}.yml`);
  const raw = await readFile(filePath, "utf-8");
  const parsed = yaml.load(raw) as ApparatusFile;

  const entries: ApparatusEntry[] = parsed.entries.map((raw, i) => {
    const id = `app-${i}`;
    const target = refIsRange(raw.ref)
      ? { refRange: raw.ref, lemma: raw.lemma }
      : { ref: raw.ref, lemma: raw.lemma };

    return {
      id,
      targets: [target],
      displayRef: formatDisplayRef(raw.ref),
      note: raw.note,
    };
  });

  const anchorPositions = extractAnchorPositions(parsed.entries);

  return {
    sigla: parsed.sigla ?? {},
    entries,
    anchorPositions,
  };
}
