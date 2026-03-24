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

## Troubleshooting

- **Missing colors** — Check CSS file has hex or `rgb()` colors; fallback tokens are used automatically
- **Broken layouts** — Canva div-soup may need manual refinement
- **Missing images** — Ensure images are exported alongside HTML
