# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Claude Code-integrated WordPress development template** providing a clean `wp-content` directory structure with WordPress-specific development tools and scripts.

The template is designed for:
- WordPress FSE (Full Site Editing) block theme development
- Custom WordPress plugin development
- WordPress security, performance, and accessibility auditing
- Integration with Claude Code for WordPress development workflows

## ⚠️ CRITICAL: File Location Requirements

**This project uses ROOT-LEVEL WordPress folders, NOT `wp-content/` subfolders:**

```
project-root/
├── themes/          ← Theme files go HERE (NOT wp-content/themes/)
├── plugins/         ← Plugin files go HERE (NOT wp-content/plugins/)
├── mu-plugins/      ← Must-use plugins go HERE (NOT wp-content/mu-plugins/)
└── .claude/         ← Claude Code configuration
```

**Why root-level?**
- Cleaner development structure
- Easier version control (no nested wp-content)
- Testing copies files to WordPress `wp-content/` for deployment
- Development and testing environments separated

**NEVER create files in `wp-content/themes/` or `wp-content/plugins/` during development.**

When deploying to WordPress, files are copied from root folders to `wp-content/` by deployment scripts.

## WordPress Development Scripts

This template includes WordPress-specific automation scripts:

### Security and Quality Tools
```bash
# Set up PHP CodeSniffer with WordPress standards
./scripts/wordpress/setup-phpcs.sh

# Check WordPress coding standards
./scripts/wordpress/check-coding-standards.sh

# Run security scan
./scripts/wordpress/security-scan.sh

# Check performance
./scripts/wordpress/check-performance.sh
```

## Development Commands

### WordPress Setup
```bash
# Download WordPress core files
wp core download

# Create wp-config.php
wp config create --dbname=dbname --dbuser=root --dbpass=password --dbhost=localhost

# Install WordPress
wp core install --url=example.com --title="Site Title" --admin_user=admin --admin_password=password --admin_email=admin@example.com

# Update WordPress core
wp core update

# Update all plugins
wp plugin update --all

# Update all themes
wp theme update --all
```

### Theme Development
```bash
# Activate a theme
wp theme activate theme-name

# Generate theme starter files
wp scaffold _s theme-name --theme_name="Theme Name" --author="Author Name"

# Check theme for errors
wp theme verify theme-name
```

### Plugin Development
```bash
# Activate a plugin
wp plugin activate plugin-name

# Deactivate a plugin
wp plugin deactivate plugin-name

# Generate plugin starter files
wp scaffold plugin plugin-name --plugin_name="Plugin Name"

# Run plugin tests (if PHPUnit is configured)
phpunit
```

### Database Operations
```bash
# Export database
wp db export backup.sql

# Import database
wp db import backup.sql

# Search and replace in database
wp search-replace 'old-domain.com' 'new-domain.com'

# Reset database
wp db reset
```

### Development Server
```bash
# Using PHP built-in server
php -S localhost:8000

# Using wp-cli server
wp server --host=localhost --port=8080

# Using Local by Flywheel, XAMPP, MAMP, or Docker
# Configure according to your local environment
```

## WordPress File Structure

When developing, follow these conventions:

### Theme Structure (Development - Root Level)
```
themes/theme-name/              ← ROOT-LEVEL (not wp-content/themes/)
├── style.css                   # Theme information and main styles
├── functions.php               # Theme functions and hooks
├── index.php                   # Main template file (classic themes)
├── theme.json                  # FSE theme configuration (REQUIRED for FSE)
├── templates/                  # FSE block templates
│   ├── index.html             # Main template
│   ├── front-page.html        # Homepage template
│   ├── single.html            # Single post template
│   ├── page.html              # Page template
│   └── 404.html               # 404 error template
├── parts/                      # FSE template parts
│   ├── header.html            # Header template part
│   ├── footer.html            # Footer template part
│   └── sidebar.html           # Sidebar template part
├── patterns/                   # Block patterns
├── assets/
│   ├── css/                   # Additional stylesheets
│   ├── js/                    # JavaScript files
│   └── images/                # Theme images
└── inc/                        # PHP includes

# Classic theme alternatives (if not using FSE):
# ├── header.php, footer.php, sidebar.php
# ├── single.php, page.php, archive.php
# └── template-parts/
```

### Plugin Structure (Development - Root Level)
```
plugins/plugin-name/            ← ROOT-LEVEL (not wp-content/plugins/)
├── plugin-name.php            # Main plugin file with header
├── includes/                  # PHP includes
├── admin/                     # Admin-specific functionality
├── public/                    # Public-facing functionality
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
└── languages/                 # Translation files
```

