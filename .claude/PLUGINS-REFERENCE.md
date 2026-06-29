# Claude Code Plugins Quick Reference

**Installation Date:** 2026-01-18
**Installed Plugins:** 5 user plugins + 1 local plugin
**Status:** Lean, WordPress-optimized configuration ✅

## Currently Installed Plugins

**User Plugins (5):**
- `episodic-memory` - Conversation search and persistent memory
- `commit-commands` - Git workflow automation
- `github` - GitHub integration
- `php-lsp` - PHP language server
- `superpowers` - Advanced development workflows

**Local Plugins (1):**
- `ai-taskmaster` - Task management and planning

---

## 🔧 php-lsp Plugin

### Purpose
Provides PHP language server integration for code intelligence in WordPress theme and plugin development.

### Features
- **Autocomplete:** WordPress functions, classes, and your custom code
- **Go-to-Definition:** Jump to function/class definitions (Ctrl+Click or F12)
- **Hover Info:** Documentation and type information on hover
- **Error Detection:** Real-time PHP syntax and semantic errors
- **Symbol Search:** Find functions, classes, variables across files

### WordPress Development Use Cases
```php
// Autocomplete WordPress functions
wp_enqueue_script(...)  // Shows parameters and documentation
get_template_part(...)  // Suggests available template parts
add_action(...)         // Lists available hooks

// Navigate theme structure
function my_theme_setup() {  // Click to jump to definition
    // ...
}
```

### Configuration
- **Prerequisite:** Requires `intelephense` language server
- **Installation:** `npm install -g intelephense` (if not already installed)
- **Workspace:** Automatically discovers PHP files in project
- **Performance:** Indexes on startup; may take a moment for large themes

### Troubleshooting
- If autocomplete isn't working, verify intelephense is installed: `which intelephense`
- Restart Claude Code after installing intelephense
- Check LSP logs if issues persist

---

## 🐙 github Plugin

### Purpose
GitHub integration for version control, pull requests, and issue management directly from Claude Code.

### Authentication Setup
**Required:** GitHub Personal Access Token (PAT)

1. Go to: https://github.com/settings/tokens/new
2. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
3. Generate token and save securely
4. Configure in Claude Code when prompted

### Common Commands
```bash
# List repositories
gh repo list

# View repository info
gh repo view owner/repo

# Create a pull request
gh pr create --title "Add feature" --body "Description"

# List pull requests
gh pr list

# View PR details
gh pr view 123

# Create an issue
gh issue create --title "Bug report" --body "Details"

# List issues
gh issue list
```

### WordPress Development Workflows

#### Theme Development Workflow
```bash
# 1. Create feature branch
git checkout -b feature/new-block-pattern

# 2. Make changes to theme files
# ... edit files ...

# 3. Commit changes (use commit-commands)
# See commit-commands section below

# 4. Create PR for review
gh pr create --title "Add hero block pattern" \
  --body "Adds responsive hero section pattern for FSE themes"
```

#### Managing WordPress Security Updates
```bash
# Check for plugin/theme security issues
gh issue list --label security

# Create security update PR
gh pr create --title "Security: Update WordPress to 6.5" \
  --label security
```

### Integration with WordPress
- Track theme/plugin development iterations
- Manage client feedback as GitHub issues
- Create PRs for staging/production deployments
- Document block patterns and custom blocks

---

## 📝 commit-commands Plugin

### Purpose
Structured git commit workflows and PR creation helpers.

### Available Commands

#### `/commit` - Structured Commit Creation
Creates well-formatted commits following best practices.

**Usage:**
```bash
/commit
```

Claude Code will:
1. Analyze staged changes
2. Suggest a commit message
3. Follow repository commit conventions
4. Add co-authorship attribution

**WordPress Commit Message Conventions:**
```
feat: Add new hero block pattern for FSE themes
fix: Resolve mobile responsive issue in navigation block
style: Update block editor color palette
docs: Add installation instructions to README
refactor: Extract template parts for better reusability
test: Add PHPUnit tests for custom post type registration
```

#### `/commit-push-pr` - Complete Workflow
Creates commit, pushes to remote, and opens a pull request in one command.

**Usage:**
```bash
/commit-push-pr
```

**Workflow:**
1. Stages relevant changes
2. Creates structured commit
3. Pushes to remote branch
4. Opens GitHub PR with auto-generated description

**Ideal for:**
- Feature releases
- Bug fixes ready for review
- Theme updates for client approval

#### `/clean_gone` - Cleanup Stale Branches
Removes local branches that have been deleted on remote.

**Usage:**
```bash
/clean_gone
```

Cleans up branches after PR merges, keeping your workspace tidy.

### WordPress Development Integration

#### Feature Development Cycle
```bash
# 1. Create feature branch
git checkout -b feature/custom-query-block

# 2. Develop and test
# ... code your custom block ...

# 3. Commit with structure
/commit
# Suggested: "feat: Add custom query loop block for post filtering"

# 4. Push and create PR
git push -u origin feature/custom-query-block
gh pr create --title "Add custom query block"
```

