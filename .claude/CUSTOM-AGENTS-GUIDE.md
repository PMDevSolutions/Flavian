# Custom Agents Reference Guide

**Last Updated:** 2026-05-06
**Total Custom Agents:** 53
**Location:** `.claude/agents/`

This guide categorizes all custom agents by relevance to WordPress FSE theme development.

---

## WordPress FSE Development - Highly Relevant ✅

These agents directly support WordPress block theme development:

### **frontend-developer**
- **Purpose:** Full-stack frontend implementation for themes
- **Use for:** Building block patterns, customizing block editor UI, theme JavaScript/CSS
- **WordPress relevance:** High - FSE themes require significant frontend work

### **test-writer-fixer**
- **Purpose:** Write tests, run them, fix failures
- **Use for:** PHPUnit tests for theme functions, block registration testing
- **WordPress relevance:** High - quality themes need test coverage

### **ui-designer**
- **Purpose:** User interface design and components
- **Use for:** Designing block patterns, theme layouts, editor UI
- **WordPress relevance:** High - FSE is UI-focused

### **ux-researcher**
- **Purpose:** User experience research and testing
- **Use for:** Theme usability testing, editor experience optimization
- **WordPress relevance:** High - themes must be user-friendly

### **performance-benchmarker**
- **Purpose:** Performance testing and profiling
- **Use for:** Theme performance optimization, measuring page load times
- **WordPress relevance:** Critical - WordPress performance is a key concern

### **visual-qa-agent** (NEW)
- **Purpose:** Visual regression testing, design comparison, and cross-browser verification
- **Use for:** Comparing rendered WordPress pages against Figma designs, catching wrong images, layout issues, and testing across Chromium, Firefox, and WebKit (Safari)
- **WordPress relevance:** Critical - ensures pixel-perfect Figma-to-FSE conversion across browsers
- **Requires:** Chrome DevTools MCP + Playwright MCP (`./scripts/setup-playwright.sh`)

### **asset-cataloger** (NEW)
- **Purpose:** Image/asset semantic mapping and validation
- **Use for:** Viewing hash-named images, creating semantic mappings, validating correct image usage in patterns
- **WordPress relevance:** Critical - prevents wrong-image-assignment errors

### **wp-environment-manager** (NEW)
- **Purpose:** Local WordPress development environment management
- **Use for:** Docker, WP-CLI, theme activation, user management, environment troubleshooting
- **WordPress relevance:** Critical - eliminates dev environment friction

### **block-markup-validator** (NEW)
- **Purpose:** WordPress block syntax validation
- **Use for:** Validating block JSON attributes, HTML class consistency, heading hierarchy, theme.json slug references
- **WordPress relevance:** Critical - catches silent rendering bugs

### **accessibility-auditor** (NEW)
- **Purpose:** WCAG 2.1 AA compliance auditing
- **Use for:** Color contrast, heading hierarchy, ARIA labels, alt text, keyboard navigation, Lighthouse audits
- **WordPress relevance:** Critical - WordPress themes must be accessible

### **theme-token-auditor** (NEW)
- **Purpose:** Design token compliance auditing
- **Use for:** Detecting hardcoded colors/pixels, validating CSS variable references, ensuring 100% theme.json token usage
- **WordPress relevance:** High - enforces design system discipline

### **content-seeder** (NEW)
- **Purpose:** WordPress demo content generation
- **Use for:** Creating pages matching templates, sample posts, navigation menus, homepage configuration
- **WordPress relevance:** High - fully populated sites for testing

### **security-audit-agent** (NEW)
- **Purpose:** Automated dependency vulnerability scanning and security auditing
- **Use for:** Running Composer/npm audits, generating security reports, auto-creating issues for critical CVEs, pre-release security checks
- **WordPress relevance:** Critical - dependency vulnerabilities are a top WordPress attack vector

### **seo-schema-agent** (NEW)
- **Purpose:** SEO and structured data auditing
- **Use for:** Heading hierarchy, meta tags, Open Graph, Schema.org recommendations, image SEO
- **WordPress relevance:** High - themes must support good SEO

### **plugin-developer** (NEW)
- **Purpose:** WordPress plugin development
- **Use for:** Custom post types, REST API endpoints, admin pages, Gutenberg blocks, plugin architecture
- **WordPress relevance:** High - full plugin development lifecycle

