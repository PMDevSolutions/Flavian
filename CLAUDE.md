# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flavian is a **Claude Code-integrated WordPress development template** with a clean, root-level content layout (`themes/`, `plugins/`, `mu-plugins/` at the project root), WordPress-specific scripts, and design-to-WordPress pipelines (Figma, Canva, InDesign) driven by the `flavian` CLI and Claude Code. It is built for:

- WordPress FSE (Full Site Editing) block theme development
- Custom WordPress plugin and Gutenberg block development
- WordPress security, performance and accessibility auditing
- Automated design-to-FSE conversion

The repository is also the **`flavian` Claude Code plugin** (`.claude-plugin/plugin.json` over the live `.claude/` directories), so other WordPress repos install its agents, skills and hooks instead of copying them.

## ⚠️ CRITICAL: File Location Requirements

**This project uses ROOT-LEVEL WordPress folders, NOT `wp-content/` subfolders:**

```
project-root/
├── themes/          ← Theme files go HERE (NOT wp-content/themes/)
├── plugins/         ← Plugin files go HERE (NOT wp-content/plugins/)
├── mu-plugins/      ← Must-use plugins go HERE (NOT wp-content/mu-plugins/)
└── .claude/         ← Claude Code configuration
```

Testing and deployment copy these folders into a WordPress install's `wp-content/`. **Never create files in `wp-content/themes/` or `wp-content/plugins/` during development**; the `validate-theme-location.sh` hook denies the write and names the root-level path. The full standards (theme and plugin structure, PHP, escaping, nonces, design tokens) load from `.claude/rules/wordpress-standards.md` whenever theme or plugin files are in play.

## Rules That Always Hold

1. **Root-level layout.** `themes/`, `plugins/`, `mu-plugins/` at the project root; nothing under `wp-content/`.
2. **theme.json presets, never literals.** No hex colours, pixel spacing, pixel font sizes or font families in templates, parts or patterns; the `pre-commit-token-guard.sh` hook asks on commit. Images in PHP patterns, not inline HTML.
3. **Nothing ships or is destroyed without a human.** `deploy.sh --env production`, `rollback.sh`, remote `ssh`/`scp`/`rsync`/`wp --ssh` writes, `docker compose down -v`, `wp db reset` stop at the `deploy-guard.sh` prompt and are denied inside subagents.
4. **Checks before done.** `/lint` and `/test` (or the scripts below) before a commit; Conventional Commits, because release-please reads them.
5. **Pipelines track progress in a file.** `.claude/pipeline/<theme>/state.json`, never TodoWrite (not offered on current models) or episodic memory.

## Scripts

| Purpose | Command |
|---------|---------|
| WordPress coding standards (PHPCS) | `./scripts/wordpress/check-coding-standards.sh <path>` (setup: `./scripts/wordpress/setup-phpcs.sh`) |
| Security scan, performance check | `./scripts/wordpress/security-scan.sh <path>`, `./scripts/wordpress/check-performance.sh <path>` |
| Theme validation | `./scripts/validate-theme.sh <theme>`, `./scripts/validate-theme-e2e.sh` |
| Dependency vulnerabilities | `./scripts/security-audit/scan-dependencies.sh .` (pipe into `generate-report.sh` or `create-issues.sh`) |
| Visual QA | `./scripts/visual-diff.js`, `./scripts/check-responsive.sh <url>`, `./scripts/check-dark-mode.sh <url>`, `pnpm visual:capture`, `pnpm visual:diff` |
| Dead code | `./scripts/check-dead-code.sh [--json]` |
| Gutenberg block scaffold | `bash scripts/scaffold-block.sh <name> --namespace flavian [--attributes "..."] [--dynamic]` (or `/scaffold-block`); smoke test `bash scripts/smoke-block.sh` |
| Remote deployment | `./scripts/remote-deployment/deploy.sh --env <env> [--dry-run] [--auto-rollback]`, `rollback.sh --env <env> [--list|--to <id>]`, `pre-deploy-checks.sh --target all` (configs in `.claude/config/deployment/<env>.yml`, gitignored) |
| Claude Code configuration | `node scripts/claude-code-conformance.js` (agents, skills, hooks, manifest), `bash scripts/check-doc-counts.sh`, `./scripts/validate-agent-configs.sh` |

