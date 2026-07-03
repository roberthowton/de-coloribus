# De Coloribus — Online Critical Edition

An online critical edition of Aristotle's *De Coloribus* (ΠΕΡΙ ΧΡΩΜΑΤΩΝ, "On Colors"),
presenting the Greek text with an interactive **critical apparatus that tracks the
visible text** as you scroll.

Live at **[coloribus.roberthowton.com](https://coloribus.roberthowton.com)**
(linked from [roberthowton.com](https://roberthowton.com), visible in dev until beta).

---

## Project goal

Produce a working **edited Greek text + new English translation** of *De Coloribus*.
This site is the digital home for that project: the reader is designed so a parallel
translation column can be added alongside the Greek once translation work begins.
The apparatus captures the evidence for editorial decisions.

---

## Text base and apparatus

- **Greek text:** TLG/Diogenes export of TLG 0086.007 (Aristotle, *De Coloribus*),
  based on Bekker's *Aristotelis opera*, vol. 2, Berlin: Reimer, 1831 (repr. 1960).
- **Critical apparatus:** Manually authored in `src/content/apparatus/de-coloribus.yml`,
  keyed to Bekker page–column–line references (e.g. `791a10`). Edition basis is the
  same Bekker text, so text and apparatus share one reference frame.
- **Manuscript sigla** are listed in the YAML file and displayed in the apparatus panel.

---

## Architecture

### 1. Text pipeline

The TLG source (`tlg0086007.xml`) is a bare TEI file with `<div type="Bekker-page"
n="791a">` divisions and `<p>` elements. Physical newlines within `<p>` are the
Bekker print lines — so line 10 of page 791a contains `μεταβαλλόντων`, matching
Bekker's print edition exactly.

A build step (`scripts/build-text.ts`) injects `<lb n="791a10"/>` milestones at each
newline, producing `src/content/de-coloribus.xml` (gitignored; generated on every
build). The `<label type="head">` title (791a only) is excluded from line numbering;
the physical-print `<pb/>` and `<cb/>` markers are stripped.

### 2. Rendering pipeline (ported from [openplato.org](https://openplato.org))

**Server-side (Astro SSR):**
- `src/utils/processTei.ts` — [CETEIcean](https://github.com/TEIC/CETEIcean) converts
  TEI XML into `tei-*` custom elements inside JSDOM.
- `src/utils/referenceSchemes/bekker.ts` — the **Bekker reference scheme** (implements
  the `ReferenceScheme` interface): parses `791a10` → `{page:"791", column:"a",
  line:"10"}`; controls which line numbers appear in the margin (1, 5, 10, 15, 20…).
- `src/utils/behaviors/handle-line-begin.ts` — for each `<lb n>`, extracts the text
  to the next `<lb>` into a grid row with a margin line-number marker.
- All processing runs at request time; the browser receives rendered HTML.

**Client-side:**
- `src/scripts/injectAnchors.ts` — drops `<span class="tei-anchor">` after each
  `<lb>` that has an apparatus entry, keyed by the Bekker ref.
- `src/scripts/annotate.ts` — segment-decomposition wraps the lemma text in
  `<span class="app-lemma">`, supporting lemmas that cross `<lb>` boundaries.
- `src/components/ApparatusPanel/ApparatusPanelElement.ts` — **IntersectionObserver**
  tracks which `.text-line` elements are on screen; on each viewport change (rAF-
  throttled) re-renders the docked apparatus panel with the notes for visible lines.
  Range entries (`ref: {start, end}`) appear when any covered line is on screen.

### 3. Apparatus data model

`src/content/apparatus/de-coloribus.yml`:

```yaml
sigla:
  E: "Parisiensis 1853"

entries:
  - ref: "791a10"                         # single line
    lemma: "μεταβαλλόντων"
    note: "μεταβάλλουσι Portius"

  - ref: { start: "791a19", end: "791a20" }  # range (lemma crosses line-break)
    lemma: "φαίνεται δὲ"
    note: "…"
```

`ref` is either a Bekker ref string or `{start, end}`. The `lemma` is the exact
substring to highlight in the text; it is matched by the client-side annotation
engine (proximity-based, handles line-crossing). If omitted, the entire range is
highlighted.

---

## Development

```bash
pnpm install

# Copy the source XML to the project root (once):
cp ~/path/to/tlg0086007.xml .

# Build processed text + dev server:
pnpm dev    # runs build-text.ts, then astro dev

# Or separately:
tsx scripts/build-text.ts   # inject <lb> milestones → src/content/de-coloribus.xml
pnpm astro dev
```

### Deployment

```bash
pnpm build           # build-text.ts + astro check + astro build
vercel deploy        # preview
vercel deploy --prod # production → coloribus.roberthowton.com
```

Environment: **Vercel**, SSR via `@astrojs/vercel`.

---

## Roadmap

- [x] Greek text, Bekker line markers, apparatus panel tracking viewport
- [x] Lemma highlighting in-text (with line-crossing support)
- [ ] Add more apparatus entries from Bekker's full collation
- [ ] English translation column (parallel, scroll-synced — see `src/styles/global.css`
      `.text-columns` grid comment for where to add it)
- [ ] Morphology-on-click (hover over a word → parse + gloss; tooling exists in
      the roberthowton.com morph pipeline and openplato fork)
- [ ] Mobile layout optimization
- [ ] Dark mode

---

## Credits

The TEI rendering pipeline is ported from
**[openplato.org](https://openplato.org)** (MIT license); CETEIcean is by
[Raffaele Viglianti / TEIC](https://github.com/TEIC/CETEIcean).
Greek text sourced from the TLG corpus via Diogenes.
