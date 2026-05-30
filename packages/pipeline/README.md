# @flavian/pipeline

Conversion pipeline for InDesign (and future) sources into WordPress FSE themes.

## Status

This package ships the **IDML parser** (sub-issue #62), the **PDF fallback parser** (sub-issue #63), the **style + token mapper** (sub-issue #64), and the **output generator** (sub-issue #65) of the InDesign-to-WordPress epic. The two parsers emit the same intermediate representation; the mapper turns that IR into WordPress design tokens (a `theme.json` partial, DTCG `design-tokens.json`, and a report); the output generator turns the IR plus those tokens into a complete, installable FSE theme (patterns, templates, parts, merged `theme.json`, asset scripts, and a generation report).

IDML is the primary path (full access to stories, frames, styles, swatches, masters). PDF is a lossy fallback for when only the exported PDF is available, or as a verification source against IDML output — see [`docs/pipeline/indesign-pdf-fidelity.md`](../../docs/pipeline/indesign-pdf-fidelity.md).

## Layout

```
packages/pipeline/
├── bin/
│   ├── parse-idml.mjs        CLI: IDML → validated IR JSON on stdout
│   ├── parse-pdf.mjs         CLI: PDF → reconstructed IR JSON on stdout
│   ├── map-tokens.mjs        CLI: IR (or .idml/.pdf) → theme.json + design tokens
│   └── generate-theme.mjs    CLI: IR (or .idml/.pdf) → complete FSE theme directory
├── config/
│   └── font-map.json         InDesign family → web/Google font fallback table
└── src/
    ├── index.js              Re-exports the InDesign surface
    └── indesign/
        ├── ir.js             zod schemas + JSDoc typedefs for the IR
        ├── parse-idml.js     IDML entry: unzips + orchestrates + cross-refs + validates
        ├── parse-pdf.js      PDF entry: extracts + clusters + classifies + validates
        ├── color.js          Shared color math: RGB/CMYK/LAB → sRGB + gamut, nearest-swatch
        ├── units.js          pt/pc/mm/cm/in → px at configurable DPI
        ├── warnings.js       Non-fatal warning collector
        ├── parsers/          IDML XML decoders
        │   ├── xml.js        fast-xml-parser wrapper
        │   ├── designmap.js  designmap.xml → manifest with paths
        │   ├── resources.js  Graphic.xml + Fonts.xml + Styles.xml
        │   ├── stories.js    Stories/Story_*.xml → text runs
        │   └── spreads.js    Spreads/*.xml + MasterSpreads/*.xml
        ├── pdf/              PDF reconstruction modules
        │   ├── pdfjs.js      Lazy pdfjs-dist loader (headless, extraction-only)
        │   ├── extract.js    Per-page: text runs, fonts, colors, images, vector flag
        │   ├── cluster.js    Glyph runs → lines → frames; column detection (pure)
        │   ├── classify.js   Font-size buckets → heading/body/caption styles (pure)
        │   ├── color.js      Re-exports the shared color helpers for the PDF path
        │   ├── png.js        Decoded pixels → PNG via node:zlib (pure)
        │   └── assets.js     Write extracted images to the asset cache
        ├── map/             IR → WordPress design tokens (token mapper)
        │   ├── index.js      mapTokens orchestrator → { partial, designTokens, merged, report }
        │   ├── colors.js     Swatches → color palette (convert, dedupe, reuse base)
        │   ├── typography.js Paragraph styles → font-size scale + element/block presets
        │   ├── spacing.js    Geometry + paragraph spacing → quantized spacing scale
        │   ├── fonts.js      Fonts → font families via config/font-map.json
        │   ├── theme-json.js Assemble partial, deep-merge with base, validate
        │   ├── design-tokens.js  DTCG / Style Dictionary emitter
        │   ├── report.js     Warnings + provenance aggregation
        │   ├── slug.js       Namespaced slug helpers
        │   └── schema/       Vendored WP theme.json schema + zod subset
        └── generate/        IR + tokens → installable FSE theme (output generator)
            ├── index.js      generateTheme orchestrator → { files, assets, themeJson, report }
            ├── layout.js     Spread frames → reading-order rows + column/cover detection
            ├── blocks.js     Frames → core block markup (heading/paragraph/image/cover)
            ├── patterns.js   Spread → pattern PHP file (one per spread)
            ├── parts.js      Master spreads → header/footer template parts
            ├── templates.js  index.html / page.html / 404.html
            ├── theme-files.js  style.css + functions.php
            ├── media.js      Asset staging plan + import-media.sh / seed-content.sh
            ├── report.js     indesign-pipeline-report.md (markdown)
            ├── escape.js     HTML/PHP escaping + get_theme_file_uri() helpers
            └── slugs.js      Deterministic theme/pattern/asset naming
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

## Token mapper

Map a parsed IR (from either parser) into WordPress design tokens: a `theme.json`
partial that merges into a base theme, a Style-Dictionary-compatible
`design-tokens.json`, and a report.

```js
import { parseIdml, mapTokens } from '@flavian/pipeline';

const ir = await parseIdml('./brochure.idml');
const { partial, designTokens, merged, report } = mapTokens(ir, {
  // base,        // base theme object/path (default: themes/flavian-shop/theme.json)
  // fontMap,     // font map object/path (default: config/font-map.json)
  // namespace,   // derived-token slug prefix (default: 'id')
  // tolerance,   // color dedupe/reuse squared distance
  // gridPx,      // spacing grid (default: 4)
  // tolerancePx, // typography size clustering tolerance (default: 1)
});

if (!report.valid) console.error(report.validationErrors);
for (const msg of report.fontFallbacks) console.warn(msg);
```

From the command line (composes with the parser CLIs, or parses directly):

```bash
node packages/pipeline/bin/parse-idml.mjs brochure.idml \
  | node packages/pipeline/bin/map-tokens.mjs --out-dir ./tokens > theme.partial.json

# or parse + map in one step
node packages/pipeline/bin/map-tokens.mjs brochure.idml --out-dir ./tokens
```

See [`docs/pipeline/indesign-token-mapper.md`](../../docs/pipeline/indesign-token-mapper.md) for the conversion math (CMYK/LAB → sRGB), the font-map format, the warning codes, merge semantics, and how the acceptance criteria are met.

## Output generator

Turn a parsed IR (plus the mapped tokens) into a complete, installable FSE
theme: one block pattern per spread under an **InDesign Imports** category,
templates and header/footer parts, the merged `theme.json`, asset import
scripts, and a generation report. `generateTheme` is pure and deterministic —
the same IR yields byte-identical files, so reruns never churn.

```js
import { parseIdml, generateTheme } from '@flavian/pipeline';

const ir = await parseIdml('./brochure.idml');
const { files, assets, report } = generateTheme(ir, {
  // slug, name,        // theme slug / display name (default: from the doc name)
  // seedContent: true, // also emit bin/seed-content.sh
  // tokens,            // a precomputed mapTokens() result (skips re-mapping)
});

for (const f of files) console.log(f.path); // [{ path, contents, mode? }]
```

From the command line (composes with the parser CLIs, or parses directly):

```bash
node packages/pipeline/bin/parse-idml.mjs brochure.idml \
  | node packages/pipeline/bin/generate-theme.mjs - --out-dir themes/brochure

# or parse + generate in one step, staging image bytes from a source dir
node packages/pipeline/bin/generate-theme.mjs brochure.idml \
  --out-dir themes/brochure --asset-dir ./images --seed-content
```

See [`docs/pipeline/indesign-output-generator.md`](../../docs/pipeline/indesign-output-generator.md) for the frame → block mapping, master → parts derivation, asset staging, and how the acceptance criteria are met.

## IR shape

The intermediate representation is described in [`src/indesign/ir.js`](src/indesign/ir.js). At the top level:

```js
{
  irVersion: 1,
  meta: { idmlVersion: '16.0', name: 'Brochure' },
  dpi: 96,
  swatches: [{ id, name, color: { hex, space, components } }],
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

The output generator's markup is covered by snapshot tests in `tests/indesign/generate.test.mjs`; the snapshots live in `tests/indesign/__snapshots__/`. Re-record them after an intentional change with `UPDATE_SNAPSHOTS=1 node --test tests/indesign/generate.test.mjs`.

## Adding a new input format

When sub-issues for Figma / Canva migrations land, mirror the InDesign layout: a sibling directory under `src/`, its own IR schema, and a `parsers/` subdir for any input-format-specific decoders. The top-level `src/index.js` re-exports each surface so consumers `import { parseIdml, parseFigma } from '@flavian/pipeline'`.
