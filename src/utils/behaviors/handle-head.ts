import type { DialogueConfig } from "../../types";

type Language = "en" | "gr";

export const createHandleHead = (language: Language, config: DialogueConfig) => (element: HTMLElement) => {
  const doc = element.ownerDocument;
  element.textContent = "";
  element.classList.add("tei-grid");

  const title = doc.createElement("h1");
  title.textContent = config.teiTitle[language] ?? config.teiTitle.en;
  title.classList.add("tei-head-title");

  element.append(title);
};
