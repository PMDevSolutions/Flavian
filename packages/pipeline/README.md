# @flavian/pipeline

Conversion pipeline for InDesign (and future) sources into WordPress FSE themes.

## Status

This package ships the **IDML parser** (sub-issue #62) and the **PDF fallback parser** (sub-issue #63) of the InDesign-to-WordPress epic. Both emit the same intermediate representation. Downstream stages — style + token mapper (#64), output generator (#65) — will land as separate PRs. The IR shape produced here is the contract those stages consume.

IDML is the primary path (full access to stories, frames, styles, swatches, masters). PDF is a lossy fallback for when only the exported PDF is available, or as a verification source against IDML output — see [`docs/pipeline/indesign-pdf-fidelity.md`](../../docs/pipeline/indesign-pdf-fidelity.md).

## Layout

```
packages/pipeline/
├── bin/
│   ├── parse-idml.mjs        CLI: IDML → validated IR JSON on stdout
│   └── parse-pdf.mjs         CLI: PDF → reconstructed IR JSON on stdout
└── src/
    ├── index.js              Re-exports the InDesign surface
    └── indesign/
        ├── ir.js             zod schemas + JSDoc typedefs for the IR
        ├── parse-idml.js     IDML entry: unzips + orchestrates + cross-refs + validates
        ├── parse-pdf.js      PDF entry: extracts + clusters + classifies + validates
        ├── units.js          pt/pc/mm/cm/in → px at configurable DPI
        ├── warnings.js       Non-fatal warning collector
        ├── parsers/          IDML XML decoders
        │   ├── xml.js        fast-xml-parser wrapper
        │   ├── designmap.js  designmap.xml → manifest with paths
        │   ├── resources.js  Graphic.xml + Fonts.xml + Styles.xml
        │   ├── stories.js    Stories/Story_*.xml → text runs
        │   └── spreads.js    Spreads/*.xml + MasterSpreads/*.xml
        └── pdf/              PDF reconstruction modules
            ├── pdfjs.js      Lazy pdfjs-dist loader (headless, extraction-only)
            ├── extract.js    Per-page: text runs, fonts, colors, images, vector flag
            ├── cluster.js    Glyph runs → lines → frames; column detection (pure)
            ├── classify.js   Font-size buckets → heading/body/caption styles (pure)
            ├── color.js      RGB/gray/CMYK → hex; nearest-swatch matching (pure)
            ├── png.js        Decoded pixels → PNG via node:zlib (pure)
            └── assets.js     Write extracted images to the asset cache
```

## Quick start

```js
import { parseIdml } from '@flavian/pipeline';

const ir = await parseIdml('./brochure.idml', { dpi: 96 });

for (const warning of ir.warnings) {
  console.warn(`[${warning.code}] ${warning.message}`);
}
for (const swatch of ir.swatches) {
  console.log(swatch.name, swatch.color.hex);
}
```

Or from the command line:

```bash
node packages/pipeline/bin/parse-idml.mjs my-document.idml > ir.json
```

### PDF fallback

When you only have a PDF exported from InDesign, use the fallback parser. It
emits the same IR, plus fidelity warnings describing every approximation it made.

```js
import { parsePdf } from '@flavian/pipeline';

const ir = await parsePdf('./brochure.pdf', {
  assetCacheDir: './assets',     // optional: write extracted images (PNG) here
  swatchPalette: idml?.swatches, // optional: snap detected colors to IDML swatches
});
```

```bash
node packages/pipeline/bin/parse-pdf.mjs brochure.pdf --asset-dir ./assets > ir.json
```

PDF reconstruction is lossy by design. See [`docs/pipeline/indesign-pdf-fidelity.md`](../../docs/pipeline/indesign-pdf-fidelity.md) for how each IR element is derived, the full list of fidelity-warning codes, and the round-trip tolerances against IDML.

## IR shape

The intermediate representation is described in [`src/indesign/ir.js`](src/indesign/ir.js). At the top level:

```js
{
  irVersion: 1,
  meta: { idmlVersion: '16.0', name: 'Brochure' },
  dpi: 96,
  swatches: [{ id, name, color: { hex, space } }],
  fonts: [{ id, family, style, postScriptName }],
  styles: [{ id, name, kind, fontSize, leading, tracking, fontRef, fillColorRef, properties }],
  stories: [{ id, source, runs: [{ text, paragraphStyleRef, characterStyleRef }] }],
  spreads: [{ id, source, pages, frames, appliedMasterRef }],
  masterSpreads: [{ id, source, name, pages, frames }],
  warnings: [{ code, message, context }],
}
```

Geometry (`Page.bounds`, `Frame.bounds`) is normalized to pixels at `dpi` (default 96). Frames are a discriminated union (`kind: 'text'` or `kind: 'image'`).

## Failure mode

Both parsers share the same philosophy: throw only when the document can't be read at all; otherwise emit a partial IR with warnings.

- **IDML throws** on missing `designmap.xml`, a malformed zip, or a `<Spread>` lacking `Self`; **warns** on missing optional resources, dangling references, unknown color spaces, empty stories, unrecognized units.
- **PDF throws** only when the file can't be opened as a PDF; **warns** on every approximation (text reconstructed from glyphs, synthesized styles, dropped vector paths, undecodable images, …). PDF parses always carry fidelity warnings — that's expected.

Each CLI surfaces warnings on stderr and exits 0 unless the IR itself failed to build.

## Testing

```bash
pnpm --filter @flavian/pipeline test
```

Tests build minimal fixtures programmatically — no binary fixtures in git. `tests/indesign/helpers/build-idml.js` emits IDML zips; `tests/indesign/helpers/build-pdf.js` emits PDFs (positioned text in base-14 fonts, FlateDecode image XObjects, vector fills). Building the *same logical document* both ways powers the IDML↔PDF round-trip test.

The PDF heuristics (clustering, classification, color, PNG encoding) are split into pure modules under `src/indesign/pdf/` and unit-tested without a PDF engine; only `extract.js` and the orchestrator touch pdfjs.

## Adding a new input format

When sub-issues for Figma / Canva migrations land, mirror the InDesign layout: a sibling directory under `src/`, its own IR schema, and a `parsers/` subdir for any input-format-specific decoders. The top-level `src/index.js` re-exports each surface so consumers `import { parseIdml, parseFigma } from '@flavian/pipeline'`.
