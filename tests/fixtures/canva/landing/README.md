# Canva export fixture — `landing`

A small, representative **Canva HTML/CSS export** used by the Canva-to-WordPress
integration test (`tests/canva-e2e/canva-pipeline.test.mjs`) and the
`canva-e2e` CI workflow.

This is **synthetic** (hand-authored to look like a Canva export), not a real
Canva download — so it can be committed and is stable across runs. It is shaped
to exercise the deterministic helper scripts the `canva-fse-converter` agent
path relies on:

| File | Exercises |
|------|-----------|
| `style.css` | `scripts/canva-fse/parse-canva-export.sh` — hex + `rgb()` colors, quoted `font-family`, `font-size` px, `padding`/`margin`/`gap` px → theme.json tokens |
| `index.html` | `scripts/canva-fse/convert-html-to-blocks.sh` — headings, paragraphs, `<img>`, `<a class="button">`, `<ul>`, nested `<div>` → `wp:heading`/`wp:paragraph`/`wp:image`/`wp:button`/`wp:list`/`wp:group` |
| `images/hero.jpg` | 1×1 placeholder so image references resolve |

## Why a golden theme?

The Canva converter is an **LLM agent** (`.claude/agents/canva-fse-converter.md`):
the deterministic scripts above only extract tokens and rough block markup; the
model assembles the finished theme. An LLM can't run reproducibly in CI, so the
integration test:

1. runs the **real** helper scripts against this fixture and asserts their output
   is valid (guards the deterministic agent-path pieces), and
2. deploys `expected-theme/` — a committed, representative converter output — to a
   Docker-spun WordPress and proves it **activates with no PHP fatals**.

`expected-theme/` is therefore a stand-in for "what a good agent run produces."
When the agent path or scripts change in a way that should change the golden
output, regenerate `expected-theme/` and commit it alongside.
