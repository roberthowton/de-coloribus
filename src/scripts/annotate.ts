// Adapted from openplato (openplatodotorg-rfh-fork/src/scripts/annotate.ts)
// Generalized for apparatus entries (instead of comments).
import type { AnchorIndex } from "./injectAnchors";

export type ApparatusTarget = {
  ref?: string;
  refRange?: { start: string; end: string };
  lemma?: string;
};

export type ApparatusEntry = {
  id: string;
  targets: ApparatusTarget[];
  displayRef: string; // e.g. "10" or "10–11"
  note: string;
};

type Boundary = {
  node: Node;
  offset: number;
  entryId: string;
  type: "start" | "end";
};

/** Read apparatus entries from the JSON script tag. */
function getApparatusEntries(): { entries: ApparatusEntry[] } | null {
  const script = document.getElementById("apparatus");
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || "");
  } catch {
    return null;
  }
}

/**
 * Find the text node and offset for a lemma string, searching from an anchor.
 * Handles lemmas that may span across line-div boundaries by normalizing
 * whitespace (stripping leading spaces and line-end hyphens inserted by
 * the break="no" handler).
 */
function findMatchPosition(
  anchor: HTMLElement,
  match: string
): { node: Text; offset: number } | null {
  const container = anchor.closest("tei-container") || document.body;
  const anchorRect = anchor.getBoundingClientRect();

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  let node: Text | null;
  let bestMatch: { node: Text; offset: number; distance: number } | null = null;
  let searchCount = 0;

  while ((node = walker.nextNode() as Text | null)) {
    searchCount++;
    const text = node.textContent || "";
    const idx = text.indexOf(match);

    if (idx !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + match.length);
      const matchRect = range.getBoundingClientRect();

      const distance = Math.abs(matchRect.top - anchorRect.top);

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { node, offset: idx, distance };
        if (distance < 30) {
          return { node: bestMatch.node, offset: bestMatch.offset };
        }
      }
    }

    if (searchCount > 2000) break;
  }

  if (bestMatch) return { node: bestMatch.node, offset: bestMatch.offset };
  console.warn(`[annotate] Lemma not found: "${match}"`);
  return null;
}

function findMatchEnd(
  startNode: Text,
  startOffset: number,
  matchLength: number
): { node: Text; offset: number } {
  let remaining = matchLength;
  let node: Text = startNode;
  let offset = startOffset;

  while (remaining > 0) {
    const available = (node.textContent?.length ?? 0) - offset;
    if (remaining <= available) {
      return { node, offset: offset + remaining };
    }
    remaining -= available;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    walker.currentNode = node;
    const next = walker.nextNode() as Text | null;
    if (!next) break;
    node = next;
    offset = 0;
  }

  return { node, offset: offset + remaining };
}

