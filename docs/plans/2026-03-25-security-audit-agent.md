# Security Audit Agent with Dependency Scanning — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a security audit agent that scans npm and Composer dependencies for known vulnerabilities, generates severity-rated reports, and auto-creates GitHub issues for critical findings.

**Architecture:** A new `security-audit-agent` with two supporting scripts: `scan-dependencies.sh` (runs `composer audit` and `npm audit`, checks WordPress plugin/theme dependency manifests) and `generate-report.sh` (aggregates findings into a structured Markdown report with severity ratings). The agent ties into the existing `security-scan.sh` for PHP code scanning and extends coverage to dependency-level vulnerabilities. Critical findings trigger `gh issue create` automatically.

**Tech Stack:** Bash scripts, Composer CLI (`composer audit`), npm/pnpm CLI (`npm audit`/`pnpm audit`), GitHub CLI (`gh`), jq for JSON parsing.

---

## Task 1: Create dependency scanning script

**Files:**
- Create: `scripts/security-audit/scan-dependencies.sh`

**Step 1: Create the scripts directory**

```bash
mkdir -p scripts/security-audit
```

**Step 2: Write the dependency scanning script**

Create `scripts/security-audit/scan-dependencies.sh`:

```bash
#!/bin/bash
# Dependency Vulnerability Scanner
# Scans Composer and npm/pnpm dependencies for known vulnerabilities
# Outputs JSON results to stdout for downstream processing
#
# Usage: ./scripts/security-audit/scan-dependencies.sh [--path <dir>] [--format json|text]
# Exit codes: 0 = no vulnerabilities, 1 = vulnerabilities found, 2 = scanner error

set -euo pipefail

SCAN_PATH="${1:-.}"
FORMAT="${2:-json}"
RESULTS=()
HAS_CRITICAL=false
HAS_HIGH=false
EXIT_CODE=0

# Colors for text output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ── Composer Audit ──────────────────────────────────────────────
scan_composer() {
    local dir="$1"
    local composer_lock="$dir/composer.lock"
    local composer_json="$dir/composer.json"

    if [[ ! -f "$composer_json" ]]; then
        return 0
    fi

    log_info "Scanning Composer dependencies in $dir..."

    if ! command -v composer &> /dev/null; then
        log_warn "Composer not found — skipping PHP dependency scan"
        echo '{"scanner":"composer","status":"skipped","reason":"composer not installed","vulnerabilities":[]}'
        return 0
    fi

    if [[ ! -f "$composer_lock" ]]; then
        log_warn "No composer.lock found — running composer install first"
        (cd "$dir" && composer install --no-interaction --quiet 2>/dev/null) || true
    fi

    local audit_output
    local audit_exit=0
    audit_output=$(cd "$dir" && composer audit --format=json 2>/dev/null) || audit_exit=$?

    if [[ $audit_exit -eq 0 ]]; then
        log_info "Composer: No known vulnerabilities found"
        echo '{"scanner":"composer","status":"clean","vulnerabilities":[]}'
    else
        local vuln_count
        vuln_count=$(echo "$audit_output" | jq '.advisories | to_entries | map(.value | length) | add // 0' 2>/dev/null || echo "0")
        log_warn "Composer: Found $vuln_count vulnerability advisory/ies"

        # Parse advisories into normalized format
        echo "$audit_output" | jq '{
            scanner: "composer",
            status: "vulnerable",
            vulnerabilities: [
                .advisories | to_entries[] | .key as $pkg |
                .value[] | {
                    package: $pkg,
                    severity: (.severity // "unknown"),
                    title: .advisoryId,
                    description: .title,
                    cve: (.cve // "N/A"),
                    affected_versions: .affectedVersions,
                    reported_at: (.reportedAt // "unknown"),
                    link: (.link // ""),
                    source: "composer-audit"
                }
            ]
        }' 2>/dev/null || echo "{\"scanner\":\"composer\",\"status\":\"error\",\"vulnerabilities\":[]}"
        EXIT_CODE=1
    fi
}

# ── npm/pnpm Audit ──────────────────────────────────────────────
scan_npm() {
    local dir="$1"
    local package_json="$dir/package.json"

    if [[ ! -f "$package_json" ]]; then
        return 0
    fi

    log_info "Scanning npm dependencies in $dir..."

    # Prefer pnpm (per project conventions), fall back to npm
    local pkg_manager=""
    if command -v pnpm &> /dev/null && [[ -f "$dir/pnpm-lock.yaml" ]]; then
        pkg_manager="pnpm"
    elif command -v npm &> /dev/null; then
        pkg_manager="npm"
    else
        log_warn "Neither pnpm nor npm found — skipping JS dependency scan"
        echo '{"scanner":"npm","status":"skipped","reason":"no package manager found","vulnerabilities":[]}'
        return 0
    fi

    local audit_output
    local audit_exit=0

    if [[ "$pkg_manager" == "pnpm" ]]; then
        audit_output=$(cd "$dir" && pnpm audit --json 2>/dev/null) || audit_exit=$?
    else
        audit_output=$(cd "$dir" && npm audit --json 2>/dev/null) || audit_exit=$?
    fi

    if [[ $audit_exit -eq 0 ]]; then
        log_info "$pkg_manager: No known vulnerabilities found"
        echo "{\"scanner\":\"$pkg_manager\",\"status\":\"clean\",\"vulnerabilities\":[]}"
    else
        # npm audit --json returns vulnerabilities keyed by package name
        local vuln_count
        vuln_count=$(echo "$audit_output" | jq '.vulnerabilities | length // 0' 2>/dev/null || echo "0")
        log_warn "$pkg_manager: Found $vuln_count vulnerable package(s)"

        echo "$audit_output" | jq --arg mgr "$pkg_manager" '{
            scanner: $mgr,
            status: "vulnerable",
            vulnerabilities: [
                .vulnerabilities | to_entries[] | {
                    package: .key,
                    severity: .value.severity,
                    title: .value.name,
                    description: (.value.via[0] | if type == "object" then .title else . end),
                    cve: (.value.via[0] | if type == "object" then (.cve // "N/A") else "N/A" end),
                    affected_versions: .value.range,
                    fix_available: (.value.fixAvailable | if type == "boolean" then . else true end),
                    source: ($mgr + "-audit")
                }
            ]
        }' 2>/dev/null || echo "{\"scanner\":\"$pkg_manager\",\"status\":\"error\",\"vulnerabilities\":[]}"
        EXIT_CODE=1
    fi
}

# ── WordPress Plugin/Theme Dependency Check ─────────────────────
scan_wp_dependencies() {
    local dir="$1"

    # Scan themes/ and plugins/ directories for their own dependency files
    for subdir in "$dir/themes" "$dir/plugins"; do
        if [[ ! -d "$subdir" ]]; then
            continue
        fi

        for project_dir in "$subdir"/*/; do
            [[ -d "$project_dir" ]] || continue
            local project_name
            project_name=$(basename "$project_dir")

            # Check for composer.json in each theme/plugin
            if [[ -f "$project_dir/composer.json" ]]; then
                log_info "Scanning $project_name Composer dependencies..."
                scan_composer "$project_dir"
            fi

            # Check for package.json in each theme/plugin
            if [[ -f "$project_dir/package.json" ]]; then
                log_info "Scanning $project_name npm dependencies..."
                scan_npm "$project_dir"
            fi
        done
    done
}

# ── Main ────────────────────────────────────────────────────────
main() {
    log_info "=== Dependency Vulnerability Scan ==="
    log_info "Scanning: $SCAN_PATH"
    log_info "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo ""

    # Collect all results into a JSON array
    echo '{"scan_date":"'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'","scan_path":"'"$SCAN_PATH"'","results":['

    local first=true

    # Scan root-level dependencies
    for scanner in scan_composer scan_npm; do
        result=$($scanner "$SCAN_PATH" 2>/dev/null) || true
        if [[ -n "$result" ]]; then
            if [[ "$first" == "true" ]]; then
                first=false
            else
                echo ","
            fi
            echo "$result"
        fi
    done

    # Scan WordPress theme/plugin dependencies
    for subdir in "$SCAN_PATH/themes" "$SCAN_PATH/plugins"; do
        if [[ ! -d "$subdir" ]]; then
            continue
        fi
        for project_dir in "$subdir"/*/; do
            [[ -d "$project_dir" ]] || continue
            for scanner in scan_composer scan_npm; do
                result=$($scanner "$project_dir" 2>/dev/null) || true
                if [[ -n "$result" ]]; then
                    if [[ "$first" == "true" ]]; then
                        first=false
                    else
                        echo ","
                    fi
                    echo "$result"
                fi
            done
        done
    done

    echo ']}'

    exit $EXIT_CODE
}

main "$@"
```

