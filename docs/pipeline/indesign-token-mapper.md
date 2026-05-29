# InDesign token mapper: guide

The token mapper is stage 3 of the InDesign-to-WordPress pipeline. It takes the
[intermediate representation](../../packages/pipeline/src/indesign/ir.js)
produced by the [IDML parser](../../packages/pipeline/README.md) (#62) or the
[PDF fallback parser](indesign-pdf-fidelity.md) (#63) and maps it to WordPress
design tokens, so generated patterns inherit a coherent design system instead of
inline magic numbers.

It produces three artifacts:

| Artifact | What it is |
| --- | --- |
| `theme.json` partial | An additive, namespaced partial that deep-merges into a base theme. |
| `design-tokens.json` | DTCG (Design Tokens Community Group) tokens, read natively by Style Dictionary v4. |
| report | Warnings, validation result, provenance maps, font fallbacks, Google fonts. |

## Usage

```js
import { parseIdml, mapTokens } from '@flavian/pipeline';

const ir = await parseIdml('./brochure.idml');
const { partial, designTokens, merged, report } = mapTokens(ir);
```

```bash
# Compose with a parser CLI…
node packages/pipeline/bin/parse-idml.mjs brochure.idml \
  | node packages/pipeline/bin/map-tokens.mjs --out-dir ./tokens > theme.partial.json

# …or parse + map in one step (accepts .idml or .pdf directly).
node packages/pipeline/bin/map-tokens.mjs brochure.pdf --out-dir ./tokens
```

### Options

| Option | CLI flag | Default | Effect |
| --- | --- | --- | --- |
| `base` | `--base <path>` | bundled `themes/flavian-shop/theme.json` | Base theme to merge against. |
| `fontMap` | `--font-map <path>` | bundled `config/font-map.json` | Font fallback table. |
| `namespace` | `--namespace <str>` | `id` | Prefix for derived token slugs. |
| `tolerance` | `--tolerance <n>` | `1728` (≈24/channel) | Color dedupe/reuse squared-RGB distance. |
| `gridPx` | `--grid <px>` | `4` | Spacing quantization grid. |
| `tolerancePx` | `--type-tolerance <px>` | `1` | Font-size clustering tolerance. |
| `fluid` | `--fluid` | off | Emit fluid `clamp()` font sizes. |

## How mapping works

| Token group | How it's derived |
| --- | --- |
| `settings.color.palette` | Each swatch is re-derived to sRGB from its raw `components` (better than the parser's preview hex for LAB). Colors within `tolerance` of a base palette color reuse that base slug; the rest are deduped by hex and emitted as namespaced `id-*` tokens. |
| `settings.typography.fontSizes` | Paragraph-style font sizes are clustered (near-equal sizes merge). Each cluster reuses a close base font-size slug, or becomes a namespaced derived token named after the InDesign style. Every emitted entry is referenced by ≥1 paragraph style. |
| `settings.typography.fontFamilies` | Fonts are mapped through `config/font-map.json`. A mapped family reuses a base family only on an exact stack match, else becomes a derived family. Unmapped families fall back to a heuristic generic and raise a warning. |
| `settings.spacing.spacingSizes` | Candidate spacings (page margins, inter-frame gutters, paragraph space-before/after) are quantized to `gridPx`, deduped, and capped. |
| `styles.elements.h1`–`h6`, `caption` | Recognized heading/caption style names become element presets with font size, family, line height, letter spacing, and text color. |
| `styles.blocks['core/paragraph']` | The body style maps here — theme.json has no `<p>` element. |

## Color conversion math

The mapper re-derives every swatch from its raw `components` using documented
math (shared module: [`src/indesign/color.js`](../../packages/pipeline/src/indesign/color.js)).
For RGB and CMYK the result equals the parser's preview hex; for LAB it is a real
color rather than the parser's legacy black.

- **RGB** (0–255): formatted directly to `#rrggbb`.
- **CMYK** (0–100): naive, profile-free conversion
  `r = 255·(1 − c/100)·(1 − k/100)` (and likewise for g, b). Without an ICC
  profile this is an approximation and never clips, so no out-of-gamut signal is
  reported for CMYK — this is documented, not faked. (ICC-accurate CMYK was
  considered and deferred; see the design doc.)
- **LAB** (L 0–100, a/b −128–127): full colorimetric path —
  CIELAB → XYZ using a **D50** reference white
  (`Xn 0.96422, Yn 1.0, Zn 0.82521`, with `ε = 216/24389`, `κ = 24389/27`) →
  linear sRGB via the Bradford-adapted XYZ(D50)→sRGB matrix (D50→D65 folded in)
  → sRGB gamma → 8-bit. If any linear channel falls outside `[0, 1]` (beyond a
  small tolerance) before clamping, the color is **out of gamut** and a warning
  is emitted; the clamped color is used.

## Font map format

`config/font-map.json` maps an InDesign family name to a CSS stack:

```json
{
  "Merriweather": {
    "fontFamily": "Merriweather, Georgia, serif",
    "source": "google",
    "googleFontName": "Merriweather",
    "fallback": "serif"
  }
}
```

`source: "google"` families are collected in the report's `googleFonts` for a
downstream generator to enqueue; they are kept out of `theme.json` so the emitted
tokens stay schema-clean. Unmapped families fall back to a heuristic generic
(`serif` / `sans-serif` / `monospace`) inferred from the family name.

## Warning codes

| Code | Meaning |
| --- | --- |
| `color-out-of-gamut` | A LAB swatch fell outside the sRGB gamut and was clamped. |
| `swatch-approximated` | A Spot/Unknown swatch has no numeric conversion; the hex is an approximation. |
| `font-fallback` | A font isn't in the map; a heuristic generic family was used. |
| `spacing-approximate` | The spacing scale was derived from approximate (PDF) geometry. |

The report merges these with the IR's own parse-time warnings.

## Merge semantics

`mergeThemeJson(base, partial)` deep-merges objects and merges token arrays
**by `slug`**. Because derived tokens are namespaced (`id-*`), they extend the
base without overwriting curated slugs; a derived token that resolves onto a base
slug (color/size within tolerance) simply references the base rather than adding
a duplicate. The generated output is validated against the official WordPress
block-theme JSON Schema (via ajv) and a zod schema for the emitted subset.

## Acceptance criteria

| Criterion | How it's met |
| --- | --- |
| theme.json validates against the WP block-theme schema | ajv against the vendored official schema (`map/schema/theme-json.schema.json`) + a zod subset schema. |
| Palette includes all distinct swatches, deduped by hex within tolerance | `map/colors.js`. |
| Each typography entry referenced by ≥1 paragraph style | The scale is built from paragraph styles; `report.provenance.styleToSlug` records the mapping. |
| Font fallback warnings emitted and listed in the report | `map/fonts.js` → `report.fontFallbacks`. |
| Tests cover CMYK→sRGB, clustering, merge-with-base | `tests/indesign/color.test.mjs`, `map-typography.test.mjs`, `map-theme-json.test.mjs`. |
| Works on either IR | Source-agnostic; the end-to-end test runs on both an IDML- and a PDF-built IR. |

## Known limitations

- **CMYK is profile-free.** Without an ICC profile, CMYK→sRGB is an approximation.
- **Spacing is approximate**, especially from PDF geometry (whole-page margins can
  be large when frames don't fill the page); values are quantized and capped.
- **Element coverage** is limited to recognized style names (Heading N / Body /
  Caption); other styles still contribute font-size and color tokens.