#### Hotfix Workflow
```bash
# 1. Create hotfix branch
git checkout -b hotfix/security-escaping

# 2. Fix the issue
# ... sanitize output ...

# 3. Quick commit, push, and PR
/commit-push-pr
# Auto-generates PR with security context
```

#### Maintenance Tasks
```bash
# After merging multiple PRs
/clean_gone
# Removes merged feature branches
```

---

## 🎯 WordPress FSE Development Workflows

### Block Theme Development

**1. Create New Block Pattern**
```bash
# Create pattern file
# themes/my-theme/patterns/hero-section.php

# Test in editor, then commit
/commit
# Message: "feat: Add hero section block pattern"
```

**2. Update theme.json**
```bash
# Modify theme.json settings
# themes/my-theme/theme.json

# Commit with context
/commit
# Message: "style: Update color palette and typography scale"
```

**3. Add Template Part**
```bash
# Create new template part
# themes/my-theme/parts/footer-minimal.html

# Commit and document
/commit
# Message: "feat: Add minimal footer template part variant"
```

### Plugin Development

**1. Create Custom Block Plugin**
```bash
# Scaffold plugin structure
# plugins/my-custom-blocks/

# Initial commit
/commit
# Message: "feat: Initialize custom blocks plugin with build setup"
```

**2. Security Fixes**
```bash
# Fix XSS vulnerability
# Update escaping in template output

/commit-push-pr
# Auto-creates PR: "fix: Add proper output escaping to prevent XSS"
# Labels: security, high-priority
```

### Theme Review Preparation

**Before Submitting to WordPress.org:**
```bash
# 1. Run theme checks
./scripts/wordpress/check-coding-standards.sh
./scripts/wordpress/security-scan.sh

# 2. Fix issues and commit
/commit
# Message: "fix: Address WordPress theme review requirements"

# 3. Create submission PR
gh pr create --title "Theme ready for WordPress.org submission" \
  --body "All theme check and security requirements met"
```

---

## 🔐 Security Best Practices

### GitHub Token Security
- **Never commit** your GitHub PAT to the repository
- Store in environment variables or secure credential manager
- Rotate tokens regularly (every 90 days recommended)
- Use fine-grained tokens with minimal required scopes

### Plugin Permissions
These plugins may require permissions for:
- Git operations (read/write)
- GitHub API access
- File system access for indexing (php-lsp)

Check `.claude/settings.local.json` for configured permissions.

---

## 🚀 Next Steps

### Verify PHP LSP is Working
1. Open a PHP file: `themes/your-theme/functions.php`
2. Start typing `wp_` and check for autocomplete suggestions
3. Hover over a function to see documentation
4. Use Ctrl+Click to jump to definitions

### Test GitHub Integration
```bash
# View your repositories
gh repo list

# Check authentication
gh auth status
```

### Create Your First Structured Commit
```bash
# Make a small change (e.g., update README)
# Stage the change
git add README.md

# Use commit command
/commit
```

### Recommended Workflow Setup
1. ✅ Install WordPress locally (XAMPP, Local, Docker)
2. ✅ Configure theme development environment
3. ✅ Test PHP autocomplete in theme files
4. ✅ Set up GitHub repository for version control
5. ✅ Create first feature branch and PR using new plugins

---

## 📚 Additional Resources

