# Milestone Description Proposals

Proposed rewrites for open GitHub milestones to bring them into a canonical format:

1. One-sentence summary of the release.
2. Bullet list of 3-6 themes covered.
3. A single `Focus:` line.

These are proposals only — no GitHub milestones have been edited. Apply via the GitHub web UI or `gh api ... -X PATCH` once reviewed.

---

## Milestone #2 — `v2.0.0`

**Status:** Open
**Due:** 2026-07-31
**Open issues:** 7 / **Closed issues:** 11

### Current

> Major release — Canva-to-WordPress pipeline, multi-site scaffolding, headless WordPress/REST API starter, Gutenberg custom block scaffolding, and expanded agent coverage. This release represents a significant expansion of Flavian's capabilities beyond the core FSE theme workflow.

### Proposed

> Major release expanding Flavian beyond the core FSE theme workflow with new conversion pipelines, multi-site support, and headless WordPress starters.
>
> - Canva-to-WordPress conversion pipeline
> - InDesign-to-WordPress conversion pipeline (IDML/PDF → FSE theme)
> - Multi-site scaffolding and provisioning
> - Headless WordPress / REST API starter
> - Gutenberg custom block scaffolding
> - Expanded agent and skill coverage
>
> Focus: broadening the framework's surface area from single-site FSE themes to multi-site, headless, and custom-block development patterns.

### Rationale

The current description mixes a summary, a feature list, and an editorial sentence in a single paragraph. The proposed version preserves every feature mentioned, splits them into scannable bullets, and replaces the editorial closing sentence with an explicit `Focus:` line so the milestone's intent is unambiguous to contributors triaging issues.
