/**
 * ApparatusPanelElement — web component that shows the critical apparatus
 * entries for lines currently visible in the scroll viewport.
 *
 * Architecture:
 * - Reads apparatus entries from <script type="application/json" id="apparatus">.
 * - Builds a map: bekkerRef → ApparatusEntry[] (range entries indexed under
 *   every covered line).
 * - Attaches an IntersectionObserver to every .text-line element; maintains a
 *   Set of visible refs. On change (rAF-throttled), re-renders the panel.
 * - Range entries are "visible" if ANY line in [start..end] is visible.
 */

import type { ApparatusEntry, ApparatusTarget } from "../../scripts/annotate";

type ApparatusJson = {
  sigla: Record<string, string>;
  entries: ApparatusEntry[];
  anchorPositions: string[];
};

function parseApparatusJson(): ApparatusJson | null {
  const script = document.getElementById("apparatus");
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || "");
  } catch {
    console.warn("[apparatus] Failed to parse apparatus JSON");
    return null;
  }
}

/** Extract the bekker line key(s) an entry covers. */
function entryRefs(entry: ApparatusEntry): string[] {
  const refs: string[] = [];
  for (const target of entry.targets) {
    const t = target as ApparatusTarget;
    if (t.ref) refs.push(t.ref);
    if (t.refRange) {
      refs.push(t.refRange.start);
      refs.push(t.refRange.end);
    }
  }
  return refs;
}

/** Build a page label (e.g. "791a") from a ref like "791a10". */
function pageFromRef(ref: string): string {
  const m = /^(\d+[ab])/.exec(ref);
  return m ? m[1] : ref;
}

/** Render an entry as HTML. Format: lineRef · lemma ] note */
function renderEntry(entry: ApparatusEntry): string {
  const lemma = (entry.targets[0] as ApparatusTarget).lemma ?? "";
  const note = entry.note ?? "";
  return `<li class="app-entry">
    <span class="app-ref">${entry.displayRef}</span>
    ${lemma ? `<span class="app-lemma-text">${lemma}]</span>` : ""}
    <span class="app-note">${note}</span>
  </li>`;
}

export function createApparatusPanelElement(): typeof HTMLElement {
  return class ApparatusPanel extends HTMLElement {
    private data: ApparatusJson | null = null;
    /** Map from bekkerRef → entries that cover that ref */
    private refIndex: Map<string, ApparatusEntry[]> = new Map();
    private visibleRefs: Set<string> = new Set();
    private observer: IntersectionObserver | null = null;
    private rafPending: boolean = false;
    private collapsed: boolean = false;

    connectedCallback() {
      this.init();
      // Re-init on Astro view transitions
      document.addEventListener("astro:after-swap", () => this.init());
    }

    disconnectedCallback() {
      this.observer?.disconnect();
    }

    private init() {
      this.observer?.disconnect();
      this.visibleRefs.clear();

      this.data = parseApparatusJson();
      if (!this.data) {
        this.render([]);
        return;
      }

      // Build ref → entry index (range entries go under BOTH start and end refs)
      this.refIndex = new Map();
      for (const entry of this.data.entries) {
        for (const ref of entryRefs(entry)) {
          const existing = this.refIndex.get(ref) ?? [];
          existing.push(entry);
          this.refIndex.set(ref, existing);
        }
      }

      this.observeLines();
      this.render([]);

      // Set up collapse toggle
      this.querySelector(".app-toggle")?.addEventListener("click", () => {
        this.collapsed = !this.collapsed;
        this.classList.toggle("collapsed", this.collapsed);
      });
    }

    private observeLines() {
      // Observe every .text-line element in tei-container
      const container = document.querySelector("tei-container");
      if (!container) return;

      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            // The id is "791a10-gr-text" → the lb id is "791a10-gr"
            // We want the bekker ref: strip the "-gr-text" suffix
            const ref = el.id.replace(/-gr(-text)?$/, "");
            if (entry.isIntersecting) {
              this.visibleRefs.add(ref);
            } else {
              this.visibleRefs.delete(ref);
            }
          }
          this.scheduleRender();
        },
        { threshold: 0.1 }
      );

      for (const line of Array.from(container.querySelectorAll(".text-line"))) {
        this.observer.observe(line);
      }
    }

    private scheduleRender() {
      if (this.rafPending) return;
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.rafPending = false;
        this.updatePanel();
      });
    }

    private updatePanel() {
      if (!this.data) return;

      // Collect entries for visible refs, deduplicate by entry id
      const seen = new Set<string>();
      const visible: ApparatusEntry[] = [];

      for (const ref of Array.from(this.visibleRefs).sort()) {
        const entries = this.refIndex.get(ref) ?? [];
        for (const entry of entries) {
          if (!seen.has(entry.id)) {
            seen.add(entry.id);
            visible.push(entry);
          }
        }
      }

      // Sort by start ref (display order matches text order)
      visible.sort((a, b) => {
        const ra = (a.targets[0] as ApparatusTarget).ref ??
          (a.targets[0] as ApparatusTarget).refRange?.start ?? "";
        const rb = (b.targets[0] as ApparatusTarget).ref ??
          (b.targets[0] as ApparatusTarget).refRange?.start ?? "";
        return ra.localeCompare(rb);
      });

      this.render(visible);
    }

    private render(entries: ApparatusEntry[]) {
      if (!this.data) return;

      // Determine current page label from first visible ref
      const firstRef = Array.from(this.visibleRefs).sort()[0] ?? "";
      const pageLabel = firstRef ? pageFromRef(firstRef) : "—";

      // Build sigla legend
      const siglaHtml = Object.entries(this.data.sigla)
        .map(([k, v]) => `<span class="siglum"><b>${k}</b> = ${v}</span>`)
        .join(" &ensp; ");

      const entriesHtml = entries.length
        ? `<ul class="app-entries">${entries.map(renderEntry).join("")}</ul>`
        : `<p class="app-empty">No apparatus notes for visible lines.</p>`;

      this.innerHTML = `
        <div class="app-header">
          <span class="app-page-label">App. crit. ${pageLabel}</span>
          ${siglaHtml ? `<span class="app-sigla">${siglaHtml}</span>` : ""}
          <button class="app-toggle" aria-label="Toggle apparatus panel" title="Toggle">
            <span class="app-toggle-icon">▾</span>
          </button>
        </div>
        <div class="app-body">${entriesHtml}</div>
      `;

      // Re-attach toggle listener after re-render
      this.querySelector(".app-toggle")?.addEventListener("click", () => {
        this.collapsed = !this.collapsed;
        this.classList.toggle("collapsed", this.collapsed);
      });
    }
  };
}
