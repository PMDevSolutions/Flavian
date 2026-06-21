# Ingest stage

The **ingest** stage is the pipeline's format-detecting front door. It turns a
source asset — an InDesign `.idml` package or an exported `.pdf` — into the
canonical [IR `Document`](../../packages/pipeline/src/indesign/ir.js) that the
[token mapper](../../packages/pipeline/src/indesign/map/index.js) and
[theme generator](../../packages/pipeline/src/indesign/generate/index.js)
consume, and enriches it with a derived **content model**.

```
source (.idml | .pdf | bytes)
        │
        ▼
  ┌───────────┐   detect format by magic bytes (PK+designmap.xml / %PDF-)
  │  ingest   │   parse → IR → validate (Document.parse)
  │  stage    │   extract reading-order content model
  └───────────┘
        │
        ▼
  artifact JSON  ──►  map-tokens  ──►  generate-theme
  (IR + content)
```

## Why a separate stage

The per-format parse bins (`flavian-parse-idml`, `flavian-parse-pdf`) each handle
one extension and print to stdout. Ingest adds three things they don't:

1. **Byte sniffing** — the format is detected from the content, not the
   filename, so extensionless files, stdin streams, and upload buffers all work.
   IDML is recognized by the Zip signature plus the literal `designmap.xml`
   manifest name (Zip stores entry *filenames* uncompressed); PDF by its `%PDF-`
   header.
2. **A validated, writable artifact** — the IR is re-checked against the schema
   and written as one JSON file (`--out`), ready for the next stage.
3. **A semantic content model** — see below.

## Content model

The IR records design and geometry but nothing about editorial structure. The
ingest stage derives a normalized, reading-order outline:

- Each editorial spread becomes a **section** of ordered **blocks**:
  `heading` (with an inferred level 1–6), `paragraph`, or `figure`.
- **Heading levels** are inferred from font size: the smallest paragraph size on
  the spreads is the body baseline; larger distinct sizes rank largest → `<h1>`,
  capped at `<h6>`. A single size means no headings.
- **Reading order** is top-to-bottom then left-to-right by frame bounds, with a
  small row tolerance so two-column rows aren't interleaved.
- Consecutive runs that share a paragraph style merge into one block (a bold
  word mid-sentence doesn't fragment the paragraph).
- Master-spread chrome (running header/footer) is excluded — the generator
  derives that separately.

The content model is attached to the artifact under an additive `content` key.
Downstream stages ignore it, so the artifact is still a valid `Document`:
`flavian-map-tokens` and `flavian-generate-theme` accept it directly.

## Usage

```bash
# Auto-detect and write the enriched IR
pnpm pipeline:ingest path/to/brochure.idml --out build/brochure.ir.json

# From stdin, forcing the PDF parser, bare IR (no content model)
cat export.pdf | pnpm pipeline:ingest - --format pdf --no-content > ir.json

# Pipe straight into theme generation (generate-theme reads the IR from stdin)
pnpm pipeline:ingest brochure.idml --quiet | \
  node packages/pipeline/bin/generate-theme.mjs --out-dir themes/brochure
```

| Option | Description |
| --- | --- |
| `--out <file>` | Write the artifact here (default: stdout) |
| `--format <fmt>` | `idml` \| `pdf` \| `auto` (default: `auto`) |
| `--dpi <n>` | Unit-normalization DPI (default 96) |
| `--name <str>` | Override the document name |
| `--no-content` | Emit the bare IR without the content model |
| `--quiet` | Suppress the stderr summary and parse warnings |

## Programmatic API

```js
import { ingestSource, toArtifact } from '@flavian/pipeline/indesign';

const result = await ingestSource('brochure.idml');
// → { format: 'idml', ir: <DocumentIR>, content: <ContentModel> }

await fs.writeFile('out.json', JSON.stringify(toArtifact(result), null, 2));
```

`ingestBuffer(bytes, opts)` is the in-memory variant. Both are pure of side
effects beyond reading the input path; the content transform (`extractContent`)
and the detector (`detectFormat`) are exported for direct use and are
unit-tested in `packages/pipeline/tests/indesign/ingest-*.test.mjs`.

## Tests & fixtures

Fixtures are generated in code (no binary blobs in git), consistent with the
rest of the pipeline:

- `ingest-detect.test.mjs` — magic-byte detection on built IDML/PDF/zip buffers.
- `ingest-content.test.mjs` — reading order, heading-level inference, figures.
- `ingest.test.mjs` — full IDML + PDF ingest, determinism, and proof that the
  artifact is generator-consumable.
