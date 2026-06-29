# Agent Hook Scripts

This directory contains hook scripts for Claude Code agents. These hooks provide validation, automation, and safety features that run automatically when agents are used.

## Overview

The hook system consists of:
- **4 WordPress validation scripts** - Global validation for PHP files
- **21 agent-specific scripts** - 3 scripts per agent for 7 specialized agents
- **Automated reporting** - All hooks save reports to `.claude/reports/`

## WordPress Global Hooks

These hooks run automatically for any agent working with PHP files:

### Security Scanner (`wordpress/security-scan.sh`)
- **Type**: Blocking (exit 2)
- **Trigger**: After writing/editing PHP files
- **Purpose**: Detects critical security vulnerabilities
- **Checks**:
  - SQL injection patterns (unescaped queries)
  - XSS vulnerabilities (missing escaping)
  - Missing nonce validation
  - Unsafe file operations
  - Command injection risks
  - Missing capability checks

### Coding Standards (`wordpress/check-coding-standards.sh`)
- **Type**: Warning (exit 0)
- **Trigger**: After writing/editing PHP files
- **Purpose**: Enforces WordPress Coding Standards via PHPCS
- **Setup**: Run `./scripts/wordpress/setup-phpcs.sh` first

### Performance Checker (`wordpress/check-performance.sh`)
- **Type**: Warning (exit 0)
- **Trigger**: After writing/editing PHP files
- **Purpose**: Identifies WordPress performance anti-patterns
- **Checks**:
  - Uncached `get_posts()` calls
  - `WP_Query` without post limits
  - Database queries in loops (N+1)
  - Missing transient caching
  - Inefficient taxonomy queries

### Setup (`wordpress/setup-phpcs.sh`)
- **Purpose**: Installs PHP CodeSniffer with WordPress Coding Standards
- **Run once**: `./scripts/wordpress/setup-phpcs.sh`
- **Requirements**: Composer, PHP

## Agent-Specific Hooks

Each agent has 3 specialized hooks that run at different lifecycle stages.

### test-writer-fixer

**Hooks**:
1. **PreToolUse** - `validate-test-command.sh` - Validates test commands before execution
2. **PostToolUse** - `save-coverage.sh` - Saves test coverage reports
3. **Stop** - `commit-coverage.sh` - Creates coverage index

**WordPress Integration**: Yes (security, coding standards, performance)

**Reports**: `.claude/reports/test-writer-fixer/`

---

### performance-benchmarker

**Hooks**:
1. **SubagentStart** - `check-tools.sh` - Verifies profiling tools available
2. **PostToolUse** - `save-benchmarks.sh` - Archives benchmark results
3. **Stop** - `compare-results.sh` - Generates comparison reports

**WordPress Integration**: Yes (security, performance)

**Reports**: `.claude/reports/performance-benchmarker/`

---

### frontend-developer

**Hooks**:
1. **PostToolUse (Write/Edit)** - `lint-and-format.sh` - Auto-lints and formats code
2. **PostToolUse (Bash)** - `check-build.sh` - Verifies build passes
3. **Stop** - `build-report.sh` - Generates build status report

**WordPress Integration**: Yes (all WordPress hooks for PHP files)

**Reports**: `.claude/reports/frontend-developer/`

---

### api-tester

**Hooks**:
1. **SubagentStart** - `check-endpoints.sh` - Verifies API endpoints reachable
2. **PostToolUse** - `save-results.sh` - Archives API test results
3. **Stop** - `generate-summary.sh` - Creates test summary

**WordPress Integration**: No

**Reports**: `.claude/reports/api-tester/`

---

### docusaurus-expert

**Hooks**:
1. **PostToolUse (Write/Edit)** - `validate-markdown.sh` - Validates markdown/MDX
2. **PostToolUse (Bash)** - `check-build.sh` - Runs Docusaurus build
3. **Stop** - `preview-link.sh` - Generates preview instructions

**WordPress Integration**: No

**Reports**: `.claude/reports/docusaurus-expert/`

---

### analytics-reporter

**Hooks**:
1. **SubagentStart** - `check-data-sources.sh` - Verifies database/API connections
2. **PostToolUse** - `format-report.sh` - Formats analytics reports (JSON/CSV)
3. **Stop** - `archive-report.sh` - Archives reports with timestamps

**WordPress Integration**: No

**Reports**: `.claude/reports/analytics-reporter/`

---

### test-results-analyzer

**Hooks**:
1. **SubagentStart** - `create-run-dir.sh` - Creates timestamped run directory
2. **PostToolUse** - `validate-report.sh` - Validates test report format
3. **Stop** - `archive-and-trend.sh` - Archives results and generates trends

**WordPress Integration**: No

**Reports**: `.claude/reports/test-results-analyzer/`

## Hook Exit Codes

Hooks communicate their results through exit codes:

- **Exit 0**: Success/Warning - Operation proceeds, output shown as warnings
- **Exit 2**: Block - Critical issue, operation prevented, error shown to agent
- **Other**: Script failure - Treated as block

## Hook Types

### PreToolUse
Runs **before** a tool is used. Perfect for validation and safety checks.

### PostToolUse
Runs **after** a tool completes. Perfect for cleanup, formatting, and saving results.