Script conventions (bash 3.2 compatibility, exit codes, tests) load from `.claude/rules/scripts-and-hooks.md`.

## Development Commands

```bash
pnpm install                                 # workspace deps (pnpm 9.x, Node 22+)
pnpm run init                                # setup wizard: .env, starter theme, optional WooCommerce, first commit
pnpm run init -- --yes --name=my-site --theme=blank
node bin/flavian.mjs --help                  # the flavian CLI
docker compose up -d wordpress db            # local stack (LOCAL-DEVELOPMENT.md)
docker compose --profile woocommerce up woocommerce-installer   # also: multisite, headless
wp theme activate <slug> · wp plugin activate <slug> · wp db export backup.sql
node bin/flavian.mjs pipeline indesign <input> --output themes/<slug>   # InDesign → FSE
pnpm gui:dev · pnpm gui:build · pnpm gui:package                      # desktop GUI
```

Tests: `/test` lists every suite (bats, `pnpm test:init`, `test:pipeline`, `test:claude`, `gui:test`, PHPUnit, the Docker-backed e2e suites). `git submodule update --init --recursive` fetches the bats runner.

## Claude Code Architecture & Configuration

### Agents (53)

`.claude/agents/`. WordPress-focused: `figma-fse-converter`, `canva-fse-converter`, `indesign-to-wordpress`, `frontend-developer`, `plugin-developer`, `ui-designer`, `block-markup-validator`, `theme-token-auditor`, `visual-qa-agent`, `accessibility-auditor`, `seo-schema-agent`, `asset-cataloger`, `content-seeder`, `wp-environment-manager`, `woocommerce-agent`, `headless-developer`, `security-audit-agent`, `deployment-agent`, `test-writer-fixer`, `migration-specialist`. Generic engineering, business and marketing agents round out the set. Claude delegates with the Agent tool when a task matches an agent's description. Full catalog: `.claude/CUSTOM-AGENTS-GUIDE.md`. Frontmatter conventions (tools that exist, colors, `memory`, `skills`, agent-scoped hooks): `.claude/rules/claude-code-conventions.md`.

Eight agents keep project memory in `.claude/agent-memory/<name>/` (committed): the three converters, `visual-qa-agent`, `asset-cataloger`, `performance-benchmarker`, `security-audit-agent`, `wp-environment-manager`.

### Skills (16)

`.claude/skills/<name>/SKILL.md`; custom slash commands are skills (`.claude/commands/` is retired).

- **Pipelines:** `figma-to-fse-autonomous-workflow`, `canva-to-fse-autonomous-workflow`, `indesign-conversion`
- **Theme authoring:** `fse-block-theme-development`, `fse-pattern-first-architecture`, `block-pattern-creation`, `/scaffold-block`
- **Quality and security:** `visual-qa-verification`, `wordpress-security-hardening`, `wordpress-testing-workflows`, `/lint`, `/test`
- **Operations:** `wordpress-internationalization`, `wordpress-hook-integration`, `wp-cli-workflows`, `/create-blog-article` (user-invoked only)

Skills auto-trigger on their keywords ("FSE", "security review", "convert Figma"). Catalog: `.claude/skills/README.md`.

### Hooks

Registered in `.claude/settings.json` (mirrored in `.claude/hooks/hooks.json` for the plugin), on the stdin JSON contract, each tested in `tests/claude-code/hooks.test.mjs`:

| Hook | When | Effect |
|------|------|--------|
| `validate-theme-location.sh` | Write/Edit | denies `wp-content/` paths with the root-level path |
| `deploy-guard.sh` | every Bash call | asks before production deploys, rollbacks, remote writes, local data loss; denies them in subagents |
| `pre-commit-token-guard.sh` | `git commit` | asks when a committed theme file carries hardcoded design values |
| `bundle-size-guard.sh` | `git commit` | reminder above 5 MB (theme) or 10 MB (plugin) |
| `post-bash-reminders.sh <case>` | after standards checks, PHPUnit/Pest, visual diffs | quality-gate, coverage, dark-mode and mutation-testing reminders |
| `session-context.sh` | session start | status block: conversion runs in flight, themes, Docker, branch |

Agent-scoped hooks (validators under `scripts/<agent>/`) run from the agents' frontmatter. Writing or changing a hook: the `wordpress-hook-integration` skill.

