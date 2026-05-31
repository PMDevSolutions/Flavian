# InDesign pipeline fixtures

The canonical sample document for the [InDesign → WordPress pipeline](../../../docs/pipelines/indesign.md),
the **Spring Brochure**: a two-spread layout with a text-heavy cover (headline +
body) and an image-heavy spread (a full-bleed hero with an overlaid headline),
plus master-spread footer chrome.

## Fixtures are code, not blobs

There are no binary `.idml` / `.pdf` files committed here. The brochure is
defined once as a readable spec in [`brochure.mjs`](brochure.mjs) and
materialized into both input formats on demand:

- `buildBrochureIdml()` → the primary, high-fidelity IDML package (stories,
  frames, paragraph styles, swatches, a master spread).
- `buildBrochurePdf()` → the same logical brochure exported as a PDF (the lossy
  fallback path).

This keeps the repo free of opaque binaries, makes the fixture diffable, and
lets the IDML and PDF stay in sync because they derive from one description.

## Files

| File | Purpose |
| --- | --- |
| `brochure.mjs` | The canonical fixture spec + `buildBrochureIdml()` / `buildBrochurePdf()`. |
| `emit.mjs` | CLI: writes `brochure.idml` and `brochure.pdf` to disk. |
| `fixtures.test.mjs` | End-to-end test: both formats → a valid FSE theme (run in CI). |

## Materialize the files

To get real files to run the pipeline against:

```bash
node tests/fixtures/indesign/emit.mjs /tmp/fix
flavian pipeline indesign /tmp/fix/brochure.idml --output themes/brochure
flavian pipeline indesign /tmp/fix/brochure.pdf  --output themes/brochure-pdf
```

The emitted bytes are deterministic — re-running overwrites with identical
content.

## Tests

`fixtures.test.mjs` runs the full pipeline (parse → map tokens → generate) for
both the IDML and PDF fixtures and asserts each yields a schema-valid
`theme.json`, one block pattern per spread under the **InDesign Imports**
category, and a populated palette/typography scale. It runs in CI via the
**Pipeline Tests** workflow:

```bash
node --test "tests/fixtures/indesign/**/*.test.mjs"
```
