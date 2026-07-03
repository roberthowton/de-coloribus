import type { DialogueConfig } from "../../types";

type Language = "en" | "gr";

export const createHandleTeiHeader = (language: Language, config: DialogueConfig) => (element: Element) => {
  const doc = element.ownerDocument;

  // Hide standard metadata elements rendered as block by default
  const title = element.querySelector("tei-title");
  const author = element.querySelector("tei-author");
  const editor = element.querySelector("tei-editor");
  title?.classList.add("tei-hidden");
  author?.classList.add("tei-hidden");
  editor?.classList.add("tei-hidden");

  const toHide = ["tei-sponsor", "tei-principal", "tei-respstmt", "tei-funder", "tei-publicationstmt", "tei-sourcedesc"];
  toHide.forEach((selector) => {
    element.querySelector(selector)?.classList.add("tei-hidden");
  });

  // Starting page reference (shown beside the title area)
  const scheme = config.referenceScheme;
  const firstRef = config.firstLineReference;
  const pageLabel = scheme.startingPageLabel
    ? scheme.startingPageLabel(firstRef)
    : firstRef;

  const startingPageDiv = doc.createElement("div");
  startingPageDiv.classList.add("edition-page-ref");
  startingPageDiv.textContent = pageLabel;
  startingPageDiv.setAttribute("aria-hidden", "true");

  // Append after tei-head if present; else append to header
  const teiContainer = element.closest("tei-container");
  const teiHead = teiContainer
    ? teiContainer.querySelector("tei-head")
    : (element.parentElement?.querySelector("tei-head") ?? doc.querySelector("tei-head"));
  if (teiHead) {
    teiHead.insertAdjacentElement("afterend", startingPageDiv);
  } else {
    element.appendChild(startingPageDiv);
  }
};
