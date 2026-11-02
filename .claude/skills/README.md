# WordPress Skills Catalog

This directory holds the custom skills for Claude Code in this template: the design-to-FSE pipelines, the WordPress authoring and quality skills, and the slash-command skills (`/lint`, `/test`, `/scaffold-block`). Custom slash commands are skills; `.claude/commands/` is retired here.

## Skill Index

### Pipeline orchestrators

1. **figma-to-fse-autonomous-workflow**
   - Orchestrator for the Figma-to-FSE conversion pipeline; tracks progress in `.claude/pipeline/<theme>/state.json` and runs Step 2.4 through the `fse-template-lanes` workflow
   - Triggers: "convert Figma", "Figma to WordPress", "FSE conversion"

2. **canva-to-fse-autonomous-workflow**
   - Orchestrator for the Canva-to-FSE conversion pipeline (parallel entry point to Figma)
   - Triggers: "convert Canva", "Canva to WordPress", "Canva HTML export"

3. **indesign-conversion**
   - Convert an Adobe InDesign document (`.idml` or PDF) into an FSE block theme through `@flavian/pipeline`
   - Triggers: "InDesign to WordPress", "IDML", "convert InDesign", "print to web"

### Theme authoring

4. **fse-block-theme-development**
   - theme.json syntax, template hierarchy, FSE structure
   - Triggers: "create block theme", "add template", "theme.json"

5. **fse-pattern-first-architecture**
   - PHP patterns for images, never inline HTML with empty `src`
   - Triggers: auto-triggered when creating FSE templates with images

6. **block-pattern-creation**
   - Pattern registration, categories, reusable UI patterns
   - Triggers: "create pattern", "register pattern", "pattern category"

7. **scaffold-block** (`/scaffold-block <name> [--namespace ns] [--attributes ...] [--dynamic]`)
   - Scaffolds an activatable Gutenberg block plugin with `scripts/scaffold-block.sh`
   - Triggers: "scaffold a block", "custom Gutenberg block"

### Quality and security

8. **visual-qa-verification**
   - Post-conversion verification: screenshots, responsive checks, Lighthouse, accessibility
   - Triggers: "verify theme", "visual QA", "compare to Figma"

9. **wordpress-security-hardening**
   - Sanitising, escaping, nonces, capability checks, SQL
   - Triggers: "security review", "sanitize input", "escape output"

10. **wordpress-testing-workflows**
    - PHPUnit test creation and execution for themes and plugins
    - Triggers: "write tests", "run phpunit", "test coverage"

11. **lint** (`/lint [path|all]`)
    - Runs this repo's checks: PHPCS, security and performance scans, the Claude Code conformance check, doc counts, commitlint, GUI lint

12. **test** (`/test [suite]`)
    - Runs this repo's suites: bats, `node --test` (init, Claude Code config, hooks), pipeline, GUI, PHPUnit, the Docker-backed e2e suites

### Operations

13. **wordpress-internationalization**
    - i18n/l10n for themes and plugins, POT generation
    - Triggers: "translate", "i18n", "text domain"

14. **wordpress-hook-integration**
    - Creating, registering and testing Claude Code hooks on the stdin JSON contract
    - Triggers: "create hook", "PreToolUse", "PostToolUse", "deploy guard"

15. **wp-cli-workflows**
    - WP-CLI for local work: activation, seeding, export, search-replace
    - Triggers: "scaffold theme", "export database", "search-replace"

16. **create-blog-article** (`/create-blog-article <component-path>`, user-invoked only)
    - Imported from claude-code-templates; its paths do not exist here and need adapting before use

## Pipeline Flow

```
Figma / Canva / InDesign design
    |
    v
pipeline skill (orchestrator) ── state: .claude/pipeline/<theme>/state.json
    |
    +-- fse-block-theme-development (theme.json, templates)
    +-- block-pattern-creation (pattern registration)
    +-- fse-pattern-first-architecture (image handling)
    +-- wordpress-internationalization (i18n wrappers)
    +-- wordpress-security-hardening (security validation)
    +-- .claude/workflows/fse-template-lanes.js (one lane per template)
    |
    v
Generated Theme (themes/<name>/)
    |
    +-- hooks (run on their own)
    |       +-- validate-theme-location.sh   (denies wp-content/ paths)
    |       +-- pre-commit-token-guard.sh    (hardcoded values on commit)
    |       +-- deploy-guard.sh              (production and data-loss gate)
    |       +-- agent frontmatter validators (scripts/<agent>/*.sh)
    |
    v
visual-qa-verification (post-conversion QA)
    |
    +-- wp-cli-workflows (activate theme, seed content)
    +-- wordpress-testing-workflows (PHPUnit tests)
    |
    v
Verified Theme Ready for WordPress
```

## Integration with Custom Agents

Agents preload the skills that are their method (`skills:` in their frontmatter):

- **figma-fse-converter** + figma-to-fse-autonomous-workflow, fse-pattern-first-architecture, fse-block-theme-development
- **canva-fse-converter** + canva-to-fse-autonomous-workflow, fse-pattern-first-architecture, fse-block-theme-development
- **indesign-to-wordpress** + indesign-conversion, fse-pattern-first-architecture, fse-block-theme-development
- **frontend-developer** + fse-block-theme-development, block-pattern-creation, fse-pattern-first-architecture
- **plugin-developer** + wordpress-security-hardening, wordpress-internationalization, scaffold-block
- **test-writer-fixer** + wordpress-testing-workflows
- **visual-qa-agent**, **accessibility-auditor** + visual-qa-verification
- **wp-environment-manager**, **woocommerce-agent**, **content-seeder** + wp-cli-workflows

## Skill Structure

```yaml
---
name: skill-name-with-hyphens            # the /command; defaults to the directory name
description: Use when [triggers]. Keywords: relevant, search, terms
argument-hint: <what the command takes>  # shown in the / menu
allowed-tools: Bash(./scripts/*), Read   # pre-approval, not a restriction
disable-model-invocation: true           # user-only workflows with side effects
context: fork                            # with agent: <name> and background: false for research skills
paths: ["themes/**"]                     # limits automatic activation ("globs" is not a field)
---
```

Keep `SKILL.md` under 500 lines; move reference material into files beside it. The conformance check (`node scripts/claude-code-conformance.js`) fails on unknown fields and retired tool names.

## Maintenance

Skills are version-controlled and updated when WordPress core changes, the pipeline changes, or hooks and agents are added. Adding or removing a skill changes the documented counts: run `bash scripts/check-doc-counts.sh`.

---

**Last Updated:** 2026-11-02
**Total Skills:** 16