### **deployment-agent** (NEW)
- **Purpose:** Remote deployment of themes and plugins to staging and production
- **Use for:** SSH/SFTP atomic releases, Git push-to-deploy, remote WP-CLI orchestration, pre-deployment validation, rollback, multi-environment configuration, deploy notifications
- **WordPress relevance:** Critical - production-grade release workflow with rollback safety
- **Backed by:** `scripts/remote-deployment/` and `.claude/config/deployment/`

### **woocommerce-agent** (NEW)
- **Purpose:** WooCommerce store setup and FSE-template work
- **Use for:** Installing and configuring WooCommerce, importing products, wiring shop/cart/checkout/my-account pages to FSE templates, customising the bundled `flavian-shop` starter theme, scaffolding shipping zones, taxes, and payment gateways
- **WordPress relevance:** Critical - turns the scaffold into an e-commerce-ready store
- **Backed by:** `themes/flavian-shop/` and `scripts/wordpress-install/setup-woocommerce.sh`

### **headless-developer** (NEW)
- **Purpose:** Headless WordPress setup and decoupled-frontend integration
- **Use for:** Installing/configuring WPGraphQL, wiring CORS and preview links via the `flavian-headless` mu-plugin, scaffolding Next.js frontends, troubleshooting GraphQL/REST endpoints
- **WordPress relevance:** High - turns the scaffold into a headless content API for decoupled frontends
- **Backed by:** `scripts/wordpress-install/setup-headless.sh` and `scripts/scaffold-frontend.sh`

### **figma-fse-converter** (NEW)
- **Purpose:** Autonomous Figma-to-WordPress FSE theme conversion
- **Use for:** Extracting design systems from Figma, generating theme.json, creating pixel-perfect FSE templates with WordPress blocks
- **WordPress relevance:** Critical - primary engine of the Figma-to-FSE conversion pipeline
- **Backed by:** `scripts/figma-fse/` and the `figma-to-fse-autonomous-workflow` skill

### **canva-fse-converter** (NEW)
- **Purpose:** Convert Canva HTML/CSS exports into WordPress FSE block themes
- **Use for:** Parsing design tokens from Canva CSS, converting HTML elements to WordPress blocks, generating theme.json and templates
- **WordPress relevance:** Critical - alternate design-source entry point to the FSE pipeline
- **Backed by:** `scripts/canva-fse/` and the `canva-to-fse-autonomous-workflow` skill