### SubagentStart
Runs when an agent **starts**. Perfect for environment setup and prerequisite checks.

### Stop
Runs when an agent **completes**. Perfect for reporting, archiving, and cleanup.

## Report Structure

All hooks save reports to `.claude/reports/{agent-name}/`:

```
.claude/reports/
├── api-tester/
│   ├── test_20260118_193000/
│   └── summary.md
├── test-writer-fixer/
│   ├── coverage_20260118_193000/
│   └── index.md
├── performance-benchmarker/
│   ├── benchmark_20260118_193000/
│   └── comparison.md
└── ... (other agents)
```

## Customizing Hooks

### Modify Existing Hooks

Edit scripts in `./scripts/{agent-name}/` as needed.

### Add New Hooks

1. Create script in `./scripts/{agent-name}/`
2. Make executable: `chmod +x ./scripts/{agent-name}/your-script.sh`
3. Update agent frontmatter in `.claude/agents/{agent-name}.md`

Example frontmatter:
```yaml
hooks:
  PreToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "./scripts/{agent-name}/your-script.sh"
```

## Debugging Hooks

If a hook fails or blocks unexpectedly:

1. **Check hook output**: Hooks write to stderr, visible in agent output
2. **Run manually**: `./scripts/{agent-name}/script-name.sh`
3. **Check permissions**: Ensure `chmod +x` on all scripts
4. **Test exit codes**: `echo $?` after running script

## WordPress Setup

For WordPress hooks to work:

1. **Install PHPCS**:
   ```bash
   ./scripts/wordpress/setup-phpcs.sh
   ```

2. **Verify installation**:
   ```bash
   ./vendor/bin/phpcs -i
   ```

   Should show: `WordPress, WordPress-Core, WordPress-Docs, etc.`

## Common Issues

### "PHPCS not installed"
- Run: `./scripts/wordpress/setup-phpcs.sh`
- Requires: Composer and PHP

### "Permission denied"
- Run: `chmod +x scripts/**/*.sh`

### "Hook blocks valid code"
- Check hook output for specific issue
- Hooks only block **critical** security issues
- Coding standards and performance are **warnings only**

## Benefits

✅ **Automatic validation** - No manual checks needed
✅ **Safety** - Blocks critical security issues
✅ **Quality** - Enforces coding standards
✅ **Automation** - Auto-saves reports and benchmarks
✅ **Visibility** - All reports in one place
✅ **WordPress-specific** - Tailored for WordPress development

## Examples

### Security Hook Blocking Unsafe Code

```php
// This will be BLOCKED by security-scan.sh
$result = $wpdb->query("DELETE FROM $wpdb->posts WHERE id = " . $_GET['id']);
```

**Hook Output**:
```
🚨 CRITICAL SECURITY ISSUES DETECTED in functions.php:
  ❌ SQL injection risk: Unescaped $wpdb->query() detected. Use $wpdb->prepare()

Fix these security vulnerabilities before proceeding.
```

### Performance Hook Warning

```php
// This will trigger WARNING from check-performance.sh
$posts = get_posts(['numberposts' => -1]);
```

**Hook Output**:
```
⚡ WordPress Performance Suggestions for: functions.php
  ⚠️  Consider caching get_posts() results using transients or object cache
```

### Test Coverage Auto-Saved

After running tests with coverage:

**Hook Output**:
```
✅ Coverage saved to .claude/reports/test-writer-fixer/coverage_20260118_193000/
   Files saved: coverage/ coverage.xml
```

## Contributing

When adding new hooks:

1. Follow existing patterns
2. Use clear, actionable error messages
3. Exit 0 for warnings, exit 2 for blocks
4. Save reports to `.claude/reports/{agent-name}/`
5. Update this README

---

## Cross-Browser Testing Scripts

### `setup-playwright.sh`
- **Purpose**: One-time setup — installs Playwright and Chromium, Firefox, WebKit browser engines
- **Run**: `./scripts/setup-playwright.sh`
- **Requirements**: Node.js 20+

### `cross-browser-test.sh`
- **Purpose**: Captures screenshots at 4 breakpoints (1920, 1440, 768, 375px) for a given browser engine
- **Usage**: `./scripts/cross-browser-test.sh <browser> <url>`
- **Browsers**: `chromium`, `firefox`, `webkit`
- **Output**: `.claude/visual-qa/screenshots/wordpress/<browser>/`

### `validate-theme.sh`
- **Purpose**: Unified theme validation orchestrator — runs all 8 checks in sequence
- **Usage**: `./scripts/validate-theme.sh <theme-name> [--strict] [--report]`

### `deploy.sh`
- **Purpose**: Deploy themes/plugins from root-level directories to wp-content/
- **Usage**: `./scripts/deploy.sh [theme <name>|plugin <name>] [--validate] [--target <path>]`

### `install-git-hooks.sh`
- **Purpose**: Installs pre-commit hook for security/standards validation
- **Run once**: `./scripts/install-git-hooks.sh`

---

**Generated**: 2026-01-18 | **Updated**: 2026-03-09
**Agents with hooks**: 7
**Total scripts**: 40
**WordPress validation scripts**: 4
