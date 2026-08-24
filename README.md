# Flavian

**Figma designs to working WordPress sites, automatically.**

Flavian is a Claude Code-powered pipeline that converts a Figma design (or a Canva HTML/CSS export) into a complete WordPress FSE block theme running on a local Docker WordPress instance — with a minimum of questions asked. Hand it a design, get back a theme with `theme.json`, templates, block patterns, and images already wired up.

## How It Works

1. **You provide a design.** A Figma URL (Dev Mode enabled) or a Canva HTML export directory.
2. **Claude Code converts it.** Design tokens (colors, typography, spacing) are extracted and a full FSE block theme is generated in `themes/[theme-name]/`.
3. **You activate and iterate.** The theme runs against the included Docker WordPress environment. Edit, refresh, done.

Typical runtime: 5–30 minutes. No manual `theme.json` authoring.

**What you get:**
- Complete FSE block theme — `theme.json`, templates, block patterns, template parts
- Design tokens extracted directly from the source (no hardcoded colors, fonts, or spacing)
- Images wired up via pattern-first architecture (no broken `src=""` in HTML templates)
- Automatic validation against WordPress coding standards and security best practices
- A running local WordPress site at http://localhost:8080

## Desktop GUI (experimental)

Prefer not to use a terminal? A cross-platform **desktop GUI** wraps the whole workflow behind a graphical interface — five screens: **Prerequisites**, **Setup wizard**, **WordPress (Docker)**, **Convert design** (Figma/Canva/InDesign), and **Visual QA**. It's a thin orchestration layer over the existing scripts and pipelines — it invokes them, it doesn't replace them. Run it from source with `pnpm gui:dev` (or build an installer with `pnpm gui:package`). See **[docs/GUI.md](docs/GUI.md)**.

## Prerequisites

