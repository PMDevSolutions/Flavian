# WordPress Skills Catalog

This directory contains custom WordPress development skills for Claude Code, optimized for the Figma-to-FSE (Full Site Editing) block theme pipeline.

## Skill Index

### Core Pipeline Skills (Priority 1)

1. **figma-to-fse-autonomous-workflow**
   - Orchestrator for the Figma-to-FSE conversion pipeline
   - Triggers: "convert Figma", "Figma to WordPress", "FSE conversion"
   - Role: Main workflow skill that coordinates all other skills

   **indesign-conversion**
   - Convert an Adobe InDesign document (`.idml` or PDF) into an FSE block theme
   - Triggers: "InDesign to WordPress", "IDML", "convert InDesign", "print to web"
   - Role: Drives the `@flavian/pipeline` InDesign pipeline; pairs with the `indesign-to-wordpress` agent

2. **fse-block-theme-development**
   - theme.json syntax, template hierarchy, and FSE structure
   - Triggers: "create block theme", "add template", "theme.json"
   - Complements: frontend-developer agent, ui-designer agent

3. **fse-pattern-first-architecture**
   - Enforces PHP patterns for images (not inline HTML)
   - Triggers: auto-triggered when creating FSE templates with images
   - Role: Architecture enforcement during conversion

4. **block-pattern-creation**
   - Pattern registration, structure, and reusable UI patterns
   - Triggers: "create pattern", "register pattern", "pattern category"
   - Complements: fse-block-theme-development skill, ui-designer agent

5. **wordpress-security-hardening**
   - Security validation during theme generation
   - Triggers: "security review", "sanitize input", "escape output", "nonce verification"
   - Complements: security-scan.sh script

### Pipeline Support Skills (Priority 2)

6. **visual-qa-verification** *(NEW)*
   - Post-conversion verification: screenshots, responsive checks, Lighthouse, accessibility
   - Triggers: "verify theme", "visual QA", "compare to Figma", "check screenshots"
   - Complements: visual-qa-agent, accessibility-auditor agent, chrome-devtools MCP

7. **wordpress-internationalization**
   - i18n/l10n for themes and plugins, including FSE pattern generation
   - Triggers: "translate", "i18n", "generate pattern", "create pattern"
   - Complements: figma-fse-converter agent, theme/plugin development workflows

8. **wordpress-hook-integration**
   - Creating and managing Claude Code agent hooks
   - Triggers: "create hook", "agent hook", "PreToolUse", "PostToolUse"
   - Documents the 3 actual hooks in `.claude/hooks/`

### Supporting Skills

9. **wp-cli-workflows**
   - WP-CLI commands for local testing (theme activation, content seeding, cache flush)
   - Triggers: "scaffold theme", "create plugin", "export database", "search-replace"

10. **wordpress-testing-workflows**
    - PHPUnit test creation and execution for WordPress
    - Triggers: "write tests", "run phpunit", "test coverage", "integration tests"
    - Complements: test-writer-fixer agent

11. **canva-to-fse-autonomous-workflow**
    - Orchestrator for the Canva-to-FSE conversion pipeline (parallel entry point to Figma)
    - Triggers: "convert Canva", "Canva to WordPress", "Canva HTML export"
    - Role: Alternate entry point when design source is Canva rather than Figma

## Pipeline Flow

```
Figma Design
    |
    v
figma-to-fse-autonomous-workflow (orchestrator)
    |
    +-- fse-block-theme-development (theme.json, templates)
    +-- block-pattern-creation (pattern registration)
    +-- fse-pattern-first-architecture (image handling)
    +-- wordpress-internationalization (i18n wrappers)
    +-- wordpress-security-hardening (security validation)
    |
    v
Generated Theme (themes/[name]/)
    |
    +-- wordpress-hook-integration (validation hooks run automatically)
    |       +-- validate-theme-location.sh (blocks wp-content/ paths)
    |       +-- figma-fse-post-template.sh (per-template validation)
    |       +-- figma-fse-completion.sh (final report)
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

Each skill works with the 49 custom agents in this template:

- **figma-fse-converter** + figma-to-fse-autonomous-workflow + fse-pattern-first-architecture
- **frontend-developer** + fse-block-theme-development
- **ui-designer** + block-pattern-creation
- **test-writer-fixer** + wordpress-testing-workflows
- **visual-qa-agent** + visual-qa-verification
- **accessibility-auditor** + visual-qa-verification
- All agents + wordpress-security-hardening + wordpress-hook-integration

## Skill Structure

```yaml
---
name: skill-name-with-hyphens
description: Use when [specific triggers]. Keywords: relevant, search, terms
---

# Skill Name
## Overview
## When to Use
## Quick Reference
## Implementation
## Common Mistakes
```

## Maintenance

Skills are version-controlled and updated when:
- WordPress core changes require updates
- Pipeline workflow changes
- New hooks or agents are added
- Better patterns emerge from conversion results

---

**Last Updated:** 2026-03-06
**Total Skills:** 11
