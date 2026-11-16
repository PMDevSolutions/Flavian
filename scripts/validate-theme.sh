#!/bin/bash
# Unified Theme Validation Orchestrator
# Runs ALL validation checks on a WordPress FSE theme in sequence
#
# Usage:
#   ./scripts/validate-theme.sh <theme-name>
#   ./scripts/validate-theme.sh <theme-name> --strict   (exit on first error)
#   ./scripts/validate-theme.sh <theme-name> --report   (save report to .claude/reports/)
#
# Checks run:
#   1. Required files (style.css, theme.json, templates/, parts/)
#   2. Security scan (all PHP files)
#   3. Coding standards (PHPCS)
#   4. Performance patterns
#   5. Block markup validation
#   6. Token compliance (no hardcoded values)
#   7. Pattern architecture (images in patterns, not templates)
#   8. Frontend standards (CSS/JS)

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THEME_NAME="$1"
STRICT=false
REPORT=false
REPORT_FILE=""

# Parse flags
shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --strict) STRICT=true; shift ;;
        --report) REPORT=true; shift ;;
        *) shift ;;
    esac
done

if [ -z "$THEME_NAME" ]; then
    echo "Usage: $0 <theme-name> [--strict] [--report]"
    echo ""
    echo "Available themes:"
    ls -d "$PROJECT_ROOT/themes"/*/ 2>/dev/null | xargs -I {} basename {} || echo "  (none)"
    exit 1
fi

THEME_DIR="$PROJECT_ROOT/themes/$THEME_NAME"

if [ ! -d "$THEME_DIR" ]; then
    echo "Theme not found: $THEME_DIR"
    exit 1
fi

PASS=0
WARN=0
FAIL=0

# Setup report
if [ "$REPORT" = true ]; then
    REPORT_DIR="$PROJECT_ROOT/.claude/reports/theme-validation"
    mkdir -p "$REPORT_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    REPORT_FILE="$REPORT_DIR/${THEME_NAME}_${TIMESTAMP}.md"
fi

# Output helper
log() {
    echo "$1"
    # An if, not `[ ... ] && echo`: under set -e that form returned 1 whenever --report was
    # off, which ended the whole script at the first log line.
    if [ "$REPORT" = true ]; then echo "$1" >> "$REPORT_FILE"; fi
}

check_pass() {
    PASS=$((PASS + 1))
    log "  PASS: $1"
}

check_warn() {
    WARN=$((WARN + 1))
    log "  WARN: $1"
}

check_fail() {
    FAIL=$((FAIL + 1))
    log "  FAIL: $1"
    if [ "$STRICT" = true ]; then
        log ""
        log "Stopping (--strict mode). Fix this issue before continuing."
        exit 2
    fi
}

# ─────────────────────────────────────────
log "============================================"
log "  Theme Validation: $THEME_NAME"
log "  $(date)"
log "============================================"
log ""

# ─────────────────────────────────────────
# 1. Required Files
# ─────────────────────────────────────────
log "--- 1. Required Files ---"

[ -f "$THEME_DIR/style.css" ] && check_pass "style.css exists" || check_fail "style.css missing"
[ -f "$THEME_DIR/theme.json" ] && check_pass "theme.json exists" || check_fail "theme.json missing (required for FSE)"
[ -d "$THEME_DIR/templates" ] && check_pass "templates/ directory exists" || check_fail "templates/ directory missing"
[ -d "$THEME_DIR/parts" ] && check_pass "parts/ directory exists" || check_warn "parts/ directory missing"
[ -f "$THEME_DIR/functions.php" ] && check_pass "functions.php exists" || check_warn "functions.php missing"

# Check for at least index.html template
[ -f "$THEME_DIR/templates/index.html" ] && check_pass "templates/index.html exists" || check_fail "templates/index.html missing (required)"

log ""

# ─────────────────────────────────────────
# 2. Security Scan
# ─────────────────────────────────────────
log "--- 2. Security Scan ---"

if [ -f "$PROJECT_ROOT/scripts/wordpress/security-scan.sh" ]; then
    SEC_ISSUES=0
    PHP_FILES=$(find "$THEME_DIR" -name "*.php" 2>/dev/null)
    if [ -n "$PHP_FILES" ]; then
        for f in $PHP_FILES; do
            EXIT_CODE=0
            RESULT=$(echo "{\"tool_input\":{\"file_path\":\"$f\"}}" | "$PROJECT_ROOT/scripts/wordpress/security-scan.sh" 2>&1) || EXIT_CODE=$?
            if [ $EXIT_CODE -eq 2 ]; then
                SEC_ISSUES=$((SEC_ISSUES + 1))
                check_fail "Security issue in $(basename "$f")"
            fi
        done
        [ $SEC_ISSUES -eq 0 ] && check_pass "All PHP files pass security scan"
    else
        check_warn "No PHP files to scan"
    fi
else
    check_warn "Security scan script not found"
fi

log ""

# ─────────────────────────────────────────
# 3. Coding Standards
# ─────────────────────────────────────────
log "--- 3. WordPress Coding Standards ---"

if [ -f "$PROJECT_ROOT/vendor/bin/phpcs" ]; then
    # The summary report prints nothing for a clean theme, so judge by phpcs's exit code.
    PHPCS_EXIT=0
    PHPCS_RESULT=$("$PROJECT_ROOT/vendor/bin/phpcs" --standard=WordPress --severity=5 --report=summary "$THEME_DIR" 2>&1) || PHPCS_EXIT=$?
    if [ "$PHPCS_EXIT" -eq 0 ]; then
        check_pass "PHPCS: No errors"
    else
        ERROR_COUNT=$(echo "$PHPCS_RESULT" | grep -oE '[0-9]+ ERRORS?' | head -1 | grep -oE '[0-9]+' || true)
        check_warn "PHPCS: ${ERROR_COUNT:-some} coding standard issue(s)"
    fi
else
    check_warn "PHPCS not installed (run: ./scripts/wordpress/setup-phpcs.sh)"
fi

log ""

# ─────────────────────────────────────────
# 4. Performance Patterns
# ─────────────────────────────────────────
log "--- 4. Performance Patterns ---"

if [ -f "$PROJECT_ROOT/scripts/wordpress/check-performance.sh" ]; then
    PERF_ISSUES=0
    PHP_FILES=$(find "$THEME_DIR" -name "*.php" 2>/dev/null)
    if [ -n "$PHP_FILES" ]; then
        for f in $PHP_FILES; do
            RESULT=$(echo "{\"tool_input\":{\"file_path\":\"$f\"}}" | "$PROJECT_ROOT/scripts/wordpress/check-performance.sh" 2>&1) || true
            if echo "$RESULT" | grep -qi "warning\|issue"; then
                PERF_ISSUES=$((PERF_ISSUES + 1))
            fi
        done
        [ $PERF_ISSUES -eq 0 ] && check_pass "No performance anti-patterns detected" || check_warn "$PERF_ISSUES file(s) with performance suggestions"
    fi
else
    check_warn "Performance check script not found"
fi

log ""

# ─────────────────────────────────────────
# 5. Block Markup Validation
# ─────────────────────────────────────────
log "--- 5. Block Markup ---"

if [ -f "$PROJECT_ROOT/scripts/block-markup-validator/validate-block-markup.sh" ]; then
    MARKUP_ISSUES=0
    TEMPLATE_FILES=$(find "$THEME_DIR/templates" "$THEME_DIR/parts" -name "*.html" 2>/dev/null)
    if [ -n "$TEMPLATE_FILES" ]; then
        for f in $TEMPLATE_FILES; do
            EXIT_CODE=0
            RESULT=$(echo "{\"tool_input\":{\"file_path\":\"$f\"}}" | "$PROJECT_ROOT/scripts/block-markup-validator/validate-block-markup.sh" 2>&1) || EXIT_CODE=$?
            if [ $EXIT_CODE -eq 2 ]; then
                MARKUP_ISSUES=$((MARKUP_ISSUES + 1))
                check_fail "Block markup issue in $(basename "$f")"
            fi
        done
        [ $MARKUP_ISSUES -eq 0 ] && check_pass "All templates pass block markup validation"
    else
        check_warn "No template files to validate"
    fi
else
    check_warn "Block markup validator not found"
fi

log ""

# ─────────────────────────────────────────
# 6. Token Compliance
# ─────────────────────────────────────────
log "--- 6. Design Token Compliance ---"

if [ -f "$PROJECT_ROOT/scripts/theme-token-auditor/audit-tokens.sh" ]; then
    TOKEN_ISSUES=0
    ALL_FILES=$(find "$THEME_DIR" \( -name "*.php" -o -name "*.css" -o -name "*.html" \) -not -path "*/node_modules/*" 2>/dev/null)
    if [ -n "$ALL_FILES" ]; then
        for f in $ALL_FILES; do
            EXIT_CODE=0
            RESULT=$(echo "{\"tool_input\":{\"file_path\":\"$f\"}}" | "$PROJECT_ROOT/scripts/theme-token-auditor/audit-tokens.sh" 2>&1) || EXIT_CODE=$?
            if [ $EXIT_CODE -eq 2 ]; then
                TOKEN_ISSUES=$((TOKEN_ISSUES + 1))
                check_warn "Hardcoded token in $(basename "$f")"
            fi
        done
        [ $TOKEN_ISSUES -eq 0 ] && check_pass "100% design token compliance"
    fi
else
    check_warn "Token auditor not found"
fi

log ""

# ─────────────────────────────────────────
# 7. Pattern Architecture
# ─────────────────────────────────────────
log "--- 7. Pattern Architecture ---"

if [ -f "$PROJECT_ROOT/scripts/figma-fse/validate-pattern-architecture.sh" ]; then
    # Check templates for inline images (should be in patterns)
    TEMPLATE_FILES=$(find "$THEME_DIR/templates" -name "*.html" 2>/dev/null)
    ARCH_ISSUES=0
    if [ -n "$TEMPLATE_FILES" ]; then
        for f in $TEMPLATE_FILES; do
            if grep -q '<img' "$f" 2>/dev/null; then
                ARCH_ISSUES=$((ARCH_ISSUES + 1))
                check_warn "Inline <img> in template $(basename "$f") (should be in a PHP pattern)"
            fi
        done
        [ $ARCH_ISSUES -eq 0 ] && check_pass "Templates follow pattern-first architecture"
    fi
else
    # Manual check
    TEMPLATE_FILES=$(find "$THEME_DIR/templates" -name "*.html" 2>/dev/null)
    if [ -n "$TEMPLATE_FILES" ]; then
        for f in $TEMPLATE_FILES; do
            if grep -q '<img' "$f" 2>/dev/null; then
                check_warn "Inline <img> in template $(basename "$f") (move to PHP pattern)"
            fi
        done
    fi
fi

log ""

# ─────────────────────────────────────────
# 8. Frontend Standards (CSS/JS)
# ─────────────────────────────────────────
log "--- 8. Frontend Standards ---"

if [ -f "$PROJECT_ROOT/scripts/wordpress/check-frontend-standards.sh" ]; then
    FE_RESULT=$("$PROJECT_ROOT/scripts/wordpress/check-frontend-standards.sh" "$THEME_DIR" 2>&1) || true
    # grep -c already prints 0 when nothing matches; `|| echo 0` made that "0<newline>0".
    FE_WARNINGS=$(echo "$FE_RESULT" | grep -c "Warning:" 2>/dev/null || true)
    FE_ERRORS=$(echo "$FE_RESULT" | grep -c "ERROR:" 2>/dev/null || true)
    if [ "$FE_ERRORS" -gt 0 ]; then
        check_fail "$FE_ERRORS frontend error(s)"
    elif [ "$FE_WARNINGS" -gt 0 ]; then
        check_warn "$FE_WARNINGS frontend warning(s)"
    else
        check_pass "Frontend standards check passed"
    fi
else
    check_warn "Frontend standards script not found"
fi

log ""

# ─────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────
log "============================================"
log "  RESULTS: $THEME_NAME"
log "============================================"
log "  Passed:   $PASS"
log "  Warnings: $WARN"
log "  Failed:   $FAIL"
log ""

if [ "$FAIL" -gt 0 ]; then
    log "  Status: FAILED ($FAIL critical issue(s))"
    [ "$REPORT" = true ] && echo "Report saved: $REPORT_FILE"
    exit 2
elif [ "$WARN" -gt 0 ]; then
    log "  Status: PASSED with warnings"
    [ "$REPORT" = true ] && echo "Report saved: $REPORT_FILE"
    exit 0
else
    log "  Status: PASSED (all checks clean)"
    [ "$REPORT" = true ] && echo "Report saved: $REPORT_FILE"
    exit 0
fi
