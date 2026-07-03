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

function pageFromRef(ref: string): string {
  const m = /^(\d+[ab])/.exec(ref);
  return m ? m[1] : ref;
}

function renderEntry(entry: ApparatusEntry): string {
  const lemma = (entry.targets[0] as ApparatusTarget).lemma ?? "";
  const note = entry.note ?? "";
  return `<li class="app-entry" data-entry-id="${entry.id}">
    <span class="app-ref">${entry.displayRef}</span>
    ${lemma ? `<span class="app-lemma-text">${lemma}]</span>` : ""}
    <span class="app-note">${note}</span>
  </li>`;
}

export function createApparatusPanelElement(): typeof HTMLElement {
  return class ApparatusPanel extends HTMLElement {
    private data: ApparatusJson | null = null;
    private refIndex: Map<string, ApparatusEntry[]> = new Map();
    private visibleRefs: Set<string> = new Set();
    private observer: IntersectionObserver | null = null;
    private rafPending: boolean = false;
    private collapsed: boolean = false;
    private pinnedEntries: Set<string> = new Set();
    private hoveredEntry: string | null = null;
    private highlightsEnabled: boolean = true;

    connectedCallback() {
      this.init();
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
    }

    private observeLines() {
      const container = document.querySelector("tei-container");
      if (!container) return;

      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
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

      visible.sort((a, b) => {
        const ra =
          (a.targets[0] as ApparatusTarget).ref ??
          (a.targets[0] as ApparatusTarget).refRange?.start ??
          "";
        const rb =
          (b.targets[0] as ApparatusTarget).ref ??
          (b.targets[0] as ApparatusTarget).refRange?.start ??
          "";
        return ra.localeCompare(rb);
      });

      this.render(visible);
    }

    /** Recompute all .app-lemma highlights based on current state. */
    private updateHighlights() {
      for (const span of Array.from(
        document.querySelectorAll<HTMLElement>(".app-lemma")
      )) {
        const ids = span.dataset.entryIds?.split(",") ?? [];
        const on =
          this.highlightsEnabled &&
          ids.some(
            (id) => this.pinnedEntries.has(id) || id === this.hoveredEntry
          );
        span.classList.toggle("highlighted", on);
      }
    }

    private render(entries: ApparatusEntry[]) {
      if (!this.data) return;

      // DOM is being replaced; clear transient hover state
      this.hoveredEntry = null;

      const firstRef = Array.from(this.visibleRefs).sort()[0] ?? "";
      const pageLabel = firstRef ? pageFromRef(firstRef) : "—";

      const siglaHtml = Object.entries(this.data.sigla)
        .map(([k, v]) => `<span class="siglum"><b>${k}</b> = ${v}</span>`)
        .join(" &ensp; ");

      const entriesHtml = entries.length
        ? `<ul class="app-entries">${entries.map(renderEntry).join("")}</ul>`
        : `<p class="app-empty">No apparatus notes for visible lines.</p>`;

      const hlActive = this.highlightsEnabled ? " active" : "";

      this.innerHTML = `
        <div class="app-header">
          <span class="app-page-label">App. crit. ${pageLabel}</span>
          ${siglaHtml ? `<span class="app-sigla">${siglaHtml}</span>` : ""}
          <div class="app-controls">
            <button class="app-hl-toggle${hlActive}" aria-label="Toggle highlights" title="Toggle highlights">✦</button>
            <button class="app-toggle" aria-label="Toggle apparatus panel" title="Toggle panel">
              <span class="app-toggle-icon">▾</span>
            </button>
          </div>
        </div>
        <div class="app-body">${entriesHtml}</div>
      `;

      // Restore pinned visual state on newly-rendered entries
      for (const li of Array.from(
        this.querySelectorAll<HTMLElement>(".app-entry")
      )) {
        if (li.dataset.entryId && this.pinnedEntries.has(li.dataset.entryId)) {
          li.classList.add("pinned");
        }
      }

      // Re-apply highlight state (pinned entries survive re-renders)
      this.updateHighlights();

      // Panel collapse toggle
      this.querySelector(".app-toggle")?.addEventListener("click", () => {
        this.collapsed = !this.collapsed;
        this.classList.toggle("collapsed", this.collapsed);
      });

      // Global highlights toggle
      this.querySelector(".app-hl-toggle")?.addEventListener("click", () => {
        this.highlightsEnabled = !this.highlightsEnabled;
        this.querySelector(".app-hl-toggle")?.classList.toggle(
          "active",
          this.highlightsEnabled
        );
        this.updateHighlights();
      });

      // Per-entry: hover + click
      for (const li of Array.from(
        this.querySelectorAll<HTMLElement>(".app-entry")
      )) {
        const id = li.dataset.entryId;
        if (!id) continue;

        li.addEventListener("mouseenter", () => {
          this.hoveredEntry = id;
          this.updateHighlights();
        });
        li.addEventListener("mouseleave", () => {
          this.hoveredEntry = null;
          this.updateHighlights();
        });
        li.addEventListener("click", () => {
          if (this.pinnedEntries.has(id)) {
            this.pinnedEntries.delete(id);
            li.classList.remove("pinned");
          } else {
            this.pinnedEntries.add(id);
            li.classList.add("pinned");
          }
          this.updateHighlights();
        });
      }
    }
  };
}