### **indesign-to-wordpress** (NEW)
- **Purpose:** Convert an Adobe InDesign document (`.idml` or PDF) into a WordPress FSE block theme
- **Use for:** Orchestrating the `@flavian/pipeline` InDesign stages (parse → map design tokens → generate patterns/templates/parts/theme.json), reviewing the generation report, and proposing concrete follow-ups (unmapped frames, font fallbacks, alt text). Non-destructive — works on a feature branch, never on `main`
- **WordPress relevance:** Critical - turns print/layout sources into installable FSE themes
- **Backed by:** `packages/pipeline/` (#62–#65), `bin/flavian.mjs`, and `scripts/indesign-fse/`
- **Pairs with:** the `indesign-conversion` skill

---

## WordPress Development - Moderately Relevant ⚠️

These agents can be useful but aren't WordPress-specific:

### **api-tester**
- **Purpose:** API testing and validation
- **Use for:** Testing WordPress REST API endpoints, custom API integrations
- **WordPress relevance:** Moderate - useful for headless WordPress or custom APIs

### **test-results-analyzer**
- **Purpose:** Analyze test data and trends
- **Use for:** CI/CD test result analysis for theme releases
- **WordPress relevance:** Moderate - complements test-writer-fixer

### **docusaurus-expert**
- **Purpose:** Documentation site creation
- **Use for:** Theme documentation, developer guides
- **WordPress relevance:** Moderate - if documenting complex themes

### **workflow-optimizer**
- **Purpose:** Development process improvement
- **Use for:** Optimizing theme development workflows
- **WordPress relevance:** Moderate - applicable to any development

### **analytics-reporter**
- **Purpose:** Metrics and reporting
- **Use for:** Theme performance metrics, usage analytics
- **WordPress relevance:** Moderate - useful for theme analytics

---

## Generic/Cross-Domain Agents (27 total)

These agents are domain-agnostic and useful across all project types. Backported from the Coding Framework project.

### Meta/Ops (7)
| Agent | Purpose |
|-------|---------|
| agent-expert | Creating and designing specialized Claude Code agents |
| command-expert | Creating Claude Code slash commands |
| studio-coach | Development coaching and mentoring |
| studio-producer | Project production and coordination |
| project-shipper | Getting projects to release |
| sprint-prioritizer | Sprint planning and prioritization |
| experiment-tracker | Tracking A/B tests and experiments |

### Business (5)
| Agent | Purpose |
|-------|---------|
| brand-guardian | Brand consistency and guidelines |
| finance-tracker | Financial tracking and budgeting |
| legal-compliance-checker | Legal and compliance review |
| support-responder | Customer support responses |
| feedback-synthesizer | Synthesizing user feedback |

### Marketing/Social (8)
| Agent | Purpose |
|-------|---------|
| content-creator | Content creation and copywriting |
| growth-hacker | Growth strategies and experiments |
| instagram-curator | Instagram content strategy |
| reddit-community-builder | Reddit community engagement |
| tiktok-strategist | TikTok content strategy |
| twitter-engager | Twitter/X engagement |
| visual-storyteller | Visual content and storytelling |
| trend-researcher | Trend research and analysis |

### Engineering (4)
| Agent | Purpose |
|-------|---------|
| devops-automator | CI/CD, infrastructure automation |
| infrastructure-maintainer | Server and infrastructure maintenance |
| tool-evaluator | Evaluating development tools |
| joker | Tech humor and team morale |

### Adapted for WordPress (3)
| Agent | Purpose | Adaptation |
|-------|---------|------------|
| ai-engineer | AI/ML feature integration | Generic (no changes needed) |
| backend-architect | Backend architecture and APIs | Added WordPress REST API, $wpdb, nonces |
| migration-specialist | Version upgrades and migrations | Rewritten for WordPress/PHP migrations |

---

## Using Custom Agents

Custom agents are invoked through Claude Code's Task tool:

```
User: "Can you help optimize the theme performance?"
Claude: [Uses Task tool with subagent_type="performance-benchmarker"]
```

Agents are automatically selected based on task context, or you can explicitly request:

```
User: "Use the frontend-developer agent to help me build this block pattern"
```

---

## How Agents Work with WordPress Skills

**NEW:** This template includes 12 custom WordPress development skills that complement the agents.

### Skills vs Agents

| Type | Purpose | When Triggered | Example |
|------|---------|----------------|---------|
| **Skills** | Systematic workflows and best practices | Keyword detection in conversation | "create block theme" triggers `fse-block-theme-development` |
| **Agents** | Specialized task execution | Task tool invocation | frontend-developer builds block patterns |

### Agent-Skill Integration

**frontend-developer agent** + WordPress Skills:
- Works with `fse-block-theme-development` for theme structure
- Works with `block-pattern-creation` for pattern registration
- Works with `wordpress-security-hardening` for secure code
- Works with `wp-cli-workflows` for theme scaffolding

**test-writer-fixer agent** + WordPress Skills:
- Works with `wordpress-testing-workflows` for PHPUnit setup
- Works with `wp-cli-workflows` for test scaffolding
- Works with `wordpress-security-hardening` for security tests

**All agents** benefit from:
- `wordpress-security-hardening` - Security best practices
- `wp-cli-workflows` - WordPress automation
- `wordpress-hook-integration` - Agent-specific hooks

### Complete WordPress Development Stack

```
WordPress Skills (12)
    ↓ Provide workflows and best practices
Agents (53)
    ↓ Execute specialized tasks
Plugins (6)
    ↓ Provide tooling and memory
Automation Scripts (4)
    ↓ Run security/performance checks
```

**Skills Documentation:** See `.claude/skills/README.md` for complete catalog

---

## Current Architecture Status

**Plugins:** ✅ Already optimized (5 user + 1 local)
**Custom Agents:** 53 total (26 WordPress-focused + 27 generic cross-domain)

---

## Quick Reference: When to Use Which Agent

| Task | Agent | Alternative |
|------|-------|-------------|
| Build block pattern | frontend-developer | ui-designer (design first) |
| Theme performance | performance-benchmarker | analytics-reporter (metrics) |
| Write PHP tests | test-writer-fixer | - |
| Design theme UI | ui-designer | ux-researcher (research first) |
| Test REST API | api-tester | - |
| Optimize workflow | workflow-optimizer | - |
| Document theme | docusaurus-expert | - |
| Usability testing | ux-researcher | - |
| **Compare render vs Figma** | **visual-qa-agent** | - |
| **Identify/map images** | **asset-cataloger** | - |
| **Docker/WP-CLI setup** | **wp-environment-manager** | - |
| **Validate block markup** | **block-markup-validator** | theme-token-auditor |
| **Accessibility audit** | **accessibility-auditor** | - |
| **Token compliance** | **theme-token-auditor** | block-markup-validator |
| **Seed demo content** | **content-seeder** | wp-environment-manager |
| **SEO audit** | **seo-schema-agent** | - |
| **Security/dependency audit** | **security-audit-agent** | legal-compliance-checker |
| **Build a plugin** | **plugin-developer** | frontend-developer (if UI-heavy) |
| Create an agent | agent-expert | command-expert (for commands) |
| Backend API design | backend-architect | plugin-developer (WP-specific) |
| WordPress migration | migration-specialist | - |
| CI/CD automation | devops-automator | infrastructure-maintainer |
| Brand consistency | brand-guardian | content-creator |
| Social media content | content-creator | platform-specific agents |
| AI/ML features | ai-engineer | - |
| Sprint planning | sprint-prioritizer | project-shipper |

---

## Figma-to-FSE Conversion Pipeline

The new agents form an automated quality pipeline for Figma-to-WordPress conversions:

```
Figma Design
    ↓
figma-fse-converter (generates theme)
    ↓
asset-cataloger (maps images semantically)
    ↓
block-markup-validator (validates block syntax)
    ↓
theme-token-auditor (ensures 100% token usage)
    ↓
wp-environment-manager (starts WordPress)
    ↓
content-seeder (creates pages/posts/menus)
    ↓
visual-qa-agent (compares render vs Figma)
    ↓
accessibility-auditor (WCAG compliance)
    ↓
seo-schema-agent (SEO best practices)
    ↓
Ready for release
```

---

## Agent Hook Configurations

Agents with automated hooks (18 of the 26 WordPress-focused agents):

### WordPress Core Quality Hooks (shared scripts)
These scripts are shared across multiple agents:
- `scripts/wordpress/security-scan.sh` — Used by: frontend-developer, figma-fse-converter, performance-benchmarker, test-writer-fixer
- `scripts/wordpress/check-coding-standards.sh` — Used by: frontend-developer, figma-fse-converter, test-writer-fixer
- `scripts/wordpress/check-performance.sh` — Used by: frontend-developer, performance-benchmarker, test-writer-fixer

### Theme Protection Hooks
- `.claude/hooks/validate-theme-location.sh` — Blocks writes to wp-content/ (project-level, applied to: frontend-developer, block-markup-validator, ui-designer, theme-token-auditor)
- `scripts/figma-fse/validate-theme-location.sh` — Same protection for figma-fse-converter

### New Agent Hooks
| Agent | Hook Type | Script | Purpose |
|-------|-----------|--------|---------|
| block-markup-validator | PostToolUse | validate-block-markup.sh | Block syntax, class consistency, slug validation |
| theme-token-auditor | PostToolUse | audit-tokens.sh | Hardcoded value detection |
| content-seeder | Stop | verify-pages.sh | Page existence verification |
| wp-environment-manager | SubagentStart | check-environment.sh | Docker/WP-CLI status check |
| ui-designer | PostToolUse | audit-tokens.sh | Design token compliance |
| seo-schema-agent | PostToolUse | validate-block-markup.sh | Block markup and heading hierarchy |
| asset-cataloger | PreToolUse | validate-theme-location.sh | Blocks wp-content/ writes |

### Research/Audit-Only Agents (no hooks needed)
These agents are research/audit-only and don't need automated hooks:
- accessibility-auditor (runs Lighthouse on demand)
- visual-qa-agent (captures screenshots on demand)
- ux-researcher (research only)

---

**Architecture Assessment:** 53 custom agents provide comprehensive development coverage — 26 WordPress-focused agents for design-source conversion (Figma/Canva/InDesign), visual QA, asset management, environment management, markup validation, accessibility, token compliance, content seeding, SEO, security, deployment, e-commerce, and headless integration, plus 27 generic cross-domain agents for business, marketing, engineering, and meta/ops tasks.
