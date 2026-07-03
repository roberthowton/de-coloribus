/**
 * Tests for the <lb> injection logic in scripts/build-text.ts.
 * We test the core logic directly since the full build-text.ts does file I/O.
 */
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";

const TEI_NS = "http://www.tei-c.org/ns/1.0";

/**
 * Minimal reimplementation of the build-text injection logic for testing.
 * See scripts/build-text.ts for the full version with file I/O.
 */
function injectLineBegins(xmlStr: string): string {
  const { window } = new JSDOM(xmlStr, { contentType: "text/xml" });
  const doc = window.document;

  for (const div of Array.from(doc.querySelectorAll('div[type="Bekker-page"]'))) {
    const pageRef = div.getAttribute("n")!;
    const p = div.querySelector("p");
    if (!p) continue;

    const headLabel = p.querySelector('label[type="head"]');
    const textNodes: Text[] = [];
    const walker = doc.createTreeWalker(p, 0x4);
    let tn: Node | null;
    while ((tn = walker.nextNode())) {
      if ((tn as Text).parentElement?.closest('label[type="head"]')) continue;
      textNodes.push(tn as Text);
    }

    let lineNum = 0;
    let skipNextNewline = Boolean(headLabel);
    let needFirstLb = !headLabel;

    for (const textNode of textNodes) {
      const text = textNode.textContent || "";
      const parent = textNode.parentNode!;
      const nextSibling = textNode.nextSibling;
      const parts = text.split("\n");
      const replacement: Node[] = [];

      for (let i = 0; i < parts.length; i++) {
        const segment = parts[i];
        if (i === 0) {
          if (needFirstLb && segment.trim()) {
            needFirstLb = false;
            lineNum = 1;
            const lb = doc.createElementNS(TEI_NS, "lb");
            lb.setAttribute("n", `${pageRef}${lineNum}`);
            replacement.push(lb);
          }
          if (segment) replacement.push(doc.createTextNode(segment));
        } else {
          if (skipNextNewline) {
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
      for (const node of replacement) parent.insertBefore(node, nextSibling || null);
      parent.removeChild(textNode);
    }
    p.querySelectorAll("pb, cb").forEach((el) => el.remove());
  }

  return new window.XMLSerializer().serializeToString(doc);
}

describe("injectLineBegins — standard div (no label)", () => {
  const src = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<div type="Bekker-page" n="791b">
<p>σθαι τὰς ἀκτῖνας·
ἅπαντα εἶναι δοκεῖ
μέλανα</p>
</div>
</body></text></TEI>`;

  const result = injectLineBegins(src);

  it("inserts lb1 before first text content", () => {
    expect(result).toContain('<lb n="791b1"');
    expect(result).toMatch(/lb n="791b1"[^>]*>[^<]*σθαι/);
  });

  it("inserts lb2 at the second line", () => {
    expect(result).toContain('<lb n="791b2"');
    expect(result).toMatch(/lb n="791b2"[^>]*>[^<]*ἅπαντα/);
  });

  it("inserts lb3 at the third line", () => {
    expect(result).toContain('<lb n="791b3"');
  });
});

describe("injectLineBegins — div with <label type='head'> (791a)", () => {
  const src = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<div type="Bekker-page" n="791a">
<p><label type="head"><hi>ΠΕΡΙ ΧΡΩΜΑΤΩΝ</hi></label>
Ἁπλᾶ τῶν χρωμάτων
οἷον πυρί</p>
</div>
</body></text></TEI>`;

  const result = injectLineBegins(src);

  it("does NOT insert lb before the title label", () => {
    // No lb should appear inside or immediately before the label text
    expect(result).not.toMatch(/<lb[^>]+>[^<]*ΠΕΡΙ/);
  });

  it("inserts lb1 before first text after label separator", () => {
    expect(result).toContain('<lb n="791a1"');
    expect(result).toMatch(/lb n="791a1"[^>]*>[^<]*Ἁπλᾶ/);
  });

  it("inserts lb2 at the second text line", () => {
    expect(result).toContain('<lb n="791a2"');
    expect(result).toMatch(/lb n="791a2"[^>]*>[^<]*οἷον/);
  });
});

describe("injectLineBegins — removes <pb> and <cb>", () => {
  const src = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<div type="Bekker-page" n="791a">
<p>line one <cb/>
line two <pb n="2"/>
line three</p>
</div>
</body></text></TEI>`;

  const result = injectLineBegins(src);

  it("removes <cb/> elements", () => {
    expect(result).not.toMatch(/<cb/);
  });

  it("removes <pb/> elements", () => {
    expect(result).not.toMatch(/<pb/);
  });
});