**Deployment Note:** During testing/deployment, files from `themes/` are copied to `wp-content/themes/` and files from `plugins/` are copied to `wp-content/plugins/`. See `.claude/skills/figma-to-fse-autonomous-workflow/TESTING-GUIDE.md` for deployment procedures.

## WordPress Development Standards

### PHP Coding Standards
- Follow WordPress PHP Coding Standards
- Use WordPress functions and APIs where available
- Properly escape output: `esc_html()`, `esc_url()`, `esc_attr()`
- Sanitize input: `sanitize_text_field()`, `sanitize_email()`, etc.
- Use nonces for form submissions and AJAX requests

### Database Interactions
- Use `$wpdb` global for custom queries
- Prepare SQL queries to prevent injection: `$wpdb->prepare()`
- Use WordPress functions for common operations (get_posts, WP_Query, etc.)

### Hooks and Filters
- Use action hooks: `add_action()`, `do_action()`
- Use filter hooks: `add_filter()`, `apply_filters()`
- Follow WordPress hook naming conventions
- Document custom hooks

### JavaScript and CSS
- Enqueue scripts and styles properly using `wp_enqueue_script()` and `wp_enqueue_style()`
- Localize scripts for AJAX: `wp_localize_script()`
- Use `wp_register_script()` for conditional loading

### Security Best Practices
- Validate and sanitize all user input
- Escape all output
- Use nonces for state-changing operations
- Check user capabilities: `current_user_can()`
- Keep WordPress, themes, and plugins updated

## Testing

### PHPUnit Testing
```bash
# Install PHPUnit
composer require --dev phpunit/phpunit

# Run tests
vendor/bin/phpunit

# Run specific test file
vendor/bin/phpunit tests/test-sample.php
```

### WordPress Debugging
Add to wp-config.php:
```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
define( 'SCRIPT_DEBUG', true );
```

## Common WordPress Functions

### Content Retrieval
- `get_posts()` - Retrieve posts
- `WP_Query` - Advanced post queries
- `get_pages()` - Retrieve pages
- `get_categories()` - Get categories
- `get_tags()` - Get tags

### Theme Functions
- `get_header()`, `get_footer()`, `get_sidebar()`
- `get_template_part()`
- `wp_head()`, `wp_footer()`
- `the_loop()`, `have_posts()`, `the_post()`

### User and Permissions
- `is_user_logged_in()`
- `current_user_can()`
- `wp_get_current_user()`
- `get_current_user_id()`

### Options and Settings
- `get_option()`, `update_option()`, `add_option()`
- `get_theme_mod()`, `set_theme_mod()`
- `get_site_option()` (for multisite)

---

## Claude Code Architecture & Configuration

### Installed Plugins (5 Total)

This project uses a lean, WordPress-optimized plugin configuration with 5 plugins:
- **episodic-memory** - Conversation search and memory
- **commit-commands** - Git workflow automation
- **php-lsp** - PHP language server
- **superpowers** - Advanced development workflows
- **ai-taskmaster** - Task management (local)

**Note:** GitHub integration via `gh` CLI (not a plugin)

**Full documentation:** `.claude/PLUGINS-REFERENCE.md`

---

### Custom Agents (49 Total)

49 specialized agents: 24 WordPress-focused development agents plus 25 generic cross-domain agents (meta/ops, business, marketing/social, engineering). Key WordPress agents include `frontend-developer`, `plugin-developer`, `test-writer-fixer`, `ui-designer`, `figma-fse-converter`, `canva-fse-converter`, `security-audit-agent`. Key generic agents include `agent-expert`, `backend-architect`, `migration-specialist`, `content-creator`, `devops-automator`.

Agents are invoked automatically based on task context.

**Full catalog:** `.claude/CUSTOM-AGENTS-GUIDE.md`

---

### Agent Naming Conflicts

**⚠️ Important:** Multiple agents share the name "code-reviewer"

Use this guide to select the right one:
- **feature-dev/code-reviewer** - General development code reviews
- **pr-review-toolkit/code-reviewer** - Pull request reviews before merge
- **superpowers/code-reviewer** - Plan alignment verification

**Quick rule:** Use the most specific agent for your context (PR → pr-review-toolkit, plan verification → superpowers, general → feature-dev)

**Full guide:** See `.claude/AGENT-NAMING-GUIDE.md`

---

### Custom WordPress Skills (9 Total)