| Requirement | What for | Install |
|---|---|---|
| **[Claude Code](https://claude.ai/code)** | The conversion engine | `npm install -g @anthropic-ai/claude-code` |
| **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** | Local WordPress (WordPress + MySQL + phpMyAdmin) | [docker.com/download](https://www.docker.com/products/docker-desktop/) |
| **[Node.js](https://nodejs.org/) 22.12+** | Tooling: pnpm, setup wizard, pipelines, Playwright MCP | [nodejs.org](https://nodejs.org/) |
| **[pnpm](https://pnpm.io/) 9.x** | Package manager (workspace scripts, init wizard, GUI/pipeline) | `corepack enable` (bundled with Node) |
| **[Git](https://git-scm.com/)** | Version control | [git-scm.com](https://git-scm.com/) |
| **[Figma Professional+](https://www.figma.com/pricing/)** | Dev Mode — required to extract design tokens (skip if using Canva input only) | [figma.com](https://www.figma.com/) |

**Auto-check:** `./scripts/check-prerequisites.sh` · **Full details:** [docs/PREREQUISITES.md](docs/PREREQUISITES.md)

## Quick Start

```bash
# 1. Clone and enter
git clone <repository-url>
cd Flavian

# 2. Install deps and run the interactive setup wizard
pnpm install
pnpm run init                   # interactive
# or non-interactive:
pnpm run init -- --yes --name=my-site --theme=blank
```

The wizard writes `.env`, scaffolds a starter theme, optionally stages
WooCommerce, and makes an initial git commit. See
[docs/CLI-WIZARD.md](docs/CLI-WIZARD.md) for all flags and prompts.

```bash
# 3. Boot local WordPress (Docker must be running)
./wordpress-local.sh build      # first time only
./wordpress-local.sh start
./wordpress-local.sh install    # first time only

# 4. Open Claude Code and hand it your design
claude
> Convert this Figma design to WordPress: <your-figma-url>
```

Claude generates the theme in `themes/[theme-name]/`. Activate it:

```bash
./wordpress-local.sh activate-theme [theme-name]
```

Site at http://localhost:8080 · Admin at /wp-admin · Database UI at :8081.

**Supported inputs (pipelines):**
- **Figma URL** — requires Professional plan (Dev Mode). See [docs/figma-to-wordpress/README.md](docs/figma-to-wordpress/README.md).
- **Canva HTML/CSS export directory** — no account tier required. See [docs/canva-to-wordpress/README.md](docs/canva-to-wordpress/README.md).
- **InDesign document** — an exported `.idml` (preferred) or PDF. Run `flavian pipeline indesign <input> --output themes/<slug>`. See [docs/pipelines/indesign.md](docs/pipelines/indesign.md).

**More docs:** [docs/QUICK-START.md](docs/QUICK-START.md) · [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md) · [docs/docker-troubleshooting.md](docs/docker-troubleshooting.md)

> **Versioning:** the source of truth is git tags + `.release-please-manifest.json`; release-please mirrors that version into `package.json` (currently `1.12.0`) — don't bump it by hand. See [Versioning](CONTRIBUTING.md#versioning) in CONTRIBUTING.md.

<details>
<summary>Alternative: use as a wp-content directory in an existing WordPress install</summary>

If you already run WordPress outside Docker and just want Flavian's scripts and Claude Code integration:

```bash
git clone <repository-url> wp-content
cd .. && wp core download --skip-content
wp config create --dbname=your_db --dbuser=root --dbpass=password
wp core install --url=example.test --title="Your Site" --admin_user=admin --admin_password=password --admin_email=you@example.com
```
</details>

## Directory Structure

### ⚠️ Development Structure (Root-Level Folders)

**During development, this project uses ROOT-LEVEL WordPress folders:**

```
project-root/
├── themes/              ← Themes go HERE during development
├── plugins/             ← Plugins go HERE during development
├── mu-plugins/          ← Must-use plugins go HERE during development
├── scripts/             # Development automation scripts
│   └── wordpress/       # WordPress-specific tools
│   └── figma-fse/       # Figma-to-FSE conversion scripts
├── docs/                # Documentation and planning
└── .claude/             # Claude Code configuration
```

**Why root-level?**
- Cleaner development structure (no nested wp-content)
- Easier version control
- Separation between development and deployment environments

### Deployment Structure (WordPress wp-content)

**When deploying to WordPress, files are copied to standard wp-content structure:**

```
wordpress-install/
└── wp-content/
    ├── themes/          ← Development themes/ copied here for testing
    ├── plugins/         ← Development plugins/ copied here for testing
    ├── mu-plugins/      ← Development mu-plugins/ copied here for testing
    ├── uploads/         # Media files (gitignored)
    ├── languages/       # Translation files
    └── upgrade/         # WordPress upgrade files (gitignored)
```

**NEVER create files in `wp-content/` during development.** Use root-level `themes/`, `plugins/`, `mu-plugins/` folders.

## WordPress Development Tools

### Security & Quality Scripts

```bash
# Set up PHP CodeSniffer with WordPress standards
./scripts/wordpress/setup-phpcs.sh

# Check WordPress coding standards
./scripts/wordpress/check-coding-standards.sh [path]

# Run security scan
./scripts/wordpress/security-scan.sh [path]

# Check performance
./scripts/wordpress/check-performance.sh [path]
```

### WP-CLI Commands

See `CLAUDE.md` for comprehensive WP-CLI command reference for:
- WordPress core management
- Theme development
- Plugin development
- Database operations
- Development server setup

## Claude Code Integration

This template is optimized for WordPress development with Claude Code, featuring:

### **Architecture Overview**
- **Lean Plugin Setup**: 6 Claude Code plugins (5 user + 1 local)
- **Custom Agents**: 53 specialized agents
- **Custom Skills**: 12 workflows covering the Figma/Canva/InDesign-to-FSE pipelines, security, testing, and i18n
- **Documentation Hub**: Comprehensive guides in `.claude/` directory

### **Installed Plugins**
```
✅ episodic-memory     # Semantic search and persistent memory
✅ commit-commands     # Structured git workflows (/commit, /commit-push-pr)
✅ github              # GitHub integration (PRs, issues, repos)
✅ php-lsp             # PHP code intelligence (autocomplete, go-to-definition)
✅ superpowers         # Advanced development workflows and skills
✅ ai-taskmaster       # Task management (local plugin)
```

### **WordPress-Relevant Custom Agents** (highlights)
Full catalog of 53 agents in [`.claude/CUSTOM-AGENTS-GUIDE.md`](.claude/CUSTOM-AGENTS-GUIDE.md). Key WordPress-specific ones:
```
✅ figma-fse-converter      # Figma-to-FSE theme conversion
✅ canva-fse-converter      # Canva-to-FSE theme conversion
✅ indesign-to-wordpress    # InDesign (.idml/PDF) → FSE theme conversion
✅ frontend-developer       # JS/CSS implementation for FSE themes
✅ test-writer-fixer        # PHP unit testing
✅ ui-designer              # Block pattern design
✅ visual-qa-agent          # Visual regression and design comparison
✅ accessibility-auditor    # WCAG 2.1 AA compliance checks
✅ security-audit-agent     # Dependency/CVE scanning + WPCS enforcement
```

### **WordPress Development Skills**
```
✅ figma-to-fse-autonomous-workflow  # Orchestrator for Figma-to-FSE conversion
✅ canva-to-fse-autonomous-workflow  # Orchestrator for Canva-to-FSE conversion
✅ indesign-conversion               # InDesign (.idml/PDF) → FSE conversion
✅ fse-block-theme-development       # theme.json, templates, FSE structure
✅ fse-pattern-first-architecture    # PHP patterns for images (enforced)
✅ block-pattern-creation            # Pattern registration and reuse
✅ visual-qa-verification            # Post-conversion screenshot + Lighthouse QA
✅ wordpress-security-hardening      # Sanitize, escape, nonces, capabilities
✅ wordpress-internationalization    # i18n/l10n wrappers and POT generation
✅ wordpress-hook-integration        # Claude Code agent hooks for WordPress
✅ wp-cli-workflows                  # WP-CLI automation (theme activation, DB, content)
✅ wordpress-testing-workflows       # PHPUnit test creation and execution
```

**What Skills Provide:**
- Systematic workflows for WordPress development tasks
- Prevention of common WordPress mistakes
- Quick reference tables and code examples
- Security-first approaches with rationalization detection
- Integration with existing agents and automation scripts

**Skills Documentation:** `.claude/skills/README.md`

### **Claude Code Documentation**
- **`CLAUDE.md`** - WordPress development guidance and quick reference
- **`docs/QUICK-START.md`** - 5-minute getting started guide
- **`docs/PREREQUISITES.md`** - Complete requirements checklist
- **`docs/figma-to-wordpress/`** - Figma-to-FSE automation documentation
  - `README.md` - User guide and quick start
  - `IMPLEMENTATION.md` - Technical implementation details
  - `EXAMPLES.md` - FSE template syntax examples
- **`.claude/skills/README.md`** - WordPress skills catalog
- **`.claude/PLUGINS-REFERENCE.md`** - Plugin commands and usage
- **`.claude/CUSTOM-AGENTS-GUIDE.md`** - Custom agent catalog
- **`.claude/AGENT-NAMING-GUIDE.md`** - Agent disambiguation
- **`LOCAL-DEVELOPMENT.md`** - Docker setup for local WordPress

### **Troubleshooting**
- **`docs/TROUBLESHOOTING.md`** - General troubleshooting guide
- **`docs/docker-troubleshooting.md`** - Docker & container issues (incl. [Apple Silicon / M-series Macs](docs/docker-troubleshooting.md#apple-silicon))
- **`docs/COMMON-FAILURES-FIXES.md`** - Figma-to-WordPress specific issues
- **`docs/MCP-TROUBLESHOOTING.md`** - MCP server debugging
- **`docs/E2E-VALIDATION.md`** - End-to-end testing procedures

### **What Claude Code Provides**
- WordPress coding standards compliance
- Proper use of WordPress APIs and functions
- Security best practices (escaping, sanitization, nonces)
- Structured git commits and PR workflows
- PHP code intelligence and autocomplete
- Specialized agents for WordPress development tasks

## Development Best Practices

- **Follow WordPress Coding Standards**: Use PHPCS with WordPress standards
- **Security First**: Sanitize input, escape output, use nonces, check capabilities
- **Use WordPress APIs**: Leverage built-in WordPress functions instead of reinventing
- **Test Locally**: Use Local by Flywheel, XAMPP, MAMP, or Docker for development
- **Version Control**: This template includes comprehensive `.gitignore` for WordPress

> **Versioning:** the repository version is tracked in git tags +
> `.release-please-manifest.json` (source of truth) and mirrored into
> `package.json` by [release-please](https://github.com/googleapis/release-please).
> Don't bump versions by hand. See
> [CONTRIBUTING.md → Versioning](CONTRIBUTING.md#versioning) for the convention and
> [docs/RELEASING.md](docs/RELEASING.md) for the full release flow.

## Resources

- [WordPress Developer Handbook](https://developer.wordpress.org/)
- [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/)
- [WP-CLI Documentation](https://wp-cli.org/)
- [Block Editor Handbook](https://developer.wordpress.org/block-editor/)

## Related Projects

| Project | Description |
|---------|-------------|
| [AI SEO Copilot (Chrome)](https://github.com/die-Manufaktur/AISEOC-Chrome-Extension) | Free Chrome extension for SEO analysis. Works on any site including WordPress. Use it to verify the SEO output of sites built with Flavian. [Install from Chrome Web Store](https://chromewebstore.google.com/detail/ai-seo-copilot/anhpobnkbmgjhcgbohkddjjpcbbdllhl) |
| [AI SEO Copilot (Webflow)](https://github.com/die-Manufaktur/AI-SEO-Copilot-for-Webflow) | The original Webflow app with ~20,000 installs |
| [Aurelius](https://github.com/PMDevSolutions/Aurelius) | Claude Code-integrated React app development framework with Figma-to-React pipelines |
| [Nerva](https://github.com/PMDevSolutions/Nerva) | Claude Code-integrated API and backend development framework with Hono, Cloudflare Workers, and Drizzle ORM |
| [Claudius](https://github.com/PMDevSolutions/Claudius) | Embeddable AI chat widget powered by Claude. React + TypeScript + Cloudflare Workers |

## License

This template is licensed under the [MIT License](LICENSE). WordPress itself is licensed under GPL v2 or later.
