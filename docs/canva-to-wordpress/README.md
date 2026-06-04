# Canva to WordPress FSE Theme Conversion

## Overview

Convert Canva HTML/CSS exports into production-ready WordPress Full Site Editing (FSE) block themes. Works alongside the existing Figma-to-WordPress pipeline.

## Quick Start

1. **Export your Canva design as HTML/CSS** (see [EXPORT-GUIDE.md](EXPORT-GUIDE.md))
2. **Tell Claude Code:** "Convert this Canva export to a WordPress theme" and provide the export directory path
3. **Claude autonomously** extracts design tokens, converts HTML to WordPress blocks, and generates a complete FSE theme

## What Gets Generated

- `theme.json` — Design tokens (colors, typography, spacing) extracted from your CSS
- `templates/*.html` — WordPress block templates for each page
- `patterns/*.php` — PHP patterns for image sections
- `style.css` — Theme metadata
- `functions.php` — Asset enqueuing

## Prerequisites

- Canva account (Pro recommended for direct HTML export)
- Claude Code with this project configured
- Export directory with HTML + CSS files

## How It Works

1. CSS is parsed for design tokens using `scripts/canva-fse/parse-canva-export.sh`
2. HTML elements are converted to WordPress blocks using `scripts/canva-fse/convert-html-to-blocks.sh`
3. Validation scripts ensure quality (shared with Figma pipeline)

## Comparison with Figma Pipeline

| Aspect | Figma Pipeline | Canva Pipeline |
|--------|---------------|----------------|
| Input | Live MCP connection | Static HTML/CSS export |
| Best for | Complex multi-page sites | Landing pages, simple sites |
| Automation | Fully automated via MCP | Automated after export |

## CI Integration Test

The pipeline is guarded end-to-end by the `canva-e2e` workflow
(`.github/workflows/canva-e2e.yml`), which runs against a committed fixture export
in `tests/fixtures/canva/landing/`:

1. Runs the deterministic helper scripts (`parse-canva-export.sh`,
   `convert-html-to-blocks.sh`) on the fixture and asserts their output is valid.
2. Deploys the fixture's golden theme (`expected-theme/`, a representative
   converter output) to a Docker-spun WordPress, **activates it, and asserts no
   PHP fatals** on render. Lighthouse runs informationally only — it does not gate.

Because the converter itself is an LLM agent (which can't run reproducibly in CI),
the golden theme stands in for "what a good agent run produces." See
`tests/fixtures/canva/landing/README.md` for the rationale and how to regenerate it.

Run it locally against a booted stack (`./wordpress-local.sh start && install`):

```bash
pnpm exec playwright install chromium   # first time only
pnpm test:canva-e2e
```

Part A (the helper-script assertions) runs without Docker; the deploy/activate
checks skip cleanly when no WordPress stack is reachable.

## Troubleshooting

- **Missing colors** — Check CSS file has hex or `rgb()` colors; fallback tokens are used automatically
- **Broken layouts** — Canva div-soup may need manual refinement
- **Missing images** — Ensure images are exported alongside HTML
