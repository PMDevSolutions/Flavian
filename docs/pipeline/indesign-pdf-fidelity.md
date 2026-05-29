# InDesign PDF fallback: fidelity guide

The InDesign-to-WordPress pipeline prefers **IDML** (`.idml`) as its input. When
IDML isn't available — a client only has the exported PDF, or you want to
cross-check IDML output — the pipeline can parse a **PDF exported from InDesign**
instead.

PDF is intentionally a *fallback*. A PDF has no named styles, no text frames,
and no swatch palette; it's a bag of absolutely-positioned glyph runs, fill
colors, and placed images. The parser reconstructs an approximate version of the
same [intermediate representation](../../packages/pipeline/src/indesign/ir.js)
the IDML parser produces, so the downstream mapper and generator can consume
either source. **We never aim for pixel-perfect reconstruction — we aim for a
usable, styled IR that the generator can turn into WordPress patterns with
manual touch-ups.**

## Usage

```bash
# Print the reconstructed IR as JSON; fidelity warnings go to stderr.
node packages/pipeline/bin/parse-pdf.mjs brochure.pdf > ir.json

# Also extract embedded images to an asset cache directory (as PNG).
node packages/pipeline/bin/parse-pdf.mjs brochure.pdf --asset-dir ./assets > ir.json
```

```js
import { parsePdf } from '@flavian/pipeline';

const ir = await parsePdf('./brochure.pdf', {
  dpi: 96,                       // unit normalization (default 96)
  assetCacheDir: './assets',     // optional; write extracted images here
  swatchPalette: idml.swatches,  // optional; snap detected colors to IDML swatches
});
```

## How reconstruction works

| IR element | How it's derived from the PDF |
| --- | --- |
| `Spread` (one per page) | One spread per PDF page; page size from the MediaBox. |
| `TextFrame` | Glyph runs are grouped into lines (shared baseline), then lines into frames (vertically adjacent + horizontally overlapping). A wide horizontal gap on a shared baseline is treated as a **column gutter**, so side-by-side columns become separate frames. |
| `Story` / `TextRun` | One story per text frame; each run carries the paragraph-style reference of its font-size bucket. |
| `Style` | Synthesized from the font-size distribution: the most-used size is **Body**, larger sizes become **Heading 1..6** (largest first), smaller sizes become **Caption**. Each bucket records its dominant font and fill color. |
| `Font` | Resolved from each run's PostScript name (subset prefixes like `ABCDEF+` stripped); family/style split on the `-` and refined with pdfjs bold/italic flags. |
| `Swatch` | Distinct fill colors found in the content stream, normalized to hex. With a `swatchPalette`, each color snaps to the nearest IDML swatch (so PDF and IDML produce aligned token names). |
| `ImageFrame` | Image XObjects, placed via the current transform matrix. Pixels are PNG-encoded into the asset cache; `href` points at the cache-relative path. |
| `MasterSpread` | Always empty — PDF has no master pages. |

## Fidelity warnings

Every PDF parse attaches warnings describing the approximations made. They appear
on the CLI's stderr and in `ir.warnings`. Treat them as a checklist of things to
verify by eye.

| Code | Meaning | When |
| --- | --- | --- |
| `pdf-fallback` | The whole IR is approximate; prefer IDML if you have it. | Always |
| `text-reconstructed-from-glyphs` | Text came from positioned glyph runs; ligatures, hidden text, and reading order may differ. | Always |
| `styles-synthesized` | Paragraph styles are font-size buckets, not real named styles. | When any text exists |
| `no-embedded-fonts` | No fonts are embedded; family/style mapping is best-effort from PostScript names. | No embedded fonts found |
| `color-attribution-approximate` | Colors are bucketed by font size, not resolved per run. | When any colored text exists |
| `vector-paths-dropped` | Vector paths / image masks were detected but aren't represented in the IR. | When the page draws vector fills/strokes |
| `multi-column-layout` | A page was split into N columns / separate frames. | When >1 column is detected |
| `image-extract-failed` | An image couldn't be decoded (e.g. an unsupported filter). | Per failed image |
| `empty-page` | A page produced no text or image frames. | Per empty page |
| `asset-write-failed` | An extracted image couldn't be written to the asset cache. | Per failed write |

## Round-trip tolerances

The test suite builds the *same logical document* as both IDML and PDF and
asserts the two IRs agree within these tolerances (see
`packages/pipeline/tests/indesign/pdf-roundtrip.test.mjs`):

| Quantity | Tolerance |
| --- | --- |
| Page / spread count | Exact |
| Image frame count | Exact |
| Text frame count | Within ±1 |
| Style bucket count | Within ±1 |
| Swatch identity | Detected PDF colors snap onto the IDML swatch palette |

These are deliberately loose on text-frame and style counts: where InDesign knows
a frame is one frame, the PDF only shows glyph positions, so a heading and its
body paragraph may merge or split by ±1 depending on spacing.

## Known limitations

- **Geometry is approximate.** Frame rectangles are derived from glyph baselines
  using nominal ascent/descent ratios (0.8 / 0.2 of font size), not true font
  metrics. Rotated or skewed text is flattened to its axis-aligned bounding box.
- **Per-run color is not resolved.** Color is attributed at the style-bucket
  (font-size) level, because the IR carries color on `Style`, not `TextRun`.
- **Vector art is dropped.** Backgrounds, rules, and shapes drawn as vector paths
  are noted via `vector-paths-dropped` but not reconstructed.
- **Image masks aren't extracted.** Stencil-masked images paint the current fill
  through a 1-bit mask and have no extractable raster; they're treated as vector
  content.
- **Leading/tracking are omitted.** The fallback doesn't infer line spacing or
  tracking; the mapper applies its own defaults.

When fidelity matters, export IDML from InDesign and use the
[IDML parser](../../packages/pipeline/README.md) instead.