9 WordPress-specific skills provide systematic workflows:

**Core:** FSE block theme development, block pattern creation, security hardening, WP-CLI workflows

**Advanced:** Testing, deployment automation, internationalization, hook integration

Skills auto-trigger based on keywords (e.g., "FSE", "security review", "deploy").

**Full catalog:** `.claude/skills/README.md`

---

### Development Workflow with Claude Code

**1. Theme Development Cycle**
```bash
# Start feature branch
git checkout -b feature/hero-block-pattern

# Develop with Claude Code
# - Use php-lsp for autocomplete
# - Use frontend-developer agent for UI work
# - Use test-writer-fixer for PHP tests

# Commit with structure
/commit
# Suggested: "feat: Add hero section block pattern"

# Create PR
/commit-push-pr
# Auto-generates PR with test plan
```

**2. Code Quality Workflow**
```bash
# Check coding standards (use root-level paths)
./scripts/wordpress/check-coding-standards.sh themes/my-theme

# Security scan (use root-level paths)
./scripts/wordpress/security-scan.sh themes/my-theme

# Performance check (use root-level paths)
./scripts/wordpress/check-performance.sh themes/my-theme

# Dependency vulnerability scan
./scripts/security-audit/scan-dependencies.sh .

# Generate security report with severity ratings
./scripts/security-audit/scan-dependencies.sh . 2>/dev/null | ./scripts/security-audit/generate-report.sh

# Auto-create issues for critical findings
./scripts/security-audit/scan-dependencies.sh . 2>/dev/null | ./scripts/security-audit/create-issues.sh

# Fix issues and commit
/commit
```

**Note:** Always use root-level paths (`themes/`, `plugins/`) for development scripts.

**3. Using Custom Agents**
Agents are invoked automatically based on task context, or explicitly:
```
User: "Help me optimize theme performance"
Claude: [Uses performance-benchmarker agent]

User: "Build a hero block pattern"
Claude: [Uses frontend-developer agent]

User: "Write tests for my custom post type"
Claude: [Uses test-writer-fixer agent]
```

**4. Figma-to-WordPress Automation**
Convert Figma designs to WordPress FSE themes automatically:
```
User: "Convert this Figma design to WordPress"
      [Provide Figma URL]

Claude: [Autonomous workflow 5-90 minutes]
        → Complete FSE theme with theme.json, templates, patterns
        → Images work immediately (pattern-first architecture)
        → Zero manual intervention

Result: themes/[theme-name]/ ready for WordPress
```

**Features:**
- Wholesale design system extraction (colors, typography, spacing)
- FSE template generation with WordPress blocks
- PHP patterns for images (avoids broken src="" in HTML templates)
- Automatic validation (security, standards, architecture)
- 100% theme.json token usage (no hardcoded values)

**Documentation:** `docs/figma-to-wordpress/README.md`

**5. Canva-to-WordPress Automation**
Convert Canva HTML/CSS exports to WordPress FSE themes:
```
User: "Convert this Canva export to WordPress"
      [Provide path to Canva export directory]

Claude: [Autonomous workflow 5-30 minutes]
        → Parses CSS for design tokens (colors, fonts, spacing)
        → Converts HTML to WordPress block markup
        → Complete FSE theme with theme.json, templates, patterns
        → Zero manual intervention

Result: themes/[theme-name]/ ready for WordPress
```

**Features:**
- CSS design token extraction (colors, typography, spacing)
- HTML-to-block conversion (headings, paragraphs, images, sections)
- Shared validation infrastructure with Figma pipeline
- PHP patterns for images (pattern-first architecture)
- 100% theme.json token usage (no hardcoded values)

**Documentation:** `docs/canva-to-wordpress/README.md`

---

### WordPress + Claude Code Best Practices

**When Claude Code should:**
- ✅ Follow WordPress coding standards automatically
- ✅ Use WordPress functions instead of raw PHP/MySQL
- ✅ Escape output with `esc_html()`, `esc_url()`, `esc_attr()`
- ✅ Sanitize input with `sanitize_text_field()`, etc.
- ✅ Use nonces for form submissions
- ✅ Check user capabilities with `current_user_can()`
- ✅ Enqueue scripts/styles with `wp_enqueue_script()`
- ✅ Use `$wpdb->prepare()` for custom queries
- ✅ Create structured git commits with `/commit`
- ✅ Use appropriate specialized agents for tasks

**Security Reminders for Claude Code:**
- Never trust user input
- Always escape output
- Use nonces for state-changing operations
- Verify user capabilities before sensitive operations
- Keep WordPress, themes, and plugins updated

