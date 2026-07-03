// Adapted from openplato (openplatodotorg-rfh-fork/src/components/Tei/TeiCustomElement.ts)
import { injectAnchors } from "../../scripts/injectAnchors";
import { annotate } from "../../scripts/annotate";

export interface TeiElementConfig {
  rootId?: string;
  elements: string[];
}

export function applyTeiConfig(element: HTMLElement, config: TeiElementConfig): void {
  if (config.rootId) {
    element.id = config.rootId;
  }

  // Inject anchors and lemma annotations client-side
  // (TEI behaviors are applied server-side by processTei)
  const doInject = () => {
    const anchorIndex = injectAnchors(element);
    annotate(element, anchorIndex);

    element.dispatchEvent(
      new CustomEvent("tei-annotations-ready", {
        detail: { anchorIndex },
        bubbles: true,
      })
    );
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doInject, { once: true });
  } else {
    doInject();
  }

  element.style.display = "block";
}

export function parseDatasetConfig(dataset: DOMStringMap): TeiElementConfig {
  return {
    rootId: dataset.rootId,
    elements: dataset.elements?.split(",") || [],
  };
}

export function createTeiCustomElement(): typeof HTMLElement {
  return class TeiContainer extends HTMLElement {
    private controller: AbortController | null = null;

    connectedCallback() {
      if (this.controller) this.controller.abort();
      this.controller = new AbortController();
      const config = parseDatasetConfig(this.dataset);
      applyTeiConfig(this, config);
    }

    disconnectedCallback() {
      this.controller?.abort();
    }
  };
}
