# @flavian/pipeline

Conversion pipeline for InDesign (and future) sources into WordPress FSE themes.

## Status

This package currently ships the **IDML parser and intermediate representation** (sub-issue #62 of the InDesign-to-WordPress epic). Downstream stages — PDF fallback (#63), style + token mapper (#64), output generator (#65) — will land as separate PRs. The IR shape produced here is the contract those stages consume.

## Layout

```
packages/pipeline/
├── bin/parse-idml.mjs        CLI entry; prints validated IR JSON on stdout
└── src/
    ├── index.js              Re-exports the InDesign surface
    └── indesign/
        ├── ir.js             zod schemas + JSDoc typedefs for the IR
        ├── parse-idml.js     Main entry: unzips + orchestrates + cross-refs + validates
        ├── units.js          pt/pc/mm/cm/in → px at configurable DPI
        ├── warnings.js       Non-fatal warning collector
        └── parsers/
            ├── xml.js        fast-xml-parser wrapper
            ├── designmap.js  designmap.xml → manifest with paths
            ├── resources.js  Graphic.xml + Fonts.xml + Styles.xml
            ├── stories.js    Stories/Story_*.xml → text runs
            └── spreads.js    Spreads/*.xml + MasterSpreads/*.xml
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

- **Throws** on structural problems that make the IR meaningless: missing `designmap.xml`, malformed zip, a `<Spread>` element that lacks `Self`.
- **Warns and continues** on everything else: missing optional resource files, dangling style references, unknown color spaces, empty stories, unrecognized unit suffixes.

The CLI surfaces warnings on stderr and exits 0 unless the IR itself failed to build.

## Testing

```bash
pnpm --filter @flavian/pipeline test
```

Tests build minimal IDML zips programmatically (see `tests/indesign/helpers/build-idml.js`) — no binary fixtures in git. The fixture builder mirrors the IDML XML grammar the parser reads, so adding a new test case is usually one option flag.

## Adding a new input format

When sub-issues for Figma / Canva migrations land, mirror the InDesign layout: a sibling directory under `src/`, its own IR schema, and a `parsers/` subdir for any input-format-specific decoders. The top-level `src/index.js` re-exports each surface so consumers `import { parseIdml, parseFigma } from '@flavian/pipeline'`.
