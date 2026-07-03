// Adapted from openplato (openplatodotorg-rfh-fork/src/scripts/injectAnchors.ts)
export type AnchorIndex = Map<string, HTMLElement>;

/**
 * Parse apparatus (or comments) data from a JSON script tag
 */
function getApparatusData(id: string): { anchorPositions: string[] } | null {
  const script = document.getElementById(id);
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || "");
  } catch {
    console.warn(`Failed to parse ${id} JSON`);
    return null;
  }
}

/**
 * Inject anchor spans after tei-lb elements for the given positions.
 * Returns a map of ref → anchor element for use by the annotation engine.
 */
export function injectAnchors(
  container: HTMLElement,
  dataId: string = "apparatus"
): AnchorIndex {
  const anchorIndex: AnchorIndex = new Map();
  const data = getApparatusData(dataId);

  if (!data || !data.anchorPositions.length) {
    return anchorIndex;
  }

  for (const pos of data.anchorPositions) {
    const lb = container.querySelector(`tei-lb[n="${pos}"]`);
    if (!lb) {
      console.warn(`Anchor target not found: tei-lb[n="${pos}"]`);
      continue;
    }

    const anchor = document.createElement("span");
    anchor.id = `a-${pos}`;
    anchor.className = "tei-anchor";
    anchor.dataset.bekker = pos;

    lb.after(anchor);
    anchorIndex.set(pos, anchor);
  }

  return anchorIndex;
}
