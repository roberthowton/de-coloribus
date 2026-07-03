/**
 * build-text.ts
 *
 * Inject <lb n="..."/> milestones into the TLG/Diogenes-exported XML for
 * De Coloribus. The source file (tlg0086007.xml) has no explicit line markers —
 * Bekker lines are encoded as physical newlines inside <p> elements within
 * <div type="Bekker-page" n="..."> divisions.
 *
 * This script:
 * 1. Reads the source XML.
 * 2. For each <div type="Bekker-page" n="Xnn"> (e.g. "791a"), splits the
 *    text content of <p> on physical newlines and inserts <lb n="XnnN"/>
 *    before each line. The <label type="head"> (title on 791a) is excluded
 *    from line numbering; the title-separator newline is skipped.
 * 3. Strips <pb/> and <cb/> physical-print break markers (redundant with
 *    the logical <div n="..."> column structure).
 * 4. Writes the processed XML to src/content/de-coloribus.xml.
 *
 * Run: tsx scripts/build-text.ts
 */

import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "tlg0086007.xml");
const OUT = resolve(ROOT, "src/content/de-coloribus.xml");

const TEI_NS = "http://www.tei-c.org/ns/1.0";

function injectLineBegins(xmlStr: string): string {
  const { window } = new JSDOM(xmlStr, { contentType: "text/xml" });
  const doc = window.document;

  for (const div of Array.from(
    doc.querySelectorAll('div[type="Bekker-page"]')
  )) {
    const pageRef = div.getAttribute("n")!; // e.g. "791a"
    const paragraphs = Array.from(div.querySelectorAll("p"));
    if (!paragraphs.length) continue;

    // Does the first <p> have a <label type="head"> (i.e., 791a with the title)?
    const headLabel = paragraphs[0].querySelector('label[type="head"]');

    let lineNum = 0;
    // For label divs (791a): line 1 starts after the first \n that follows
    // the closing </label>. We skip that separator newline.
    let skipNextNewline = Boolean(headLabel);
    // For non-label divs: we need to insert lb1 before the very first text.
    let needFirstLb = !headLabel;

    // Process ALL paragraphs in the div, carrying lineNum across them so
    // multi-paragraph pages get continuous Bekker line numbers.
    for (const p of paragraphs) {
      // Collect text nodes NOT inside <label type="head">
      const textNodes: Text[] = [];
      const walker = doc.createTreeWalker(p, 0x4 /* NodeFilter.SHOW_TEXT */);
      let tn: Node | null;
      while ((tn = walker.nextNode())) {
        if ((tn as Text).parentElement?.closest('label[type="head"]')) continue;
        textNodes.push(tn as Text);
      }

      for (const textNode of textNodes) {
        const text = textNode.textContent || "";
        const parent = textNode.parentNode!;
        const nextSibling = textNode.nextSibling;

        const parts = text.split("\n");
        const replacement: Node[] = [];

        for (let i = 0; i < parts.length; i++) {
          const segment = parts[i];

          if (i === 0) {
            // Content before the first \n in this text node.
            if (needFirstLb && segment.trim()) {
              // Insert lb1 before the first actual text in a non-label div.
              needFirstLb = false;
              lineNum = 1;
              const lb = doc.createElementNS(TEI_NS, "lb");
              lb.setAttribute("n", `${pageRef}${lineNum}`);
              replacement.push(lb);
            }
            if (segment) replacement.push(doc.createTextNode(segment));
          } else {
            // Content following a \n.
            if (skipNextNewline) {
              // This is the separator \n right after </label> on 791a.
              // The text AFTER this \n is Bekker line 1.
              skipNextNewline = false;
              lineNum = 1;
              if (segment.trim()) {
                const lb = doc.createElementNS(TEI_NS, "lb");
                lb.setAttribute("n", `${pageRef}${lineNum}`);
                replacement.push(lb);
              }
              if (segment) replacement.push(doc.createTextNode(segment));
            } else {
              lineNum++;
              const lb = doc.createElementNS(TEI_NS, "lb");
              lb.setAttribute("n", `${pageRef}${lineNum}`);
              replacement.push(lb);
              if (segment) replacement.push(doc.createTextNode(segment));
            }
          }
        }

        for (const node of replacement) {
          parent.insertBefore(node, nextSibling || null);
        }
        parent.removeChild(textNode);
      }

      // Remove physical-print break markers from each paragraph.
      p.querySelectorAll("pb, cb").forEach((el) => el.remove());
    }
  }

  return new window.XMLSerializer().serializeToString(doc);
}

const src = readFileSync(SRC, "utf-8");
const result = injectLineBegins(src);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, result, "utf-8");

const lbCount = (result.match(/<lb /g) ?? []).length;
console.log(`✓ Built ${OUT} (${lbCount} <lb> milestones injected)`);