**Step 3: Make executable**

```bash
chmod +x scripts/security-audit/scan-dependencies.sh
```

**Step 4: Verify script runs without errors on current project**

```bash
./scripts/security-audit/scan-dependencies.sh . 2>&1 | head -20
```

Expected: JSON output with composer scan results (at minimum), no bash errors.

**Step 5: Commit**

```bash
git add scripts/security-audit/scan-dependencies.sh
git commit -m "feat: add dependency vulnerability scanning script

Scans Composer and npm/pnpm dependencies for known CVEs.
Supports root-level and per-theme/plugin scanning.
Outputs normalized JSON for report generation."
```

---

## Task 2: Create security report generator

**Files:**
- Create: `scripts/security-audit/generate-report.sh`

**Step 1: Write the report generator**

Create `scripts/security-audit/generate-report.sh`:

```bash
#!/bin/bash
# Security Report Generator
# Takes JSON scan output from scan-dependencies.sh and generates Markdown report
#
# Usage: ./scripts/security-audit/scan-dependencies.sh . | ./scripts/security-audit/generate-report.sh
# Or:    ./scripts/security-audit/generate-report.sh < scan-results.json
#
# Output: Markdown report to stdout, saved to .claude/security-reports/

set -euo pipefail

REPORT_DIR=".claude/security-reports"
mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE_SLUG=$(date -u +"%Y-%m-%d")
REPORT_FILE="$REPORT_DIR/security-report-$DATE_SLUG.md"

# Read JSON from stdin
INPUT=$(cat)

# Count vulnerabilities by severity
count_severity() {
    local severity="$1"
    echo "$INPUT" | jq -r "[.results[].vulnerabilities[] | select(.severity == \"$severity\")] | length" 2>/dev/null || echo "0"
}

CRITICAL=$(count_severity "critical")
HIGH=$(count_severity "high")
MEDIUM=$(count_severity "medium")
LOW=$(count_severity "low")
TOTAL=$((CRITICAL + HIGH + MEDIUM + LOW))

# Count by unknown/other severity
UNKNOWN=$(echo "$INPUT" | jq -r '[.results[].vulnerabilities[] | select(.severity != "critical" and .severity != "high" and .severity != "medium" and .severity != "low")] | length' 2>/dev/null || echo "0")
TOTAL=$((TOTAL + UNKNOWN))

# Determine overall status
if [[ $CRITICAL -gt 0 ]]; then
    STATUS="CRITICAL"
    STATUS_ICON="🔴"
elif [[ $HIGH -gt 0 ]]; then
    STATUS="HIGH RISK"
    STATUS_ICON="🟠"
elif [[ $MEDIUM -gt 0 ]]; then
    STATUS="MODERATE"
    STATUS_ICON="🟡"
elif [[ $LOW -gt 0 ]]; then
    STATUS="LOW RISK"
    STATUS_ICON="🟢"
else
    STATUS="CLEAN"
    STATUS_ICON="✅"
fi

# Generate report
cat > "$REPORT_FILE" <<REPORT_HEADER
# Security Audit Report

**Generated:** $TIMESTAMP
**Status:** $STATUS_ICON $STATUS
**Total Vulnerabilities:** $TOTAL

## Summary

| Severity | Count |
|----------|-------|
| Critical | $CRITICAL |
| High     | $HIGH |
| Medium   | $MEDIUM |
| Low      | $LOW |
| Other    | $UNKNOWN |

REPORT_HEADER

# Scanner results summary
echo "## Scanner Results" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "$INPUT" | jq -r '.results[] | "- **\(.scanner)**: \(.status)"' >> "$REPORT_FILE" 2>/dev/null || true
echo "" >> "$REPORT_FILE"

# Critical vulnerabilities section
if [[ $CRITICAL -gt 0 ]]; then
    echo "## Critical Vulnerabilities (Action Required)" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "These vulnerabilities require immediate remediation:" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    echo "$INPUT" | jq -r '
        .results[].vulnerabilities[] | select(.severity == "critical") |
        "### \(.package)\n\n" +
        "- **CVE:** \(.cve)\n" +
        "- **Description:** \(.description)\n" +
        "- **Affected Versions:** \(.affected_versions)\n" +
        "- **Source:** \(.source)\n" +
        (if .link != "" and .link != null then "- **Advisory:** \(.link)\n" else "" end) +
        (if .fix_available == true then "- **Fix Available:** Yes — run `composer update \(.package)` or `pnpm update \(.package)`\n" else "" end) +
        "\n**Remediation:** Update to a patched version immediately. If no patch exists, evaluate whether the dependency can be replaced.\n"
    ' >> "$REPORT_FILE" 2>/dev/null || true
    echo "" >> "$REPORT_FILE"
fi

# High vulnerabilities section
if [[ $HIGH -gt 0 ]]; then
    echo "## High Severity Vulnerabilities" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    echo "$INPUT" | jq -r '
        .results[].vulnerabilities[] | select(.severity == "high") |
        "### \(.package)\n\n" +
        "- **CVE:** \(.cve)\n" +
        "- **Description:** \(.description)\n" +
        "- **Affected Versions:** \(.affected_versions)\n" +
        "- **Source:** \(.source)\n" +
        (if .link != "" and .link != null then "- **Advisory:** \(.link)\n" else "" end) +
        "\n**Remediation:** Schedule update within current sprint.\n"
    ' >> "$REPORT_FILE" 2>/dev/null || true
    echo "" >> "$REPORT_FILE"
fi

# Medium/Low vulnerabilities (table format for brevity)
if [[ $((MEDIUM + LOW + UNKNOWN)) -gt 0 ]]; then
    echo "## Medium and Low Severity" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "| Package | Severity | CVE | Description |" >> "$REPORT_FILE"
    echo "|---------|----------|-----|-------------|" >> "$REPORT_FILE"

    echo "$INPUT" | jq -r '
        .results[].vulnerabilities[] |
        select(.severity == "medium" or .severity == "low" or
               (.severity != "critical" and .severity != "high" and .severity != "medium" and .severity != "low")) |
        "| \(.package) | \(.severity) | \(.cve) | \(.description) |"
    ' >> "$REPORT_FILE" 2>/dev/null || true
    echo "" >> "$REPORT_FILE"
fi

# Clean report
if [[ $TOTAL -eq 0 ]]; then
    echo "## No Vulnerabilities Found" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "All scanned dependencies are free of known vulnerabilities." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# Recommendations
echo "## Recommendations" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [[ $CRITICAL -gt 0 ]]; then
    echo "1. **Immediately** update packages with critical vulnerabilities" >> "$REPORT_FILE"
    echo "2. Run \`composer update\` and/or \`pnpm update\` to apply security patches" >> "$REPORT_FILE"
    echo "3. Re-run this scan after updates to confirm fixes" >> "$REPORT_FILE"
elif [[ $HIGH -gt 0 ]]; then
    echo "1. Schedule updates for high-severity packages this sprint" >> "$REPORT_FILE"
    echo "2. Review whether vulnerable code paths are actually used" >> "$REPORT_FILE"
    echo "3. Re-run this scan after updates" >> "$REPORT_FILE"
else
    echo "1. Continue regular dependency scanning (weekly recommended)" >> "$REPORT_FILE"
    echo "2. Keep \`composer.lock\` and lock files committed for reproducibility" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "*Report generated by security-audit-agent*" >> "$REPORT_FILE"

# Output report path
echo "$REPORT_FILE" >&2
echo "Report saved to: $REPORT_FILE" >&2

# Also output the report to stdout
cat "$REPORT_FILE"

# Exit with severity-based code
if [[ $CRITICAL -gt 0 ]]; then
    exit 2
elif [[ $HIGH -gt 0 ]]; then
    exit 1
else
    exit 0
fi
```

