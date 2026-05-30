# InDesign output generator: guide

The output generator is stage 4 — the final stage — of the
InDesign-to-WordPress pipeline. It takes the
[intermediate representation](../../packages/pipeline/src/indesign/ir.js)
produced by the [IDML parser](../../packages/pipeline/README.md) (#62) or the
[PDF fallback parser](indesign-pdf-fidelity.md) (#63), runs it through the
[token mapper](indesign-token-mapper.md) (#64), and emits a complete,
installable Flavian-compatible FSE theme directory.

It turns the design into a finished WordPress product:

| Artifact | What it is |
| --- | --- |
| `theme.json` | The token mapper's merged base + partial — one schema-valid file. |
| `patterns/spread-N.php` | One FSE block pattern per spread, filed under the **InDesign Imports** category. |
| `templates/` | `index.html` (stitches the spread patterns between header/footer), plus `page.html` and `404.html`. |
| `parts/` | `header.html` and `footer.html`, derived from master-spread chrome where present. |
| `style.css`, `functions.php` | Theme header + bootstrap (registers the pattern category, enqueues styles). |
| `bin/import-media.sh` | WP-CLI script that imports staged assets into the media library. |
| `bin/seed-content.sh` | (optional, `--seed-content`) one draft page per spread, populated with its pattern. |
| `indesign-pipeline-report.md` | Produced files, unmapped IR nodes, and manual follow-ups. |

## Usage

```js
import { parseIdml, generateTheme } from '@flavian/pipeline';

const ir = await parseIdml('./brochure.idml');
const { files, assets, themeJson, report } = generateTheme(ir, {
  // slug, name,           // theme slug / display name (default: from the doc name)
  // seedContent: true,    // also emit bin/seed-content.sh
  // base, fontMap, namespace, tolerance, tolerancePx, gridPx, fluid,  // token-mapper options
  // tokens,               // a precomputed mapTokens() result (skips re-mapping)
});

// `files` is [{ path, contents, mode? }] — pure data; the CLI does the fs writes.
for (const f of files) console.log(f.path);
console.log(report.markdown);
```

`generateTheme` is **pure and deterministic**: no filesystem, clock, or
randomness. The same IR yields byte-identical files every run, so reruns never
produce diff churn in unrelated artifacts.

From the command line (composes with the parser CLIs, or parses directly):

```bash
# Compose with a parser CLI…
node packages/pipeline/bin/parse-idml.mjs brochure.idml \
  | node packages/pipeline/bin/generate-theme.mjs - --out-dir themes/brochure

# …or parse + generate in one step (accepts .idml or .pdf directly).
node packages/pipeline/bin/generate-theme.mjs brochure.idml \
  --out-dir themes/brochure --asset-dir ./extracted-images --seed-content
```

### Options

| Option | CLI flag | Default | Effect |
| --- | --- | --- | --- |
| `slug` | `--slug <str>` | slug of the document name | Theme directory slug. |
| `name` | `--name <str>` | the document name | Theme display name. |
| — | `--out-dir <dir>` | _(required)_ | Where the theme directory is written. |
| — | `--asset-dir <dir>` | — | Source of image bytes to copy into `assets/` (matched by basename). |
| `seedContent` | `--seed-content` | off | Emit `bin/seed-content.sh`. |
| `tokens` | — | computed | A precomputed `mapTokens()` result. |

All [token-mapper options](indesign-token-mapper.md#options) (`--base`,
`--font-map`, `--namespace`, `--grid`, `--tolerance`, `--type-tolerance`,
`--fluid`, `--dpi`) pass straight through.

## How frames become blocks

Each spread is laid out top-to-bottom in reading order, then mapped to core
blocks:

- **Text frames** → `core/heading` / `core/paragraph`, grouped in a
  `core/group`. A run's paragraph style decides the role: `Heading N` →
  `core/heading` at level N; `Body`/`Caption`/etc. → `core/paragraph`. The
  font-size, font-family, and text-color come from the **design tokens**
  (preset slugs), never inline values, wherever the mapper produced one.
- **Image frames** → `core/image`, or `core/cover` when one or more text frames
  sit on top of the image (a background with overlaid copy). Image URLs resolve
  through `get_theme_file_uri()` so the theme stays relocatable (the
  pattern-first rule — no broken `src=""` in markup).
- **Side-by-side frames** (overlapping vertical bands) → `core/columns`, one
  `core/column` per frame, left to right.

### Template parts from masters

A master spread's repeating chrome is split by vertical position: text in the
top band becomes `parts/header.html`, text in the bottom band becomes
`parts/footer.html` (running heads / page-number chrome → a web footer line).
With no usable master, sensible FSE defaults (site title + navigation; a
copyright line) are emitted instead, and the report flags it.

### Assets

The generator works from the IR, which carries image *references*, not bytes.
So every image frame gets a deterministic staged filename
(`assets/spread-N-image-K.ext`), and `bin/import-media.sh` imports whatever
lands in `assets/`. Pass `--asset-dir` to have the CLI copy the real bytes in
(matched by basename); otherwise the report lists the expected filenames as a
follow-up.

## Acceptance criteria

| Criterion (#65) | How it's met |
| --- | --- |
| End-to-end on a fixture `.idml` produces a theme that loads in the Site Editor without PHP errors. | `generate-theme.mjs` writes a full theme dir; PHP files are a standard header + bootstrap and block markup with only `esc_url( get_theme_file_uri() )` interpolation. |
| ≥1 pattern per spread appears under an "InDesign Imports" category. | One `patterns/spread-N.php` per spread, each `Categories: indesign-imports`; `functions.php` registers the category with the label **InDesign Imports**. |
| `theme.json` round-trips through validation. | It is the token mapper's `merged` output, already validated against the WordPress schema (ajv + zod). |
| Report enumerates produced files and unmapped IR nodes. | `indesign-pipeline-report.md` — see the **Produced artifacts** and **Unmapped IR nodes** sections. |
| Snapshot tests cover two fixture spreads (text-heavy, image-heavy). | `tests/indesign/generate.test.mjs` snapshots `patterns/spread-1.php` (text) and `spread-2.php` (image), stored in `tests/indesign/__snapshots__/`. |
| Patterns are deterministic given the same IR. | `generateTheme` is pure; a determinism test asserts two runs are byte-identical. |

## Testing

```bash
pnpm --filter @flavian/pipeline test

# Re-record the markup snapshots after an intentional change:
UPDATE_SNAPSHOTS=1 node --test packages/pipeline/tests/indesign/generate.test.mjs
```
