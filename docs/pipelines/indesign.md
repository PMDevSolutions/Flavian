# InDesign → WordPress pipeline

Convert an Adobe InDesign document into a complete WordPress FSE block theme:
block patterns (one per spread), templates, header/footer parts, a schema-valid
`theme.json`, asset-import scripts, and a generation report.

This is the user-facing guide. For the internals, see the package docs:
[IDML parser & IR](../pipeline/indesign-pdf-fidelity.md),
[token mapper](../pipeline/indesign-token-mapper.md), and
[output generator](../pipeline/indesign-output-generator.md).

## At a glance

```bash
# One command: parse → map design tokens → generate the theme
flavian pipeline indesign brochure.idml --output themes/brochure

# (equivalently) node bin/flavian.mjs pipeline indesign brochure.idml --output themes/brochure
```

The InDesign pipeline sits alongside the [Figma](../figma-to-wordpress/README.md)
and [Canva](../canva-to-wordpress/README.md) pipelines. Use it when your source
of truth is a print/layout document rather than a live design tool.

## 1. Export from InDesign

### IDML (preferred)

`File → Export…` → **Format: InDesign Markup (IDML)**.

IDML is a structured package: it preserves stories (text), frames (geometry),
paragraph/character styles, swatches, and master spreads. This is the
high-fidelity path — use it whenever you can.

If your document links images and you want them staged into the theme, also keep
the package's `Links/` folder handy (or use `File → Package…`) and pass it via
`--asset-dir`.

### PDF (fallback)

`File → Export…` → **Adobe PDF**. Use this only when you can't get an `.idml`.

PDF reconstruction is **lossy by design**: text is rebuilt from positioned glyph
runs, paragraph styles are *synthesized* from font-size buckets, vector art is
dropped, and color is read per-run. Every approximation is recorded as a
fidelity warning. See [PDF fidelity](../pipeline/indesign-pdf-fidelity.md) for
the full list and the round-trip tolerances against IDML.

## 2. Run the pipeline

```bash
flavian pipeline indesign <input.idml|input.pdf> [options]
```

| Option | Effect |
| --- | --- |
| `-o, --output <dir>` | Theme output directory (default `themes/<slug>`, or `<config.output>/<slug>`). |
| `--config <path>` | Flavian config file (default `./flavian.config.json` if present). |
| `--slug <str>` | Theme slug (default: from the document name). |
| `--name <str>` | Theme display name. |
| `--base <path>` | Base `theme.json` to merge against (default: `flavian-shop`). |
| `--namespace <str>` | Derived-token slug prefix (default `id`). |
| `--asset-dir <dir>` | Source of image bytes to copy into `assets/` (matched by basename). |
| `--dpi <n>` | DPI when parsing `.idml`/`.pdf` directly (default 96). |
| `--seed-content` | Also emit `bin/seed-content.sh` (a draft page per spread). |
| `--fluid` | Emit fluid `clamp()` font sizes. |
| `-q, --quiet` | Suppress the stderr summary. |

Run `flavian pipeline indesign --help` for the authoritative list.

### Configuration

CLI flags override values from `flavian.config.json` (see
[`flavian.config.example.json`](../../flavian.config.example.json)):

```json
{
  "pipeline": {
    "indesign": {
      "output": "themes",
      "baseTheme": "themes/flavian-shop/theme.json",
      "namespace": "id",
      "seedContent": false
    }
  }
}
```

When `output` is set in config it is treated as the **parent** directory and the
theme is written to `<output>/<slug>`; an explicit `--output` is used as the
theme directory directly.

## 3. Expected output

```
themes/<slug>/
├── theme.json                      # base theme merged with the mapped tokens (schema-valid)
├── style.css, functions.php        # theme header + bootstrap (registers the InDesign Imports category)
├── patterns/spread-1.php …         # one block pattern per spread, category: indesign-imports
├── templates/                      # index.html (stitches the patterns), page.html, 404.html
├── parts/header.html, footer.html  # from master-spread chrome, or sensible defaults
├── bin/import-media.sh             # WP-CLI media import for staged assets
├── bin/seed-content.sh             # (with --seed-content) a draft page per spread
├── indesign-pipeline-report.md     # human-readable generation report
└── indesign-pipeline-report.json   # machine-readable counterpart (for tooling/CI)
```

After generating, the imported patterns appear in the Site Editor's inserter
under an **InDesign Imports** category, one per spread.

### Frame → block mapping

- **Text frames** → `core/heading` / `core/paragraph`, grouped in `core/group`.
  The paragraph-style name picks the role: `Heading N` → heading level N;
  `Body`/`Caption`/etc. → paragraph. Typography and color come from the mapped
  **design tokens** (preset slugs), never inline values.
- **Image frames** → `core/image`, or `core/cover` when text overlays the image.
- **Side-by-side frames** → `core/columns`.
- **Master-spread chrome** → `parts/header.html` / `parts/footer.html`.

## 4. Fidelity expectations

| Aspect | IDML | PDF |
| --- | --- | --- |
| Text content | Exact (from stories) | Reconstructed from glyph runs |
| Paragraph styles | Exact | Synthesized from font sizes |
| Colors | Exact swatches (CMYK/LAB → sRGB) | Sampled per run |
| Frame geometry | Exact | Reconstructed (clustering) |
| Vector art | Not imported | Dropped (warned) |
| Images | Referenced; staged via `--asset-dir` | Extracted to an asset cache |

Two conversions are inherent regardless of source:

- **CMYK/LAB → sRGB.** Print color doesn't map 1:1 to screen. Out-of-gamut
  swatches are clamped and flagged in the report; confirm brand colors with the
  designer.
- **Fonts.** Non-web fonts fall back via `packages/pipeline/config/font-map.json`
  (often a Google font). Every fallback is listed in the report.

## 5. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `theme.json valid: false` | The report's `tokens.validationErrors` lists the schema errors. Usually a malformed `--base` theme; re-run against the default. |
| Colors look washed out / shifted | CMYK→sRGB conversion. Convert source images to sRGB and confirm swatches against the report's out-of-gamut list. |
| Missing or wrong fonts | A font fell back. Check the report's font-fallback list; self-host the real font and update the font map, or accept the substitution. |
| Images don't appear | Bytes weren't staged. Drop files into `themes/<slug>/assets/` (names are in the report) and run `bin/import-media.sh`, or re-run with `--asset-dir`. |
| Huge / slow pages | Oversized print images (300 DPI, CMYK). Resize and recompress for web before importing. |
| PDF output looks rough | PDF is a lossy fallback — re-export an `.idml` if at all possible. |
| Frames missing from a pattern | Listed under **Unmapped IR nodes** in the report (e.g. a text frame with no story). Add content manually or fix the source document. |

## Smoke test

An end-to-end smoke test builds a fixture document in code, runs the real CLI,
and asserts the theme is valid:

```bash
node scripts/indesign-fse/smoke-test.mjs
```

It runs in CI on any change to the pipeline package or its scripts.

## See also

- [Output generator internals](../pipeline/indesign-output-generator.md)
- [Token mapper internals](../pipeline/indesign-token-mapper.md)
- [PDF fidelity](../pipeline/indesign-pdf-fidelity.md)
- Agent: `.claude/agents/indesign-to-wordpress.md`
- Skill: `.claude/skills/indesign-conversion/SKILL.md`