### WordPress Development
- [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/)
- [Block Editor Handbook](https://developer.wordpress.org/block-editor/)
- [Theme Handbook](https://developer.wordpress.org/themes/)

### Git & GitHub
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

### Plugin Documentation
- Run `/plugin list` to see all installed plugins
- Check individual plugin docs for advanced features

---

## ⚡ Quick Commands Cheat Sheet

```bash
# PHP Development
# (Automatic - just start typing in PHP files)

# GitHub Operations
gh repo list                    # List repos
gh pr create                    # Create PR
gh pr list                      # List PRs
gh issue create                 # Create issue

# Git Workflows
/commit                         # Structured commit
/commit-push-pr                 # Commit + push + PR
/clean_gone                     # Clean merged branches

# Plugin Management
/plugin list                    # List all plugins
/plugin install <name>          # Install plugin
/plugin uninstall <name>        # Remove plugin
```

---

---

## 🔍 episodic-memory Plugin

The `episodic-memory` plugin provides semantic search and persistent memory across sessions.

**Benefits for WordPress Development:**
- Search previous conversations semantically
- Archives conversations automatically
- Maintains context across sessions
- Find solutions to past problems quickly
- Persistent memory survives Claude Code's 30-day deletion

**Usage:**
```bash
# Search previous conversations
/search-conversations [your query]

# Remember important context
/remember [something important]
```

**Technical Notes:**
- Uses SQLite database with vector search
- Archives stored in `~/.config/superpowers/conversations-archive`
- Fixed for Windows paths with spaces (2026-01-18)

---

## 🔧 ai-taskmaster (Local Plugin)

Task management and planning for WordPress development workflows.

**Usage:**
- Project task tracking
- Development milestone planning
- Integration with WordPress development cycles

**Commands:** Check plugin documentation for available task management commands.

---

## 📝 superpowers Plugin

Advanced development workflows and best practices enforcement.

**Key Features:**
- Code review workflows
- Development process guidance
- Best practices skills
- Systematic debugging approaches

**Skills Available:** Use `/` commands to access superpowers skills (e.g., `/commit`)

**Agent Naming Note:**
If you see agents named "code-reviewer" from different plugins, refer to `.claude/AGENT-NAMING-GUIDE.md` for disambiguation guidance.

---

## 🧹 Architecture Assessment (2026-01-18)

**Finding:** This project has a lean, WordPress-optimized plugin configuration.

**Current State:**
- ✅ 5 user plugins installed (all WordPress-relevant)
- ✅ No bloat from unused language servers
- ✅ No duplicate or redundant plugins
- ✅ Focused on PHP, Git, and GitHub workflows
- ✅ episodic-memory replaces claude-mem (Windows path issue fixed)

**Changes Made:**
- ❌ Removed `claude-mem` (broken on Windows, path with spaces issue)
- ✅ Added `episodic-memory` (working alternative with semantic search)
- 🔧 Fixed Windows path handling in episodic-memory hook (session-start-wrapper.cmd)

**Documentation Added:**
- `.claude/AGENT-NAMING-GUIDE.md` - Clarifies agent naming conflicts
- `.claude/CUSTOM-AGENTS-GUIDE.md` - Custom agent catalog
- This file updated to reflect current plugins

---

## 🎯 WordPress Development Skills (NEW)

**Installed:** 2026-01-18
**Total Skills:** 12 comprehensive WordPress workflows

This template includes custom WordPress development skills that complement the plugins and agents.

### What Skills Provide

**Skills are NOT plugins** - they are documentation-based workflows that trigger automatically when relevant keywords are detected in conversation.

**Benefits:**
- Systematic workflows for WordPress development tasks
- Prevention of common WordPress mistakes
- Quick reference tables and code examples
- Security-first approaches with rationalization detection
- Integration with existing agents and automation scripts

### Installed Skills

1. **figma-to-fse-autonomous-workflow**
   - Orchestrator for Figma-to-FSE conversion pipeline
   - Triggers: "convert Figma", "Figma to WordPress", "FSE conversion"

2. **canva-to-fse-autonomous-workflow**
   - Orchestrator for Canva-to-FSE conversion pipeline
   - Triggers: "convert Canva", "Canva to WordPress", "Canva HTML export"

3. **fse-block-theme-development**
   - FSE block theme creation with theme.json-first approach
   - Triggers: "create block theme", "theme.json", "FSE"

4. **fse-pattern-first-architecture**
   - Enforces PHP patterns for images in FSE templates (not inline HTML)
   - Triggers: auto-triggered when creating FSE templates with images

5. **block-pattern-creation**
   - Reusable block pattern registration and best practices
   - Triggers: "create pattern", "register pattern", "block pattern"

6. **visual-qa-verification**
   - Post-conversion QA: screenshots, responsive, Lighthouse, accessibility
   - Triggers: "verify theme", "visual QA", "compare to Figma"

7. **wordpress-security-hardening**
   - Security best practices: sanitize input, escape output, nonces
   - Triggers: "security review", "sanitize", "escape", "nonce"

8. **wordpress-testing-workflows**
   - PHPUnit testing for WordPress with test fixtures
   - Triggers: "write tests", "PHPUnit", "test coverage"

9. **wordpress-internationalization**
   - i18n/l10n implementation with POT file generation
   - Triggers: "translate", "i18n", "localization", "POT file"

10. **wordpress-hook-integration**
    - Claude Code agent hooks for WordPress automation
    - Triggers: "agent hook", "create hook", "automate"

11. **wp-cli-workflows**
    - WP-CLI automation with safe workflows and backups
    - Triggers: "scaffold theme", "wp command", "database export"

12. **indesign-conversion**
    - Orchestrator for converting Adobe InDesign documents (`.idml` or PDF) to FSE block themes
    - Triggers: "InDesign to WordPress", "IDML", "convert InDesign", "print to web"

### Skills vs Plugins

| Type | Purpose | Invocation | Example |
|------|---------|------------|---------|
| **Plugins** | Tool integrations and commands | Manual commands | `/commit`, `/search-conversations` |
| **Skills** | Workflows and best practices | Automatic keyword detection | "create block theme" triggers skill |
| **Agents** | Specialized task execution | Task tool | `frontend-developer` builds features |

### How They Work Together

```
User: "I need to create a secure contact form"
    ↓
wordpress-security-hardening skill provides:
    - Form processing security checklist
    - Nonce verification patterns
    - Input sanitization examples
    - Output escaping guidance
    ↓
frontend-developer agent implements:
    - Form HTML structure
    - AJAX handling
    - Error messaging
    ↓
wordpress-testing-workflows skill guides:
    - PHPUnit test creation
    - Security test patterns
    - Edge case coverage
```

**Skills Documentation:** `.claude/skills/README.md`

---

**Last Updated:** 2026-01-18
**Template Version:** 1.0.0
**Architecture Status:** ✅ Optimized and Windows-compatible
**WordPress Skills:** ✅ 12 comprehensive workflows installed
