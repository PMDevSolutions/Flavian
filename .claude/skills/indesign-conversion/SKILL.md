---
name: indesign-conversion
description: Use when converting an Adobe InDesign document (.idml or PDF) into a WordPress FSE block theme. Covers prerequisites, the parse → map-tokens → generate pipeline, expected outputs, and gotchas (CMYK→sRGB shifts, missing fonts, oversized print images). Keywords: InDesign to WordPress, IDML, IDML to FSE, InDesign PDF, print to web, design tokens from InDesign
---

# InDesign Conversion

## Overview

This skill converts an Adobe InDesign document into a complete WordPress Full Site Editing (FSE) block theme using the `@flavian/pipeline` InDesign stages. It parses an exported `.idml` (or a PDF fallback), maps the document's paragraph/character styles and swatches into `theme.json` design tokens, and generates FSE block patterns (one per spread), templates, header/footer parts, and a merged `theme.json`.

**Key principle:** the design system comes from the document. Swatches → color palette, paragraph styles → typography scale, frame geometry → spacing — then patterns reference those token slugs, never inline values.

Pair this skill with the **indesign-to-wordpress** agent, which runs the steps end-to-end and reviews the generation report for follow-ups.

## When to use

- A client/designer hands you an InDesign layout (brochure, flyer, catalog, report) and wants it as a WordPress theme.
- You have an exported `.idml` file, or only a PDF exported from InDesign.
- You want a deterministic, re-runnable conversion (same input → same output, no diff churn).

Do **not** use this for live Figma or Canva sources — use `figma-to-fse-autonomous-workflow` or `canva-to-fse-autonomous-workflow` instead.

## Prerequisites

- **An exported `.idml` (strongly preferred).** In InDesign: `File → Export → Format: InDesign Markup (IDML)`. IDML preserves stories, frames, styles, swatches, and master spreads.
- **Or a PDF fallback.** `File → Export → Adobe PDF`. PDF reconstruction is lossy — text is rebuilt from glyph runs, styles are synthesized from font sizes, and every approximation is recorded as a fidelity warning. Use only when no `.idml` is available.
- **Node 20+** and the workspace installed (`pnpm install`).
- **Image bytes (optional).** Patterns reference images by a deterministic filename; to stage the actual bytes, point `--asset-dir` at the IDML package's `Links/` folder or a directory of extracted PDF assets.

## Workflow

1. **Branch.** `git checkout -b indesign-import/<slug>` — never convert on `main`.
2. **Convert.** Run the unified CLI:
   ```bash
   flavian pipeline indesign <input.idml> --output themes/<slug>
   # add --seed-content to also emit bin/seed-content.sh (a draft page per spread)
   # add --asset-dir <dir> to stage real image bytes into assets/
   ```
   This parses, maps tokens, and generates the theme in one step.
3. **Review the report.** Open `themes/<slug>/indesign-pipeline-report.md` (and the `.json` twin for tooling). Act on unmapped frames, font fallbacks, out-of-gamut colors, and missing alt text.
4. **Verify.** Activate the theme locally and open the Site Editor; the imported patterns appear under **InDesign Imports** in the inserter. Confirm `theme.json` is valid (the report says so).
5. **Seed media.** Drop image bytes into `themes/<slug>/assets/` (if not already staged) and run `bash themes/<slug>/bin/import-media.sh`.

## Expected outputs

```
themes/<slug>/
├── theme.json                      # base theme merged with the mapped tokens (schema-valid)
├── style.css, functions.php        # theme header + bootstrap (registers the InDesign Imports category)
├── patterns/spread-1.php …         # one block pattern per spread, category: indesign-imports
├── templates/                      # index.html (stitches the patterns), page.html, 404.html
├── parts/header.html, footer.html  # from master-spread chrome, or sensible defaults
├── bin/import-media.sh             # WP-CLI media import for staged assets
├── indesign-pipeline-report.md     # human-readable generation report
└── indesign-pipeline-report.json   # machine-readable counterpart
```

## Frame → block mapping

- Text frames → `core/heading` / `core/paragraph`, grouped in `core/group` (role from the paragraph-style name: `Heading N`, `Body`, `Caption`).
- Image frames → `core/image`, or `core/cover` when text sits on top of the image.
- Side-by-side frames → `core/columns`.
- Master-spread top/bottom chrome → header/footer template parts.

## Worked example (committed fixture)

The pipeline ships a code fixture (no committed binaries) and an end-to-end smoke test that builds a two-spread brochure, runs the real CLI, and asserts the theme is valid:

```bash
node scripts/indesign-fse/smoke-test.mjs
# ✓ smoke: InDesign pipeline generated a valid theme (2 spreads, theme.json v3)
```

To convert your own document end-to-end and inspect a generated pattern:

```bash
flavian pipeline indesign ./brochure.idml --output themes/brochure
sed -n '1,20p' themes/brochure/patterns/spread-1.php
cat themes/brochure/indesign-pipeline-report.md
```

You can also drive the stages individually (useful for debugging):

```bash
node packages/pipeline/bin/parse-idml.mjs brochure.idml > ir.json
node packages/pipeline/bin/map-tokens.mjs ir.json --out-dir ./tokens
node packages/pipeline/bin/generate-theme.mjs ir.json --out-dir themes/brochure
```

## Common gotchas

- **CMYK/LAB → sRGB shifts.** Print color spaces don't map 1:1 to screen. The mapper converts and flags any out-of-gamut swatch in the report; expect brand colors to look slightly different on screen and confirm them with the designer.
- **Missing / substituted fonts.** InDesign fonts that aren't web-safe fall back via `packages/pipeline/config/font-map.json` (often a Google font). The report lists every fallback — confirm each, or self-host the real font and update the font map.
- **Oversized print images.** Print assets are often huge (300 DPI, CMYK). Resize/recompress for web and convert CMYK images to sRGB before importing, or they'll bloat the page and render with muddy color.
- **PDF fidelity.** A PDF parse always carries warnings — text reconstructed from glyphs, synthesized styles, dropped vector art. Prefer `.idml`; treat PDF output as a starting point that needs review.
- **Empty alt text.** Generated images have `alt=""`. Add meaningful alt text (the agent proposes some from surrounding story text) before shipping.
- **Don't hand-edit patterns destructively.** Patterns are deterministic; re-running the pipeline regenerates them. Fix the source document or the pipeline rather than patching generated files.

## Related

- Agent: `indesign-to-wordpress` (orchestrates + reviews the report)
- Docs: `docs/pipelines/indesign.md`, `docs/pipeline/indesign-output-generator.md`
- Skills: `fse-pattern-first-architecture`, `block-pattern-creation`, `visual-qa-verification`