**Step 2: Make executable**

```bash
chmod +x scripts/security-audit/generate-report.sh
```

**Step 3: Test end-to-end pipeline**

```bash
./scripts/security-audit/scan-dependencies.sh . 2>/dev/null | ./scripts/security-audit/generate-report.sh
```

Expected: Markdown report printed to stdout, file saved to `.claude/security-reports/`.

**Step 4: Commit**

```bash
git add scripts/security-audit/generate-report.sh
git commit -m "feat: add security report generator with severity ratings

Parses scan-dependencies.sh JSON output into structured Markdown.
Sections grouped by severity: critical, high, medium/low.
Includes remediation steps per vulnerability."
```

---

## Task 3: Create GitHub issue auto-creation script

**Files:**
- Create: `scripts/security-audit/create-issues.sh`

**Step 1: Write the issue creation script**

Create `scripts/security-audit/create-issues.sh`:

```bash
#!/bin/bash
# Auto-create GitHub issues for critical/high vulnerabilities
# Reads JSON scan output from stdin
#
# Usage: ./scripts/security-audit/scan-dependencies.sh . | ./scripts/security-audit/create-issues.sh
# Requires: gh CLI authenticated

set -euo pipefail

if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) not installed" >&2
    exit 1
fi

if ! gh auth status &> /dev/null 2>&1; then
    echo "Error: GitHub CLI not authenticated. Run 'gh auth login' first." >&2
    exit 1
fi

INPUT=$(cat)
CREATED=0
SKIPPED=0

# Get existing security issues to avoid duplicates
EXISTING_ISSUES=$(gh issue list --label "security" --state open --json title --jq '.[].title' 2>/dev/null || echo "")

# Process critical and high vulnerabilities
echo "$INPUT" | jq -c '.results[].vulnerabilities[] | select(.severity == "critical" or .severity == "high")' 2>/dev/null | while read -r vuln; do
    PACKAGE=$(echo "$vuln" | jq -r '.package')
    SEVERITY=$(echo "$vuln" | jq -r '.severity')
    CVE=$(echo "$vuln" | jq -r '.cve')
    DESCRIPTION=$(echo "$vuln" | jq -r '.description')
    AFFECTED=$(echo "$vuln" | jq -r '.affected_versions')
    SOURCE=$(echo "$vuln" | jq -r '.source')
    LINK=$(echo "$vuln" | jq -r '.link // ""')

    SEVERITY_UPPER=$(echo "$SEVERITY" | tr '[:lower:]' '[:upper:]')
    ISSUE_TITLE="[Security] $SEVERITY_UPPER: $PACKAGE — $CVE"

    # Skip if issue already exists
    if echo "$EXISTING_ISSUES" | grep -qF "$PACKAGE" && echo "$EXISTING_ISSUES" | grep -qF "$CVE"; then
        echo "Skipping (exists): $ISSUE_TITLE" >&2
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    BODY=$(cat <<EOF
## Security Vulnerability: $PACKAGE

**Severity:** $SEVERITY_UPPER
**CVE:** $CVE
**Affected Versions:** $AFFECTED
**Detected by:** $SOURCE
**Scan Date:** $(date -u +"%Y-%m-%d")

### Description

$DESCRIPTION

$(if [[ -n "$LINK" && "$LINK" != "null" ]]; then echo "### Advisory"; echo ""; echo "$LINK"; fi)

### Remediation

1. Update \`$PACKAGE\` to the latest patched version
2. Run \`composer update $PACKAGE\` or \`pnpm update $PACKAGE\`
3. Re-run dependency scan to confirm the fix
4. If no patch exists, evaluate replacing the dependency

### Acceptance Criteria

- [ ] Vulnerability patched or dependency replaced
- [ ] Dependency scan passes clean
- [ ] No regressions introduced

---
*Auto-created by security-audit-agent*
EOF
)

    # Create the issue with security label
    LABELS="security,$SEVERITY"
    gh issue create \
        --title "$ISSUE_TITLE" \
        --body "$BODY" \
        --label "$LABELS" 2>/dev/null && {
        echo "Created: $ISSUE_TITLE" >&2
        CREATED=$((CREATED + 1))
    } || {
        echo "Failed to create: $ISSUE_TITLE" >&2
    }

done

echo "" >&2
echo "Issues created: $CREATED" >&2
echo "Issues skipped (duplicates): $SKIPPED" >&2
```

