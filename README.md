# WordPress Development Template

A clean `wp-content` directory structure for modern WordPress development, enhanced with Claude Code integration and WordPress-specific development tools.

## What This Template Provides

- **Clean Directory Structure**: Empty `wp-content` structure ready for theme and plugin development
- **WordPress Development Scripts**: Security scanning, performance checking, coding standards validation
- **Git Configuration**: Comprehensive `.gitignore` for WordPress development
- **Claude Code Integration**: WordPress-specific guidance in `CLAUDE.md` for AI-assisted development

## Prerequisites

You need these installed before using this template:

| Requirement | What For | Install |
|-------------|----------|---------|
| **[Claude Code](https://claude.ai/code)** | AI-assisted development (the core tool) | `npm install -g @anthropic-ai/claude-code` |
| **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** | Local WordPress environment | [docker.com/download](https://www.docker.com/products/docker-desktop/) |
| **[Node.js](https://nodejs.org/) 18+** | Playwright MCP (browser testing) | [nodejs.org](https://nodejs.org/) |
| **[Git](https://git-scm.com/)** | Version control | [git-scm.com](https://git-scm.com/) |

**For Figma-to-WordPress conversion (optional):**
| Requirement | What For |
|-------------|----------|
| **[Figma](https://www.figma.com/) Professional+** | Design token extraction via Dev Mode |

**Full details:** [docs/PREREQUISITES.md](docs/PREREQUISITES.md) | **Auto-check:** `./scripts/check-prerequisites.sh`

## 🚀 Quick Start

```bash
# 1. Clone and enter the project
git clone <repository-url>
cd CC-WP-Template

# 2. Start local WordPress (Docker must be running)
./wordpress-local.sh start
./wordpress-local.sh install

# 3. Open Claude Code and start building
claude
```

WordPress will be at http://localhost:8080 (admin: admin/admin).

**Detailed guide:** [docs/QUICK-START.md](docs/QUICK-START.md)

### Alternative: Use as wp-content Directory
```bash
git clone <repository-url> wp-content
cd .. && wp core download --skip-content
wp config create --dbname=your_db --dbuser=root --dbpass=password
wp core install --url=example.test --title="Your Site" --admin_user=admin --admin_password=password --admin_email=you@example.com
```

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
- **Lean Plugin Setup**: 5 WordPress-focused plugins + 1 local task manager
- **Custom Agents**: 24 specialized agents (8 WordPress-relevant, 16 general-purpose)
- **Documentation Hub**: Comprehensive guides in `.claude/` directory

### **Installed Plugins**
```
✅ episodic-memory     # Semantic search and persistent memory
✅ commit-commands     # Structured git workflows (/commit, /commit-push-pr)
✅ github              # GitHub integration (gh CLI)
✅ php-lsp             # PHP code intelligence (autocomplete, go-to-definition)
✅ superpowers         # Advanced development workflows and skills
✅ ai-taskmaster       # Task management (local plugin)
```

### **WordPress-Relevant Custom Agents**
```
✅ frontend-developer       # JS/CSS implementation for FSE themes
✅ test-writer-fixer        # PHP unit testing
✅ ui-designer              # Block pattern design
✅ ux-researcher            # Theme usability testing
✅ performance-benchmarker  # Performance optimization
✅ api-tester              # REST API testing
✅ analytics-reporter      # Performance metrics
✅ workflow-optimizer      # Development process improvement
```

### **WordPress Development Skills (NEW! ✨)**
```
✅ fse-block-theme-development      # FSE block theme creation workflows
✅ block-pattern-creation           # Reusable block pattern registration
✅ wordpress-security-hardening     # Security best practices (sanitize, escape, nonces)
✅ wp-cli-workflows                 # WP-CLI automation with safe workflows
✅ wordpress-testing-workflows      # PHPUnit testing for WordPress
✅ wordpress-deployment-automation  # CI/CD pipelines with GitHub Actions
✅ wordpress-internationalization   # i18n/l10n implementation
✅ wordpress-hook-integration       # Claude Code agent hooks for WordPress
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

## Resources

- [WordPress Developer Handbook](https://developer.wordpress.org/)
- [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/)
- [WP-CLI Documentation](https://wp-cli.org/)
- [Block Editor Handbook](https://developer.wordpress.org/block-editor/)

## License

This template is licensed under the [MIT License](LICENSE). WordPress itself is licensed under GPL v2 or later.
