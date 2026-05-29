# InDesign IR → WordPress design token mapper (design)

**Issue:** #64 — InDesign pipeline: style and design token mapper (sub-issue of #61)
**Date:** 2026-05-29
**Status:** Approved (brainstorm complete)
**Depends on:** #62 (IDML parser + IR), #63 (PDF fallback parser) — both merged.

## Goal

Map the InDesign intermediate representation (IR) — produced by either the IDML
parser (#62) or the PDF fallback parser (#63) — to WordPress design tokens: a
`theme.json` typography scale, color palette, spacing scale, font families, and
named per-element style presets. Generated patterns (the downstream #65
generator) then inherit a coherent design system instead of inline magic numbers.

The mapper reads a validated `Document` IR and emits:

1. A **`theme.json` partial** that deep-merges cleanly into Flavian's base theme.
2. A **`design-tokens.json`** in DTCG format (Style Dictionary v4 compatible).
3. A **generator report** listing warnings and provenance (style→slug,
   swatch→slug, font fallbacks).

## Approved decisions

| # | Fork | Decision |
|---|------|----------|
| 1 | Color conversion / IR contract | **Extend the IR Color additively** with raw `components`; the mapper performs documented CMYK→sRGB and LAB→sRGB conversion with out-of-gamut warnings. Centralize conversion in a shared module; route both parsers through it (this also fixes the current LAB/Spot→`#000000` bug). |
| 2 | Merge semantics | **Additive, namespaced partial** + a deep-merge helper. Derived tokens are namespaced so they never overwrite the base theme's curated slugs; the mapper also emits a merged preview. |
| 3 | Schema validation | **Both** — `ajv` against a vendored, pinned official `theme.json` schema for the emitted output, plus `zod` for the mapper's internal/emitted subset. |
| 4 | Typography scale | **Dynamic, clustered** — collapse near-duplicate paragraph-style sizes into a deduped scale; reuse base slugs when within tolerance, else derived slugs. Every entry is referenced by ≥1 paragraph style by construction. InDesign names preserved where reasonable. |

Defaults (overridable): `design-tokens.json` uses **DTCG** (`$value`/`$type`);
the CLI emits the partial to **stdout**, with all artifacts written to `--out-dir`.

## Architecture

New `map/` stage under `packages/pipeline/src/indesign/`. Pure ESM + JSDoc,
tested with `node:test`, matching existing pipeline conventions.

```
packages/pipeline/
├── bin/
│   └── map-tokens.mjs          # CLI: IR JSON (or .idml/.pdf) → artifacts
├── config/
│   └── font-map.json           # default InDesign-family → web/Google font table
├── src/indesign/
│   ├── color.js                # NEW shared: rgb/cmyk/lab/gray→sRGB + gamut, dedupe helpers
│   ├── ir.js                   # CHANGED: Color.components (optional)
│   ├── parsers/resources.js    # CHANGED: route colors through shared color.js, attach components
│   ├── pdf/color.js            # CHANGED: re-export shared primitives, attach components
│   └── map/
│       ├── index.js            # mapTokens(ir, options) orchestrator
│       ├── colors.js           # swatches → color.palette
│       ├── typography.js       # paragraph styles → fontSizes + styles.elements
│       ├── spacing.js          # geometry/paragraph spacing → spacingSizes
│       ├── fonts.js            # fonts → fontFamilies (via font-map.json)
│       ├── theme-json.js       # assemble partial + deep-merge with base
│       ├── design-tokens.js    # DTCG emitter
│       ├── report.js           # warnings + provenance aggregation
│       └── schema/
│           ├── theme-json.schema.json   # vendored, pinned official WP schema
│           └── partial.zod.js           # zod for the emitted subset
└── tests/indesign/
    ├── map-colors.test.mjs
    ├── map-typography.test.mjs
    ├── map-spacing.test.mjs
    ├── map-fonts.test.mjs
    ├── map-theme-json.test.mjs
    ├── map-design-tokens.test.mjs
    └── map-tokens.test.mjs      # e2e on both IDML-built and PDF-built IR
```

Public surface re-exported from `src/index.js`: `mapTokens`, and the artifact
types via JSDoc typedefs.

## IR change (additive, backward-compatible)

```js
export const Color = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/), // parse-time value (unchanged)
  space: z.enum(['RGB', 'CMYK', 'LAB', 'Spot', 'Unknown']),
  // Raw channel values in the source space's documented range. Optional so
  // older IRs (and pass-through callers) still validate; the mapper falls back
  // to `hex` when absent.
  components: z.array(z.number()).optional(),
});
```

Documented per-space component ranges:

| Space | Components | Range |
|-------|-----------|-------|
| RGB   | `[r, g, b]` | 0–255 |
| CMYK  | `[c, m, y, k]` | 0–100 |
| LAB   | `[L, a, b]` | L 0–100, a/b −128–127 |
| Gray  | `[v]` (stored as RGB) | 0–255 |

`irVersion` stays `1` (purely additive). Both parsers populate `components`;
LAB/Spot now route through the real conversion instead of falling back to black.

## Color conversion (shared `color.js`)

Centralizes all conversion so the IDML parser, PDF parser, and mapper agree.

- `rgbToSrgbHex([r,g,b])` — format only (already sRGB).
- `cmykToSrgb([c,m,y,k])` — naive, profile-free approximation
  `r = 255·(1−c/100)·(1−k/100)` (etc.). Documented as profile-free; it never
  clips, so no out-of-gamut signal is fabricated for CMYK.
- `labToSrgb([L,a,b])` — full colorimetric path:
  1. CIELAB → XYZ using reference white **D50** (`Xn=0.9642, Yn=1.0, Zn=0.8249`),
     with `ε = 216/24389`, `κ = 24389/27`.
  2. XYZ(D50) → linear sRGB via the Bradford-adapted matrix (folds D50→D65):
     ```
     [ 3.1338561 −1.6168667 −0.4906146
      −0.9787684  1.9161415  0.0334540
       0.0719453 −0.2289914  1.4052427 ]
     ```
  3. Out-of-gamut = any linear channel `<0` or `>1` before clamping → warning.
  4. Clamp → sRGB gamma (`12.92·c` or `1.055·c^(1/2.4)−0.055`) → ×255 → round.

Returns `{ hex, outOfGamut }`. Existing `cmykToHex`/`hexToRgb`/`colorDistance`/
`nearestSwatch` move here; `pdf/color.js` re-exports them so existing imports and
`pdf-color.test.mjs` keep passing.

## Color mapping (`map/colors.js`)

For each swatch: recompute hex from `components` via the shared conversion
(identical to IR hex for RGB/CMYK; better for LAB), then build `color.palette`:

- **Dedupe by hex within a configurable tolerance** (`colorDistance`); the
  representative keeps the most descriptive swatch name.
- Reuse a base palette slug when a swatch matches a base color within tolerance;
  otherwise emit a namespaced `id-<name>` slug.
- Warn on out-of-gamut LAB conversions and on Spot/Unknown approximations;
  warnings carry the swatch id/name and land in the report.

## Typography (`map/typography.js`)

1. Take `kind === 'paragraph'` styles with a `fontSize`.
2. Cluster by `fontSize` within a configurable tolerance; one scale entry per
   cluster (representative = most common / median size).
3. `size`: px → `rem` (÷16); optional fluid `clamp()` above a configurable
   threshold, mirroring the base theme. Static rem by default (deterministic).
4. Slug: reuse a base `fontSizes` slug (small…display, resolved to nominal px —
   `clamp()` anchored to its max) when within tolerance; else a derived slug.
   InDesign style names preserved as the token `name`.
5. Emit `settings.typography.fontSizes[]` **and** `styles.elements` (h1–h6, p,
   caption) carrying fontSize / lineHeight (from `leading`) / letterSpacing
   (from `tracking`) / text color (from `fillColorRef`). These are the "named
   style variations."

Because the scale is built *from* paragraph styles, **every entry is referenced
by ≥1 style** (acceptance ✓). The style→slug map is recorded in the report.

## Spacing (`map/spacing.js`)

Candidate values (all already normalized to px in the IR):

- Page margins: `page.bounds` vs contained `frame.bounds` offsets.
- Gutters: gaps between horizontally/vertically adjacent frames.
- Paragraph spacing: `Style.properties.spaceBefore` / `spaceAfter` when present.

Quantize to a configurable grid (**default 4px**), drop ≤0, dedupe, sort, cap the
count, rank-name → `settings.spacing.spacingSizes[]` (namespaced). Coexists with
the base's generative `spacingScale`. Output values in `rem`. Flagged approximate
(especially for PDF) via warnings.

## Fonts (`map/fonts.js`)

`config/font-map.json` (shipped default), entry shape:

```json
{
  "Helvetica Neue": {
    "fontFamily": "'Helvetica Neue', Helvetica, Arial, sans-serif",
    "source": "system",
    "fallback": "sans-serif"
  },
  "Merriweather": {
    "fontFamily": "Merriweather, Georgia, serif",
    "source": "google",
    "googleFontName": "Merriweather",
    "fallback": "serif"
  }
}
```

For each font family referenced by a promoted style: look it up. Found → emit a
`fontFamilies` entry (reuse base `sans`/`serif` slug when the stack matches, else
namespaced). Not found → `font-fallback` warning + heuristic generic
(serif/sans/mono from the family name), **listed in the report** (acceptance ✓).

## theme.json partial + merge (`map/theme-json.js`)

Assemble the namespaced partial (`settings.color.palette`,
`settings.typography.fontSizes` + `fontFamilies`, `settings.spacing.spacingSizes`,
`styles.elements`). `mergeThemeJson(base, partial)` deep-merges objects and
merges token arrays **by slug** (namespacing means no clobber; reused slugs
align). Emits a merged preview alongside the partial.

## design-tokens.json (`map/design-tokens.js`)

DTCG format — `$value` / `$type` / `$description` (provenance = InDesign style or
swatch name). Groups: `color` (type `color`), `fontSize` (type `dimension`),
`fontFamily` (type `fontFamily`), `spacing` (type `dimension`). Read natively by
Style Dictionary v4.

## Validation & testing

- **ajv** (new dev-dep) validates the partial and merged output against a
  vendored, pinned official `theme.json` schema.
- **zod** (`partial.zod.js`) validates the mapper's emitted subset.
- Tests (each acceptance criterion mapped):
  - `map-colors`: CMYK→sRGB and LAB→sRGB **against known fixture values**;
    out-of-gamut detection; dedupe by tolerance; palette includes all distinct
    swatches.
  - `map-typography`: clustering; slug reuse; **every entry referenced by ≥1
    style**; name preservation.
  - `map-spacing`: quantization to grid; dedupe; cap.
  - `map-fonts`: mapped families; **fallback warnings emitted + in report**.
  - `map-theme-json`: **merge-with-base** path; **ajv validation passes**.
  - `map-design-tokens`: DTCG structure + provenance.
  - `map-tokens` (e2e): runs on **both** an IDML-built and a PDF-built IR
    (existing `build-idml.js` / `build-pdf.js` helpers), proving source-agnostic.

## CLI (`bin/map-tokens.mjs`)

```bash
# IR JSON in, artifacts out
node packages/pipeline/bin/parse-idml.mjs doc.idml | \
  node packages/pipeline/bin/map-tokens.mjs --out-dir ./tokens > theme.partial.json

# Convenience: parse + map in one shot
node packages/pipeline/bin/map-tokens.mjs doc.idml --out-dir ./tokens
```

Options: `--out-dir`, `--base <theme.json>`, `--font-map <path>`, `--grid <px>`,
`--tolerance <n>`, `--fluid`. Partial → stdout; report/warnings → stderr;
`theme.partial.json` + `design-tokens.json` + `theme.merged.json` → out-dir.

## Acceptance criteria → coverage

| Criterion | Where satisfied |
|-----------|-----------------|
| theme.json validates against WP block theme schema | ajv + vendored schema (`map-theme-json`) |
| Palette includes all distinct swatches (deduped by hex within tolerance) | `map/colors.js` + `map-colors` |
| Each typography entry referenced by ≥1 paragraph style | clustering construction + `map-typography` |
| Font fallback warnings emitted and listed in report | `map/fonts.js` + `map/report.js` + `map-fonts` |
| Tests: CMYK→sRGB fixtures, clustering, merge-with-base | `map-colors`, `map-typography`, `map-theme-json` |
| Works on either IR | source-agnostic mapper + `map-tokens` e2e |

## Out of scope (YAGNI)

- ICC-profile CMYK conversion (chosen against in fork #1).
- Block-specific style variations / `register_block_style` (depends on the #65
  generator defining patterns).
- Pixel-perfect spacing reconstruction from PDF (documented as approximate).

## Docs

`docs/pipeline/indesign-token-mapper.md` — conversion math, config reference,
warnings table, CLI usage — matching the existing fidelity-guide style.