---

### Architecture Notes

**Plugin Philosophy:**
- Lean configuration (5 plugins total)
- WordPress-specific focus (php-lsp, not 9+ language servers)
- No redundant or duplicate plugins
- All plugins serve WordPress development
- GitHub integration via `gh` CLI (not a plugin)

**Agent Philosophy:**
- 46 custom agents available (21 WordPress-focused + 25 generic cross-domain)
- Agents invoked contextually by Claude Code
- No action required - automatic selection

**Documentation Structure:**
- `CLAUDE.md` (this file) - WordPress development guidance and quick reference
- `docs/QUICK-START.md` - 5-minute getting started guide
- `docs/PREREQUISITES.md` - Complete requirements checklist
- `docs/figma-to-wordpress/` - Figma-to-FSE automation documentation
  - `README.md` - User guide and quick start
  - `IMPLEMENTATION.md` - Technical implementation details
  - `EXAMPLES.md` - FSE template syntax examples
- `.claude/PLUGINS-REFERENCE.md` - Plugin commands and detailed usage
- `.claude/CUSTOM-AGENTS-GUIDE.md` - Complete agent catalog
- `.claude/AGENT-NAMING-GUIDE.md` - Agent name disambiguation
- `.claude/skills/README.md` - WordPress skills catalog
- `LOCAL-DEVELOPMENT.md` - Docker setup for local WordPress
- `themes/` - Generated FSE themes go here

**Troubleshooting:**
- `docs/TROUBLESHOOTING.md` - General troubleshooting guide
- `docs/docker-troubleshooting.md` - Docker & container issues (15 common problems)
- `docs/COMMON-FAILURES-FIXES.md` - Figma-to-WordPress workflow issues
- `docs/MCP-TROUBLESHOOTING.md` - MCP server debugging
- `docs/E2E-VALIDATION.md` - End-to-end validation procedures

---

### Quick Command Reference

**WordPress Development:**
```bash
wp core download              # Download WordPress
wp theme activate my-theme    # Activate theme
wp plugin list                # List plugins
wp db export backup.sql       # Backup database
```

**Git Workflows (via commit-commands):**
```bash
/commit                       # Structured commit
/commit-push-pr              # Commit + push + PR
/clean_gone                   # Clean merged branches
```

**GitHub CLI Workflows:**
```bash
gh pr create                  # Create pull request
gh pr list                    # List pull requests
gh issue create               # Create issue
gh repo view                  # View repository info
gh auth status                # Check authentication
```

**Code Quality:**
```bash
./scripts/wordpress/check-coding-standards.sh [path]
./scripts/wordpress/security-scan.sh [path]
./scripts/wordpress/check-performance.sh [path]
```

**Agent Config Validation:**
```bash
./scripts/validate-agent-configs.sh              # Validate all .claude/ configs
./scripts/validate-agent-configs-ci.sh            # CI dry-run (exits non-zero on error)
```

**Security Audit:**
```bash
./scripts/security-audit/scan-dependencies.sh [path]   # Scan dependencies for CVEs
./scripts/security-audit/generate-report.sh             # Generate vulnerability report (stdin)
./scripts/security-audit/create-issues.sh               # Create GitHub issues for critical findings (stdin)
```

**Visual QA & Quality Scripts:**
```bash
./scripts/visual-diff.js [actual] [expected]     # Pixel-level screenshot comparison
./scripts/check-responsive.sh [url]               # Responsive screenshots at all breakpoints
./scripts/check-dark-mode.sh [url]                # Dark mode visual verification
./scripts/check-dead-code.sh [--json]             # PHP dead code detection (Psalm/PHPStan)
```

### PostToolUse Hooks (6 Total)
- **post-build-qa** — Reminds to run full quality gate after theme validation
- **pre-commit-guard** — Checks for hardcoded colors before commits
- **coverage-check** — Reminds to review PHPUnit/Pest coverage output
- **dark-mode-reminder** — Suggests dark mode verification after visual diff
- **bundle-guard** — Warns if theme >5MB or plugin >10MB before commits
- **mutation-test** — Suggests Infection PHP after all tests pass

**Plugin Management:**
```bash
/plugin list                  # List installed plugins
/plugin install <name>        # Install plugin
/plugin uninstall <name>      # Uninstall plugin
```

---

**Last Updated:** 2026-03-25
**Architecture Status:** ✅ Lean, WordPress-optimized configuration (5 plugins + gh CLI + 49 agents)