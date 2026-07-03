// Adapted from openplato (openplatodotorg-rfh-fork/src/utils/processTei.ts)
// Original source: https://github.com/raffazizzi/astro-tei
import CETEI from "CETEIcean";
import { JSDOM } from "jsdom";
import { createBehaviors } from ".";
import { resolveScheme } from "./referenceSchemes";
import type { DialogueConfig } from "../types";

type PartialConfig = Omit<DialogueConfig, "referenceScheme"> & Partial<Pick<DialogueConfig, "referenceScheme">>;

const DEFAULT_CONFIG: PartialConfig = {
  teiTitle: { gr: "", en: "" },
  firstLineReference: "",
};

export interface ProcessedTei {
  dom: Document;
  serialized: string;
  elements: string[];
}

const processTei = (data: string, language: "en" | "gr" = "gr", config: PartialConfig = DEFAULT_CONFIG): ProcessedTei => {
  // Parse TEI XML
  const xmlJdom = new JSDOM(data, { contentType: "text/xml" });
  const xmlDoc = xmlJdom.window.document;

  // Resolve reference scheme from the document unless caller supplied one
  const referenceScheme = config.referenceScheme ?? resolveScheme(xmlDoc);
  const resolvedConfig: DialogueConfig = { ...config, referenceScheme };

  // Use an HTML JSDOM as element factory so preprocess() creates HTMLElement nodes
  // (which have .style). An XML document produces plain Element nodes without CSS support.
  const htmlJdom = new JSDOM("");
  const htmlDoc = htmlJdom.window.document;

  const ceteicean = new CETEI({ documentObject: htmlDoc });

  ceteicean.addBehaviors({
    tei: createBehaviors(language, resolvedConfig),
  });

  const teiData = ceteicean.preprocess(xmlDoc);
  teiData.firstElementChild?.setAttribute(
    "data-elements",
    Array.from(ceteicean.els).join(","),
  );

  // Apply behaviors server-side via fallback() rather than applyBehaviors(),
  // which checks for window.customElements (not available in JSDOM).
  (ceteicean as any).fallback(Array.from(ceteicean.els));

  htmlDoc.body.appendChild(teiData);

  return {
    dom: htmlDoc,
    serialized: htmlDoc.body.innerHTML,
    elements: Array.from(ceteicean.els) as string[],
  };
};

export { processTei as default, processTei };