### Rules

`.claude/rules/` loads path-scoped standards only when matching files are touched: `wordpress-standards.md` (themes, plugins, mu-plugins), `claude-code-conventions.md` (anything under `.claude/`), `scripts-and-hooks.md` (scripts, hooks, tests), `pipeline-artifacts.md` (state files, reports, visual baselines).

### Workflow

`.claude/workflows/fse-template-lanes.js` runs Step 2.4 of the pipelines as one lane per template (convert, validate, bounded fix loop) and writes the state file. The pipeline skills call it by name when a run has three or more templates.

### Plugin

The repo ships as the `flavian` plugin: 27 of the 53 agents (`.claude-plugin/plugin.json` → `metadata.excludedAgents` keeps the marketing and meta agents out, since the `maecenas` plugin ships those names), all 16 skills, the hooks and the workflow. Install in another repo:

```bash
claude plugin marketplace add PMDevSolutions/Maecenas     # the pmds marketplace
claude plugin install flavian@pmds --scope project
```

No Claude Code plugins are installed for this repository itself and none are needed; `.claude/PLUGINS-REFERENCE.md` lists the official plugins that fit WordPress work (`php-lsp`, `commit-commands`, `github`, `playwright`, `figma`, `canva`). `claude plugin validate .` checks the manifest; `evals/` holds one `claude plugin eval` case per hard rule (run by hand, it costs model calls).

### Keeping the configuration in shape

- `node scripts/claude-code-conformance.js` after any change under `.claude/` (0 errors is the bar; CI enforces it in `validate-configs.yml`).
- `bash scripts/check-doc-counts.sh` after adding or removing an agent or skill: the documented counts (53 agents, 16 skills) must match disk.
- `node --test tests/claude-code/*.test.mjs` for the hooks, the checker and the doc-count check.
- Record of the last full pass: `docs/audits/2026-11-02-claude-code-sota-conformance.md`.

## Design-to-WordPress Pipelines

```
User: "Convert this Figma design to WordPress"  [Figma URL]
Claude: figma-to-fse-autonomous-workflow → theme.json from the design tokens (or the fallback set),
        templates and parts through fse-template-lanes, PHP patterns for images, validation,
        comparison report. Progress in .claude/pipeline/<theme>/state.json; resumable.
Result: themes/<slug>/ ready for WordPress
```

Canva exports follow the same shape (`canva-to-fse-autonomous-workflow`, CSS tokens and HTML-to-block conversion); InDesign runs through the CLI (`node bin/flavian.mjs pipeline indesign`). Guides: `docs/figma-to-wordpress/`, `docs/canva-to-wordpress/`, `docs/pipelines/indesign.md`.

## Development Workflow with Claude Code

```bash
git checkout -b feature/hero-block-pattern       # never work on main
# build with the agents and skills; hooks validate as you go
/lint themes/my-theme                            # PHPCS, security, performance, conformance
/test                                            # the suites
git commit -m "feat(theme): add hero section block pattern"
gh pr create                                     # PRs with gh; release-please cuts releases from main
```

## Documentation

- `docs/QUICK-START.md`, `docs/PREREQUISITES.md`, `docs/CLI-WIZARD.md`, `docs/GUI.md`, `docs/RELEASING.md`
- `docs/figma-to-wordpress/`, `docs/canva-to-wordpress/`, `docs/pipelines/indesign.md`, `docs/blocks/README.md`
- `docs/multisite/README.md`, `docs/headless-wordpress/README.md`, `LOCAL-DEVELOPMENT.md`
- `.claude/CUSTOM-AGENTS-GUIDE.md`, `.claude/AGENT-NAMING-GUIDE.md`, `.claude/skills/README.md`, `.claude/PLUGINS-REFERENCE.md`, `.claude/SETUP-COMPLETE.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`, `docs/docker-troubleshooting.md`, `docs/COMMON-FAILURES-FIXES.md`, `docs/MCP-TROUBLESHOOTING.md`, `docs/E2E-VALIDATION.md`
- Records: `docs/plans/` (designs and plans), `docs/audits/` (audits)

---

**Last Updated:** 2026-11-02
**Architecture Status:** ✅ 53 agents, 16 skills, 9 hooks, 4 rules, 1 workflow; conformance check 0 errors; no plugins required
