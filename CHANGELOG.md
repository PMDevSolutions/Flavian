# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MCP server setup guide for Claude Desktop (`docs/mcp-setup.md`)
- Docker troubleshooting guide covering 15 common problems (`docs/docker-troubleshooting.md`)
- 27 cross-domain agents (meta/ops, business, marketing/social, engineering)
- 6 PostToolUse hooks (post-build-qa, pre-commit-guard, coverage-check, dark-mode-reminder, bundle-guard, mutation-test)
- 4 quality scripts (visual-diff, check-responsive, check-dark-mode, check-dead-code)
- Bug report and feature request issue templates

### Changed

- Renamed project from CC-WP-Template to Flavian across entire codebase

### Removed

- Bundled Twenty Twenty-Five theme and all references

### Fixed

- Theme validation workflow now passes on PRs that don't touch themes/plugins

## [1.1.0] - 2026-05-07

### Added

- Canva-to-WordPress conversion pipeline: Canva FSE converter agent, autonomous Canva-to-FSE workflow skill, HTML-to-block converter, CSS export parser with design token extraction, and shared validation scripts (#8, #33)
- Agent configuration validation: validation script, CI dry-run wrapper, GitHub Actions workflow, and bats-core test framework (#13, #37, #38)
- Block pattern library with starter templates: hero sections, feature grids, testimonials, CTAs, pricing tiers, and bonus patterns (newsletter signup, FAQ accordion), plus FSE templates/parts and SVG previews (#12, #36)
- Security audit agent with dependency vulnerability scanning, severity-rated report generator, and auto GitHub issue creation for critical findings (#10, #34)
- Optimized Docker image build time with layer caching (#11, #35)
- PHPCS CI workflow with inline PR annotations (#6, #31)
- Automated test coverage for the Figma-to-WordPress pipeline (90 BATS tests) (#7)
- FSE theme structure validation tests for required files (#45, #58)
- Unit tests for `rgb_to_hex()` color conversion in `parse-canva-export.sh` (#44, #57)
- Environment variable validation script that warns about default passwords (#46, #50)
- WooCommerce support in the block-theme scaffold (#60)
- Remote deployment agent for staging and production (#59)
- Contributor Covenant Code of Conduct, pull request template, and issue template config with discussions link
- Expanded `CONTRIBUTING.md` with development setup and PR guidelines (#47, #48)

### Changed

- Improved error messages in `parse-canva-export.sh` with script identification (#40, #53)
- Reconciled agent, skill, and plugin counts across documentation
- Added `@since` version tags to all block pattern file headers (#42, #52)
- Added PHPDoc comment block to `flavian_enqueue_fonts()` (#39, #49)

### Fixed

- Theme existence validation in `activate_theme()` in `wordpress-local.sh` (#43, #56)
- Env-validation script no longer blocks startup if `.env` is missing

## [1.0.0] - 2026-03-16

### Added

- **Core template structure** with root-level `themes/`, `plugins/`, and `mu-plugins/` directories (not nested under `wp-content/`)
- **Claude Code integration** with `CLAUDE.md` project instructions for WordPress development
- **`.mcp.json` configuration** for Figma Desktop MCP, Figma Remote MCP, and Playwright MCP servers
- **MCP validation script** (`scripts/check-mcp.sh`) to verify all MCP server connectivity

#### Figma-to-WordPress FSE Pipeline

- Autonomous Figma-to-FSE conversion workflow skill
- Design system extraction (colors, typography, spacing) into `theme.json`
- FSE template generation using WordPress blocks
- Pattern-first architecture for images (PHP patterns, not inline HTML)
- Attribute-level validation for Figma-to-FSE conversion (Phase 3)
- Mandatory asset identification and visual verification step
- Example FSE theme (Ancient Baltimore Lodge #234) demonstrating the pipeline

#### Agents (20 WordPress-focused)

- `frontend-developer` - FSE block patterns and theme templates
- `plugin-developer` - Custom post types, REST API, Gutenberg blocks
- `test-writer-fixer` - PHPUnit/Pest test writing and fixing
- `ui-designer` - FSE block theme layouts and design systems
- `figma-fse-converter` - Figma design to FSE theme conversion
- `wp-environment-manager` - Docker, WP-CLI, environment troubleshooting
- `content-seeder` - WordPress demo content generation
- `block-markup-validator` - Block comment syntax and attribute validation
- `theme-token-auditor` - Design token compliance auditing
- `seo-schema-agent` - SEO and structured data auditing
- `accessibility-auditor` - WCAG 2.1 AA compliance
- `visual-qa-agent` - Visual regression testing
- `asset-cataloger` - Theme image asset mapping
- `migration-specialist` - WordPress/PHP version upgrades
- `performance-benchmarker` - Performance testing and profiling
- `api-tester` - API testing including load and contract tests
- `backend-architect` - Server-side design and WordPress plugin architecture
- `brand-guardian` - Visual consistency and brand assets
- `tool-evaluator` - Development tool assessment
- `docusaurus-expert` - Documentation site management

#### Skills (8 WordPress-specific)

- FSE block theme development
- Block pattern creation
- WordPress security hardening
- WP-CLI workflows
- WordPress testing workflows
- WordPress internationalization (i18n/l10n)
- WordPress hook integration
- Visual QA verification

#### Hooks and Validation

- Project-level theme location validation hook (prevents files in `wp-content/`)
- Theme token audit hook script
- Block markup validation hook script
- Content seeder verification hook script
- WP environment manager status check hook
- Block markup and token audit hooks for `figma-fse-converter`

#### WordPress Development Scripts

- `setup-phpcs.sh` - PHP CodeSniffer with WordPress standards
- `check-coding-standards.sh` - WordPress coding standards checker
- `security-scan.sh` - Security vulnerability scanner
- `check-performance.sh` - Performance checker
- `check-prerequisites.sh` - Development environment prerequisites checker
- `setup-playwright.sh` - Playwright browser installation

#### Documentation

- Quick start guide (`docs/QUICK-START.md`)
- Prerequisites checklist (`docs/PREREQUISITES.md`)
- MCP troubleshooting guide (`docs/MCP-TROUBLESHOOTING.md`)
- General troubleshooting guide (`docs/TROUBLESHOOTING.md`)
- Common failures and fixes (`docs/COMMON-FAILURES-FIXES.md`)
- End-to-end validation procedures (`docs/E2E-VALIDATION.md`)
- Figma-to-WordPress documentation (`docs/figma-to-wordpress/`)
- Custom agents guide (`.claude/CUSTOM-AGENTS-GUIDE.md`)
- Agent naming disambiguation guide (`.claude/AGENT-NAMING-GUIDE.md`)
- Skills catalog (`.claude/skills/README.md`)
- Plugins reference (`.claude/PLUGINS-REFERENCE.md`)
- `SECURITY.md` with vulnerability reporting policy
- `LICENSE` (MIT)

#### Infrastructure

- Comprehensive `.gitignore` for WordPress development
- GitHub Actions theme validation workflow
- 5 Claude Code plugins (episodic-memory, commit-commands, php-lsp, superpowers, ai-taskmaster)
- Cross-browser testing support via Playwright MCP
- Docker-based local WordPress development environment (`LOCAL-DEVELOPMENT.md`)

[Unreleased]: https://github.com/PMDevSolutions/Flavian/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/PMDevSolutions/Flavian/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PMDevSolutions/Flavian/releases/tag/v1.0.0