**Step 2: Make executable**

```bash
chmod +x scripts/security-audit/create-issues.sh
```

**Step 3: Verify script parses correctly (dry run — don't actually create issues yet)**

```bash
echo '{"results":[{"scanner":"test","vulnerabilities":[]}]}' | ./scripts/security-audit/create-issues.sh
```

Expected: "Issues created: 0" (no vulnerabilities in test input).

**Step 4: Commit**

```bash
git add scripts/security-audit/create-issues.sh
git commit -m "feat: add auto GitHub issue creation for critical vulnerabilities

Creates labeled issues for critical/high severity findings.
Skips duplicates by checking existing open security issues.
Requires gh CLI authentication."
```

---

## Task 4: Create the security audit agent definition

**Files:**
- Create: `.claude/agents/security-audit-agent.md`

**Step 1: Write the agent definition**

Create `.claude/agents/security-audit-agent.md`:

```markdown
---
name: security-audit-agent
description: Security audit agent with automated dependency vulnerability scanning. Runs Composer audit, npm/pnpm audit, WordPress dependency checks, and PHP code security scanning. Generates severity-rated reports and auto-creates GitHub issues for critical findings. Use when performing security audits, dependency scanning, vulnerability assessment, or pre-release security checks.
tools: Read, Write, Bash, Grep, Glob, TodoWrite, TaskOutput, AskUserQuestion
model: opus
permissionMode: bypassPermissions
---

You are a WordPress security audit specialist focused on dependency vulnerability scanning and code security analysis. You perform comprehensive security audits covering both dependency-level and code-level vulnerabilities.

## Primary Responsibilities

### 1. Dependency Vulnerability Scanning

Run automated dependency scans across the entire project:

```bash
# Full dependency scan (root + themes + plugins)
./scripts/security-audit/scan-dependencies.sh .
```

**What gets scanned:**
- Root `composer.json` / `composer.lock` (PHP dependencies)
- Root `package.json` / `pnpm-lock.yaml` (JS dependencies)
- Per-theme dependencies: `themes/*/composer.json`, `themes/*/package.json`
- Per-plugin dependencies: `plugins/*/composer.json`, `plugins/*/package.json`

**Scanners used:**
- `composer audit` — PHP package CVE database
- `pnpm audit` / `npm audit` — Node.js advisory database

### 2. Security Report Generation

Generate structured Markdown reports with severity ratings:

```bash
# Scan and generate report
./scripts/security-audit/scan-dependencies.sh . 2>/dev/null | ./scripts/security-audit/generate-report.sh
```

**Report includes:**
- Summary table with vulnerability counts by severity
- Critical vulnerabilities with full details and remediation steps
- High severity vulnerabilities with update timeline
- Medium/low in compact table format
- Actionable recommendations

**Report saved to:** `.claude/security-reports/security-report-YYYY-MM-DD.md`

### 3. GitHub Issue Auto-Creation

For critical and high severity findings, auto-create GitHub issues:

```bash
# Scan and create issues for critical/high findings
./scripts/security-audit/scan-dependencies.sh . 2>/dev/null | ./scripts/security-audit/create-issues.sh
```

**Issue features:**
- Labeled with `security` + severity level
- Includes CVE, affected versions, remediation steps
- Skips duplicates (checks existing open security issues)
- Acceptance criteria checklist

### 4. PHP Code Security Scanning

Run the existing WordPress security scanner on all PHP files:

```bash
# Scan specific paths
./scripts/wordpress/security-scan.sh themes/
./scripts/wordpress/security-scan.sh plugins/
```

**Checks for:**
- SQL injection (unescaped `$wpdb` queries)
- XSS (unescaped user input output)
- Missing nonce validation on form handlers
- Unsafe file operations with user input
- `eval()`, `unserialize()` with user input
- Command injection via `exec`/`system`/`shell_exec`
- Missing capability checks on privileged operations

### 5. WordPress Coding Standards Security Rules

```bash
./scripts/wordpress/check-coding-standards.sh themes/
./scripts/wordpress/check-coding-standards.sh plugins/
```

## Full Audit Workflow

When asked to perform a complete security audit:

```
1. Run dependency vulnerability scan
   → ./scripts/security-audit/scan-dependencies.sh .
   → Capture JSON output

2. Generate security report
   → Pipe scan output to generate-report.sh
   → Review severity ratings

3. Run PHP code security scan
   → Scan all themes/ and plugins/ PHP files
   → Check for OWASP Top 10 patterns

4. Run WordPress coding standards check
   → PHPCS with WordPress security sniffs
   → Flag any violations

5. Aggregate findings
   → Combine dependency + code scan results
   → Prioritize by severity

6. Auto-create GitHub issues for critical/high findings
   → Only for dependency vulnerabilities with CVEs
   → Skip duplicates

7. Generate final report
   → Save to .claude/security-reports/
   → Present summary to user
```

## Severity Classification

| Level    | Criteria                                              | Action Required        |
|----------|-------------------------------------------------------|------------------------|
| Critical | Known exploited CVE, RCE, auth bypass, SQL injection  | Immediate fix required |
| High     | Exploitable CVE, data exposure, privilege escalation   | Fix within current sprint |
| Medium   | Requires specific conditions to exploit                | Fix in next release    |
| Low      | Theoretical risk, minimal impact                       | Track and monitor      |

## Report Format

Reports follow the structure in `.claude/security-reports/`:

```markdown
# Security Audit Report
**Generated:** 2026-03-25T10:00:00Z
**Status:** 🔴 CRITICAL / 🟠 HIGH RISK / 🟡 MODERATE / 🟢 LOW RISK / ✅ CLEAN

## Summary
| Severity | Count |
|----------|-------|
| Critical | N     |
| High     | N     |
| Medium   | N     |
| Low      | N     |

## Critical Vulnerabilities (Action Required)
### package-name
- CVE, description, affected versions, remediation

## High Severity Vulnerabilities
...

## Medium and Low Severity
| Package | Severity | CVE | Description |
...

## Recommendations
...
```

## Integration

**Invoked by:**
- Manual invocation for security audits
- Pre-release security checks
- CI/CD pipeline (GitHub Actions)

**Works with:**
- `security-scan.sh` — Existing PHP code security scanner
- `check-coding-standards.sh` — WordPress PHPCS security rules
- `test-writer-fixer` agent — Writing security-focused tests
- `legal-compliance-checker` agent — Regulatory compliance review

## Rules

- ALWAYS scan both Composer AND npm/pnpm dependencies
- ALWAYS check themes/ and plugins/ subdirectories, not just root
- NEVER ignore critical vulnerabilities — they must be reported
- NEVER auto-fix dependencies without user confirmation (updates can break things)
- GitHub issues are only created for critical and high severity findings
- Duplicate issues are never created (check existing open issues first)
- Reports are saved with date stamps — never overwrite previous reports
- Use root-level paths (themes/, plugins/) not wp-content/ paths
```

**Step 2: Commit**

```bash
git add .claude/agents/security-audit-agent.md
git commit -m "feat: add security audit agent with dependency scanning

Integrates Composer audit, npm/pnpm audit, PHP code scanning.
Generates severity-rated Markdown reports.
Auto-creates GitHub issues for critical/high vulnerabilities."
```

---

## Task 5: Add GitHub labels for security issues

**Files:**
- None (CLI commands only)

**Step 1: Create security-related labels if they don't exist**

```bash
gh label create "security" --description "Security vulnerability" --color "B60205" --force
gh label create "critical" --description "Critical severity" --color "D93F0B" --force
gh label create "high" --description "High severity" --color "E99695" --force
```

**Step 2: Verify labels exist**

```bash
gh label list | grep -E "security|critical|high"
```

Expected: Three labels listed.

**Step 3: Commit (no files changed — labels are on GitHub)**

No commit needed.

---

## Task 6: Add security report directory to .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Check current .gitignore**

```bash
cat .gitignore | grep -i security || echo "No security entries"
```

**Step 2: Add security reports directory**

Append to `.gitignore`:

```
# Security reports (contain vulnerability details — do not commit)
.claude/security-reports/
```

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: exclude security reports from version control

Reports contain vulnerability details that should not be public."
```

---

## Task 7: Update CUSTOM-AGENTS-GUIDE.md

**Files:**
- Modify: `.claude/CUSTOM-AGENTS-GUIDE.md`

**Step 1: Read current file to find insertion point**

Find the "WordPress FSE Development - Highly Relevant" section.

**Step 2: Add security-audit-agent entry**

Add after the existing WordPress-focused agents section:

```markdown
### **security-audit-agent** (NEW)
- **Purpose:** Automated dependency vulnerability scanning and security auditing
- **Use for:** Running Composer/npm audits, generating security reports, auto-creating issues for critical CVEs, pre-release security checks
- **WordPress relevance:** Critical - dependency vulnerabilities are a top WordPress attack vector
```

**Step 3: Update the total agent count from 45 to 46**

Update the header line and any count references.

**Step 4: Commit**

```bash
git add .claude/CUSTOM-AGENTS-GUIDE.md
git commit -m "docs: add security-audit-agent to agents guide"
```

---

## Task 8: Update CLAUDE.md references

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Read CLAUDE.md and find the agent count and security script references**

**Step 2: Update agent count from 45/46 to include the new agent**

Find `46 specialized agents` or similar count and increment by 1.

**Step 3: Add security audit to the Code Quality Workflow section**

In the "Code Quality Workflow" section, add:

```bash
# Dependency vulnerability scan
./scripts/security-audit/scan-dependencies.sh .

# Generate security report
./scripts/security-audit/scan-dependencies.sh . 2>/dev/null | ./scripts/security-audit/generate-report.sh

# Auto-create issues for critical findings
./scripts/security-audit/scan-dependencies.sh . 2>/dev/null | ./scripts/security-audit/create-issues.sh
```

**Step 4: Add to Quick Command Reference**

```bash
# Security Audit
./scripts/security-audit/scan-dependencies.sh [path]   # Scan dependencies for CVEs
./scripts/security-audit/generate-report.sh             # Generate vulnerability report
./scripts/security-audit/create-issues.sh               # Create GitHub issues for critical findings
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add security audit commands and update agent count in CLAUDE.md"
```

---

## Task 9: Add CI workflow for dependency scanning

**Files:**
- Create: `.github/workflows/security-audit.yml`

**Step 1: Write the GitHub Actions workflow**

Create `.github/workflows/security-audit.yml`:

```yaml
name: Security Audit

on:
  push:
    branches: [main]
    paths:
      - 'composer.json'
      - 'composer.lock'
      - 'themes/**/composer.json'
      - 'themes/**/composer.lock'
      - 'themes/**/package.json'
      - 'plugins/**/composer.json'
      - 'plugins/**/composer.lock'
      - 'plugins/**/package.json'
  pull_request:
    branches: [main]
  schedule:
    # Weekly scan every Monday at 9am UTC
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  dependency-scan:
    name: Dependency Vulnerability Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          tools: composer:v2

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install Composer dependencies
        run: composer install --no-interaction --prefer-dist --quiet
        continue-on-error: true

      - name: Run dependency scan
        id: scan
        run: |
          chmod +x scripts/security-audit/scan-dependencies.sh
          chmod +x scripts/security-audit/generate-report.sh
          SCAN_OUTPUT=$(./scripts/security-audit/scan-dependencies.sh . 2>/dev/null) || true
          echo "$SCAN_OUTPUT" | ./scripts/security-audit/generate-report.sh > /dev/null 2>&1 || true
          # Set output for downstream steps
          CRITICAL=$(echo "$SCAN_OUTPUT" | jq '[.results[].vulnerabilities[] | select(.severity == "critical")] | length' 2>/dev/null || echo "0")
          HIGH=$(echo "$SCAN_OUTPUT" | jq '[.results[].vulnerabilities[] | select(.severity == "high")] | length' 2>/dev/null || echo "0")
          echo "critical=$CRITICAL" >> $GITHUB_OUTPUT
          echo "high=$HIGH" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Upload security report
        uses: actions/upload-artifact@v4
        with:
          name: security-report
          path: .claude/security-reports/
          retention-days: 90
        if: always()

      - name: Fail on critical vulnerabilities
        if: steps.scan.outputs.critical != '0'
        run: |
          echo "::error::${{ steps.scan.outputs.critical }} critical vulnerability(ies) found. See security report artifact."
          exit 1
```

**Step 2: Commit**

```bash
git add .github/workflows/security-audit.yml
git commit -m "ci: add dependency vulnerability scanning workflow

Runs on dependency file changes, weekly schedule, and manual trigger.
Fails CI on critical vulnerabilities. Uploads report as artifact."
```

---

## Task 10: End-to-end verification

**Step 1: Run full scan pipeline locally**

```bash
./scripts/security-audit/scan-dependencies.sh . 2>/dev/null | tee /tmp/scan-output.json | ./scripts/security-audit/generate-report.sh
```

**Step 2: Verify report was generated**

```bash
ls -la .claude/security-reports/
cat .claude/security-reports/security-report-$(date -u +"%Y-%m-%d").md
```

Expected: Report file exists with proper Markdown structure.

**Step 3: Verify agent file is valid**

```bash
head -10 .claude/agents/security-audit-agent.md
```

Expected: Valid YAML frontmatter with name, description, tools, model.

**Step 4: Verify .gitignore excludes reports**

```bash
git status .claude/security-reports/
```

Expected: Security reports are not tracked.

**Step 5: Run the existing security scan to confirm no regressions**

```bash
./scripts/wordpress/security-scan.sh
```

Expected: Exits cleanly (no PHP files to scan at root is fine).

---

## Deliverables Summary

| # | File | Purpose |
|---|------|---------|
| 1 | `scripts/security-audit/scan-dependencies.sh` | Scans Composer + npm dependencies for CVEs |
| 2 | `scripts/security-audit/generate-report.sh` | Generates Markdown report with severity ratings |
| 3 | `scripts/security-audit/create-issues.sh` | Auto-creates GitHub issues for critical/high vulns |
| 4 | `.claude/agents/security-audit-agent.md` | Agent definition with full workflow |
| 5 | `.github/workflows/security-audit.yml` | CI workflow for automated scanning |
| 6 | `.gitignore` (modified) | Excludes security reports |
| 7 | `.claude/CUSTOM-AGENTS-GUIDE.md` (modified) | Documents new agent |
| 8 | `CLAUDE.md` (modified) | Adds security audit commands |

## Acceptance Criteria Mapping

| Requirement | Addressed By |
|------------|-------------|
| Security agent scans npm and Composer dependencies | Task 1 (`scan-dependencies.sh`) + Task 4 (agent) |
| Vulnerability report generated with severity ratings | Task 2 (`generate-report.sh`) |
| Critical vulnerabilities flagged with remediation steps | Task 2 (report) + Task 3 (issues) |
| Auto-create issues for critical vulnerabilities | Task 3 (`create-issues.sh`) |