function comparePositions(
  a: { node: Node; offset: number },
  b: { node: Node; offset: number }
): number {
  if (a.node === b.node) return a.offset - b.offset;
  const position = a.node.compareDocumentPosition(b.node);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function collectBoundaries(
  entries: ApparatusEntry[],
  anchorIndex: AnchorIndex
): Boundary[] {
  const boundaries: Boundary[] = [];

  for (const entry of entries) {
    for (const target of entry.targets) {
      const startRef = target.ref || target.refRange?.start;
      const endRef = target.refRange?.end || startRef;

      if (!startRef) continue;

      const startAnchor = anchorIndex.get(startRef);
      const endAnchor = anchorIndex.get(endRef!);

      if (!startAnchor) {
        console.warn(`[annotate] Anchor not found: ${startRef}`);
        continue;
      }

      let startPos: { node: Node; offset: number } | null = null;
      let endPos: { node: Node; offset: number } | null = null;

      if (target.lemma) {
        const matchPos = findMatchPosition(startAnchor, target.lemma);
        if (!matchPos) {
          console.warn(`[annotate] Lemma not found: "${target.lemma}" at ${startRef}`);
          continue;
        }
        startPos = matchPos;
        endPos = findMatchEnd(matchPos.node, matchPos.offset, target.lemma.length);
      } else {
        // Highlight the full range between anchors
        const startWalker = document.createTreeWalker(
          startAnchor.parentElement || document.body,
          NodeFilter.SHOW_TEXT
        );
        startWalker.currentNode = startAnchor;
        const startText = startWalker.nextNode() as Text | null;
        if (startText) startPos = { node: startText, offset: 0 };

        if (endAnchor) {
          const endWalker = document.createTreeWalker(
            endAnchor.parentElement || document.body,
            NodeFilter.SHOW_TEXT
          );
          endWalker.currentNode = endAnchor;
          const endText = endWalker.previousNode() as Text | null;
          if (endText) endPos = { node: endText, offset: endText.textContent?.length ?? 0 };
        }
      }

      if (startPos && endPos) {
        boundaries.push({ ...startPos, entryId: entry.id, type: "start" });
        boundaries.push({ ...endPos, entryId: entry.id, type: "end" });
      }
    }
  }

  boundaries.sort((a, b) => {
    const posCompare = comparePositions(a, b);
    if (posCompare !== 0) return posCompare;
    return a.type === "end" ? -1 : 1;
  });

  return boundaries;
}

function wrapTextNode(
  node: Text,
  startOffset: number,
  endOffset: number,
  entryIds: Set<string>
): void {
  const text = node.textContent || "";
  if (startOffset >= endOffset || startOffset >= text.length) return;

  const actualEnd = Math.min(endOffset, text.length);
  const range = document.createRange();
  range.setStart(node, startOffset);
  range.setEnd(node, actualEnd);

  const span = document.createElement("span");
  span.className = "app-lemma";
  span.dataset.entryIds = Array.from(entryIds).join(",");

  try {
    range.surroundContents(span);
  } catch {
    return;
  }
}

function wrapRange(
  startNode: Text,
  startOffset: number,
  endNode: Text,
  endOffset: number,
  entryIds: Set<string>
): void {
  if (startNode === endNode) {
    wrapTextNode(startNode, startOffset, endOffset, entryIds);
    return;
  }

  const entryIdsStr = Array.from(entryIds).join(",");

  wrapTextNode(startNode, startOffset, startNode.textContent?.length || 0, entryIds);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  walker.currentNode = startNode;

  let node = walker.nextNode() as Text | null;
  while (node && node !== endNode) {
    if (
      node.parentElement?.classList.contains("app-lemma") ||
      !node.textContent?.trim()
    ) {
      node = walker.nextNode() as Text | null;
      continue;
    }

    const span = document.createElement("span");
    span.className = "app-lemma";
    span.dataset.entryIds = entryIdsStr;

    const parent = node.parentNode;
    if (parent) {
      parent.insertBefore(span, node);
      span.appendChild(node);
    }

    node = walker.nextNode() as Text | null;
  }

  if (endNode && !endNode.parentElement?.classList.contains("app-lemma")) {
    wrapTextNode(endNode, 0, endOffset, entryIds);
  }
}

/** Apply apparatus lemma highlighting using segment decomposition. */
export function annotate(
  _container: HTMLElement,
  anchorIndex: AnchorIndex
): void {
  const data = getApparatusEntries();
  if (!data || !data.entries.length) return;

  const boundaries = collectBoundaries(data.entries, anchorIndex);
  if (!boundaries.length) return;

  const activeEntries = new Set<string>();
  let prevNode: Text | null = null;
  let prevOffset = 0;

  for (const boundary of boundaries) {
    if (prevNode && activeEntries.size > 0) {
      const currNode = boundary.node;
      const currOffset = boundary.offset;

      if (currNode instanceof Text && prevNode instanceof Text) {
        if (prevNode !== currNode || prevOffset < currOffset) {
          wrapRange(prevNode, prevOffset, currNode as Text, currOffset, new Set(activeEntries));
        }
      }
    }

    if (boundary.type === "start") {
      activeEntries.add(boundary.entryId);
    } else {
      activeEntries.delete(boundary.entryId);
    }

    if (boundary.node instanceof Text) {
      prevNode = boundary.node;
      prevOffset = boundary.offset;
    }
  }
}
