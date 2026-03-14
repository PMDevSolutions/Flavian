#!/bin/bash
# WordPress FSE Theme End-to-End Validation Script
#
# Comprehensive validation covering:
#   - Pre-installation checks (structure, files, syntax)
#   - WordPress installation testing (if Docker running)
#   - Visual validation (screenshot capture)
#   - Performance validation (Lighthouse)
#   - Accessibility validation (axe-core)
#   - Cross-browser testing (Playwright)
#
# Usage:
#   ./scripts/validate-theme-e2e.sh <theme-name>
#   ./scripts/validate-theme-e2e.sh <theme-name> --report        # Save report
#   ./scripts/validate-theme-e2e.sh <theme-name> --skip-docker   # Skip WordPress tests
#   ./scripts/validate-theme-e2e.sh <theme-name> --full          # Run all browsers
#
# Exit codes:
#   0 = All checks passed
#   1 = Warnings but passed
#   2 = Critical failures

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THEME_NAME="$1"
REPORT=false
SKIP_DOCKER=false
FULL_BROWSER=false
REPORT_FILE=""
WP_URL="http://localhost:8080"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASS=0
WARN=0
FAIL=0

# Parse arguments
shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --report) REPORT=true; shift ;;
        --skip-docker) SKIP_DOCKER=true; shift ;;
        --full) FULL_BROWSER=true; shift ;;
        --url) WP_URL="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# ─────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}--- $1 ---${NC}"
}

check_pass() {
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC}: $1"
    [ "$REPORT" = true ] && echo "  PASS: $1" >> "$REPORT_FILE"
}

check_warn() {
    WARN=$((WARN + 1))
    echo -e "  ${YELLOW}WARN${NC}: $1"
    [ "$REPORT" = true ] && echo "  WARN: $1" >> "$REPORT_FILE"
}

check_fail() {
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC}: $1"
    [ "$REPORT" = true ] && echo "  FAIL: $1" >> "$REPORT_FILE"
}

check_info() {
    echo -e "  ${BLUE}INFO${NC}: $1"
    [ "$REPORT" = true ] && echo "  INFO: $1" >> "$REPORT_FILE"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ─────────────────────────────────────────
# Validate Arguments
# ─────────────────────────────────────────

if [ -z "$THEME_NAME" ]; then
    echo "WordPress FSE Theme E2E Validation"
    echo ""
    echo "Usage: $0 <theme-name> [options]"
    echo ""
    echo "Options:"
    echo "  --report        Save validation report to .claude/reports/"
    echo "  --skip-docker   Skip WordPress installation tests"
    echo "  --full          Run full cross-browser testing (Chrome, Firefox, WebKit)"
    echo "  --url URL       WordPress URL (default: http://localhost:8080)"
    echo ""
    echo "Available themes:"
    ls -d "$PROJECT_ROOT/themes"/*/ 2>/dev/null | while read -r dir; do
        basename "$dir"
    done || echo "  (none)"
    exit 1
fi

THEME_DIR="$PROJECT_ROOT/themes/$THEME_NAME"

if [ ! -d "$THEME_DIR" ]; then
    echo -e "${RED}Error: Theme not found: $THEME_DIR${NC}"
    echo ""
    echo "Available themes:"
    ls -d "$PROJECT_ROOT/themes"/*/ 2>/dev/null | while read -r dir; do
        basename "$dir"
    done || echo "  (none)"
    exit 1
fi

# Setup report
if [ "$REPORT" = true ]; then
    REPORT_DIR="$PROJECT_ROOT/.claude/reports/e2e-validation"
    mkdir -p "$REPORT_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    REPORT_FILE="$REPORT_DIR/${THEME_NAME}_${TIMESTAMP}.md"
    echo "# E2E Validation Report: $THEME_NAME" > "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**Date:** $(date)" >> "$REPORT_FILE"
    echo "**Theme:** $THEME_NAME" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

print_header "E2E VALIDATION: $THEME_NAME"
echo "Theme: $THEME_DIR"
echo "Date: $(date)"
[ "$SKIP_DOCKER" = true ] && echo "Mode: Pre-installation checks only (--skip-docker)"
[ "$FULL_BROWSER" = true ] && echo "Mode: Full cross-browser testing (--full)"
[ "$REPORT" = true ] && echo "Report: $REPORT_FILE"

# ═══════════════════════════════════════════
# PHASE 1: PRE-INSTALLATION VALIDATION
# ═══════════════════════════════════════════

print_header "PHASE 1: PRE-INSTALLATION VALIDATION"

# 1.1 Required Files
print_section "1.1 Required Files"

[ -f "$THEME_DIR/style.css" ] && check_pass "style.css exists" || check_fail "style.css missing"
[ -f "$THEME_DIR/theme.json" ] && check_pass "theme.json exists" || check_fail "theme.json missing (required for FSE)"
[ -d "$THEME_DIR/templates" ] && check_pass "templates/ directory exists" || check_fail "templates/ directory missing"
[ -f "$THEME_DIR/templates/index.html" ] && check_pass "templates/index.html exists" || check_fail "templates/index.html missing (required)"
[ -d "$THEME_DIR/parts" ] && check_pass "parts/ directory exists" || check_warn "parts/ directory missing (recommended)"
[ -f "$THEME_DIR/functions.php" ] && check_pass "functions.php exists" || check_info "functions.php missing (optional)"

# 1.2 theme.json Validation
print_section "1.2 theme.json Validation"

if [ -f "$THEME_DIR/theme.json" ]; then
    # Check JSON validity
    if python3 -m json.tool "$THEME_DIR/theme.json" > /dev/null 2>&1; then
        check_pass "theme.json is valid JSON"

        # Check required sections
        THEME_VERSION=$(python3 -c "import json; data=json.load(open('$THEME_DIR/theme.json')); print(data.get('version', 'missing'))" 2>/dev/null)
        HAS_SETTINGS=$(python3 -c "import json; data=json.load(open('$THEME_DIR/theme.json')); print('yes' if 'settings' in data else 'no')" 2>/dev/null)
        HAS_STYLES=$(python3 -c "import json; data=json.load(open('$THEME_DIR/theme.json')); print('yes' if 'styles' in data else 'no')" 2>/dev/null)

        [ "$THEME_VERSION" != "missing" ] && check_pass "version: $THEME_VERSION" || check_warn "version not specified"
        [ "$HAS_SETTINGS" = "yes" ] && check_pass "settings section present" || check_warn "settings section missing"
        [ "$HAS_STYLES" = "yes" ] && check_pass "styles section present" || check_info "styles section missing (optional)"

        # Count design tokens
        COLOR_COUNT=$(python3 -c "import json; data=json.load(open('$THEME_DIR/theme.json')); print(len(data.get('settings',{}).get('color',{}).get('palette',[])))" 2>/dev/null || echo "0")
        FONT_COUNT=$(python3 -c "import json; data=json.load(open('$THEME_DIR/theme.json')); print(len(data.get('settings',{}).get('typography',{}).get('fontFamilies',[])))" 2>/dev/null || echo "0")

        check_info "Color palette: $COLOR_COUNT colors defined"
        check_info "Font families: $FONT_COUNT fonts defined"
    else
        check_fail "theme.json is invalid JSON"
    fi
else
    check_fail "Cannot validate theme.json (file missing)"
fi

# 1.3 Template Validation
print_section "1.3 Template Files"

TEMPLATE_COUNT=$(find "$THEME_DIR/templates" -name "*.html" 2>/dev/null | wc -l)
PART_COUNT=$(find "$THEME_DIR/parts" -name "*.html" 2>/dev/null | wc -l)

check_info "Found $TEMPLATE_COUNT template(s), $PART_COUNT template part(s)"

# Check for recommended templates
[ -f "$THEME_DIR/templates/front-page.html" ] && check_pass "templates/front-page.html exists" || check_info "templates/front-page.html missing (recommended)"
[ -f "$THEME_DIR/templates/single.html" ] && check_pass "templates/single.html exists" || check_info "templates/single.html missing (recommended)"
[ -f "$THEME_DIR/templates/page.html" ] && check_pass "templates/page.html exists" || check_info "templates/page.html missing (recommended)"
[ -f "$THEME_DIR/templates/404.html" ] && check_pass "templates/404.html exists" || check_info "templates/404.html missing (recommended)"

# 1.4 Architecture Validation
print_section "1.4 Pattern-First Architecture"

# Check for inline images in templates (should be in patterns)
INLINE_IMG_COUNT=$(grep -r "<img" "$THEME_DIR/templates" 2>/dev/null | wc -l || echo "0")
if [ "$INLINE_IMG_COUNT" -gt 0 ]; then
    check_warn "Found $INLINE_IMG_COUNT inline <img> tag(s) in templates (should be in PHP patterns)"
else
    check_pass "No inline <img> tags in templates"
fi

# Check for empty src attributes
EMPTY_SRC_COUNT=$(grep -r 'src=""' "$THEME_DIR" 2>/dev/null | wc -l || echo "0")
if [ "$EMPTY_SRC_COUNT" -gt 0 ]; then
    check_fail "Found $EMPTY_SRC_COUNT empty src=\"\" attribute(s)"
else
    check_pass "No empty src attributes"
fi

# Check for hardcoded colors in templates
HARDCODED_COLORS=$(grep -rE "#[0-9A-Fa-f]{6}" "$THEME_DIR/templates" "$THEME_DIR/parts" 2>/dev/null | wc -l || echo "0")
if [ "$HARDCODED_COLORS" -gt 0 ]; then
    check_warn "Found $HARDCODED_COLORS hardcoded color value(s) in templates (should use tokens)"
else
    check_pass "No hardcoded colors in templates"
fi

# 1.5 Run Existing Validator
print_section "1.5 Unified Theme Validator"

if [ -f "$PROJECT_ROOT/scripts/validate-theme.sh" ]; then
    VALIDATOR_OUTPUT=$("$PROJECT_ROOT/scripts/validate-theme.sh" "$THEME_NAME" 2>&1) || true
    VALIDATOR_EXIT=$?

    if [ $VALIDATOR_EXIT -eq 0 ]; then
        check_pass "validate-theme.sh passed"
    elif [ $VALIDATOR_EXIT -eq 2 ]; then
        check_fail "validate-theme.sh found critical issues"
        echo "$VALIDATOR_OUTPUT" | grep -E "FAIL:" | head -5
    else
        check_warn "validate-theme.sh completed with warnings"
    fi
else
    check_warn "validate-theme.sh not found"
fi

# ═══════════════════════════════════════════
# PHASE 2: WORDPRESS INSTALLATION TESTING
# ═══════════════════════════════════════════

if [ "$SKIP_DOCKER" = false ]; then
    print_header "PHASE 2: WORDPRESS INSTALLATION TESTING"

    # Check if Docker is running
    print_section "2.1 Docker Status"

    if command_exists docker && docker info > /dev/null 2>&1; then
        check_pass "Docker is running"

        # Check if WordPress container is running
        if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps 2>/dev/null | grep -q "Up"; then
            check_pass "WordPress container is running"

            # Test WordPress accessibility
            print_section "2.2 WordPress Accessibility"

            if command_exists curl; then
                HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WP_URL" 2>/dev/null || echo "000")
                if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
                    check_pass "WordPress accessible at $WP_URL (HTTP $HTTP_CODE)"
                else
                    check_fail "WordPress not accessible at $WP_URL (HTTP $HTTP_CODE)"
                fi
            else
                check_warn "curl not installed, cannot test WordPress accessibility"
            fi

            # Check if theme is active
            print_section "2.3 Theme Status"

            ACTIVE_THEME=$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T wordpress wp theme list --status=active --field=name --allow-root 2>/dev/null || echo "unknown")
            if [ "$ACTIVE_THEME" = "$THEME_NAME" ]; then
                check_pass "Theme '$THEME_NAME' is active"
            else
                check_info "Theme '$THEME_NAME' is not active (current: $ACTIVE_THEME)"
                check_info "Run: ./wordpress-local.sh activate-theme $THEME_NAME"
            fi

            # Check for PHP errors
            print_section "2.4 PHP Error Log"

            PHP_ERRORS=$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T wordpress cat /var/www/html/wp-content/debug.log 2>/dev/null | grep -iE "fatal|error|warning" | head -5 || echo "")
            if [ -z "$PHP_ERRORS" ]; then
                check_pass "No PHP errors in debug.log"
            else
                check_warn "PHP errors found in debug.log:"
                echo "$PHP_ERRORS" | while read -r line; do
                    echo "    $line"
                done
            fi

        else
            check_warn "WordPress container not running"
            check_info "Run: ./wordpress-local.sh start"
        fi
    else
        check_warn "Docker not running or not installed"
        check_info "Start Docker Desktop to run WordPress tests"
    fi
else
    print_header "PHASE 2: WORDPRESS INSTALLATION TESTING"
    check_info "Skipped (--skip-docker flag)"
fi

# ═══════════════════════════════════════════
# PHASE 3: VISUAL VALIDATION
# ═══════════════════════════════════════════

print_header "PHASE 3: VISUAL VALIDATION"

if [ "$SKIP_DOCKER" = false ]; then
    print_section "3.1 Screenshot Capture"

    if [ -f "$PROJECT_ROOT/scripts/cross-browser-test.sh" ] && command_exists node; then
        # Check if Playwright is available
        if node -e "require('playwright')" 2>/dev/null; then
            check_info "Capturing screenshots at all breakpoints..."

            SCREENSHOT_OUTPUT=$("$PROJECT_ROOT/scripts/cross-browser-test.sh" chromium "$WP_URL" 2>&1) || true

            if echo "$SCREENSHOT_OUTPUT" | grep -q "Captured:"; then
                SCREENSHOT_DIR="$PROJECT_ROOT/.claude/visual-qa/screenshots/wordpress/chromium"
                SCREENSHOT_COUNT=$(ls -1 "$SCREENSHOT_DIR"/*.png 2>/dev/null | wc -l || echo "0")
                check_pass "Captured $SCREENSHOT_COUNT screenshots"
                check_info "Screenshots saved to: $SCREENSHOT_DIR"
            else
                check_warn "Screenshot capture may have failed"
            fi
        else
            check_warn "Playwright not installed"
            check_info "Run: npm install -g playwright && npx playwright install"
        fi
    else
        check_warn "cross-browser-test.sh not found or Node.js not installed"
    fi
else
    check_info "Skipped visual validation (--skip-docker flag)"
fi

# ═══════════════════════════════════════════
# PHASE 4: CROSS-BROWSER TESTING
# ═══════════════════════════════════════════

if [ "$FULL_BROWSER" = true ] && [ "$SKIP_DOCKER" = false ]; then
    print_header "PHASE 4: CROSS-BROWSER TESTING"

    if [ -f "$PROJECT_ROOT/scripts/cross-browser-test.sh" ] && command_exists node; then
        if node -e "require('playwright')" 2>/dev/null; then
            for BROWSER in firefox webkit; do
                print_section "4.x $BROWSER"

                BROWSER_OUTPUT=$("$PROJECT_ROOT/scripts/cross-browser-test.sh" "$BROWSER" "$WP_URL" 2>&1) || true

                if echo "$BROWSER_OUTPUT" | grep -q "Captured:"; then
                    check_pass "$BROWSER screenshots captured"
                else
                    check_warn "$BROWSER screenshot capture may have failed"
                fi
            done
        else
            check_warn "Playwright not installed"
        fi
    else
        check_warn "Cross-browser testing tools not available"
    fi
else
    print_header "PHASE 4: CROSS-BROWSER TESTING"
    if [ "$FULL_BROWSER" = false ]; then
        check_info "Skipped (use --full flag for all browsers)"
    else
        check_info "Skipped (--skip-docker flag)"
    fi
fi

# ═══════════════════════════════════════════
# PHASE 5: PERFORMANCE VALIDATION
# ═══════════════════════════════════════════

print_header "PHASE 5: PERFORMANCE VALIDATION"

if [ "$SKIP_DOCKER" = false ]; then
    print_section "5.1 Lighthouse Audit"

    if command_exists lighthouse; then
        check_info "Running Lighthouse audit..."

        LIGHTHOUSE_DIR="$PROJECT_ROOT/.claude/reports/lighthouse"
        mkdir -p "$LIGHTHOUSE_DIR"
        LIGHTHOUSE_FILE="$LIGHTHOUSE_DIR/${THEME_NAME}_$(date +%Y%m%d_%H%M%S).json"

        lighthouse "$WP_URL" --output=json --output-path="$LIGHTHOUSE_FILE" --chrome-flags="--headless --no-sandbox" --quiet 2>/dev/null || true

        if [ -f "$LIGHTHOUSE_FILE" ]; then
            PERF_SCORE=$(python3 -c "import json; data=json.load(open('$LIGHTHOUSE_FILE')); print(int(data['categories']['performance']['score']*100))" 2>/dev/null || echo "N/A")
            A11Y_SCORE=$(python3 -c "import json; data=json.load(open('$LIGHTHOUSE_FILE')); print(int(data['categories']['accessibility']['score']*100))" 2>/dev/null || echo "N/A")
            BP_SCORE=$(python3 -c "import json; data=json.load(open('$LIGHTHOUSE_FILE')); print(int(data['categories']['best-practices']['score']*100))" 2>/dev/null || echo "N/A")
            SEO_SCORE=$(python3 -c "import json; data=json.load(open('$LIGHTHOUSE_FILE')); print(int(data['categories']['seo']['score']*100))" 2>/dev/null || echo "N/A")

            # Check scores against targets
            [ "$PERF_SCORE" != "N/A" ] && [ "$PERF_SCORE" -ge 90 ] && check_pass "Performance: $PERF_SCORE/100" || check_warn "Performance: $PERF_SCORE/100 (target: 90+)"
            [ "$A11Y_SCORE" != "N/A" ] && [ "$A11Y_SCORE" -ge 90 ] && check_pass "Accessibility: $A11Y_SCORE/100" || check_warn "Accessibility: $A11Y_SCORE/100 (target: 90+)"
            [ "$BP_SCORE" != "N/A" ] && [ "$BP_SCORE" -ge 90 ] && check_pass "Best Practices: $BP_SCORE/100" || check_warn "Best Practices: $BP_SCORE/100 (target: 90+)"
            [ "$SEO_SCORE" != "N/A" ] && [ "$SEO_SCORE" -ge 90 ] && check_pass "SEO: $SEO_SCORE/100" || check_warn "SEO: $SEO_SCORE/100 (target: 90+)"

            check_info "Lighthouse report saved: $LIGHTHOUSE_FILE"
        else
            check_warn "Lighthouse audit failed to produce results"
        fi
    else
        check_warn "Lighthouse CLI not installed"
        check_info "Run: npm install -g lighthouse"
    fi
else
    check_info "Skipped performance validation (--skip-docker flag)"
fi

# 5.2 Image Optimization
print_section "5.2 Image Optimization"

LARGE_IMAGES=$(find "$THEME_DIR" -type f \( -name "*.jpg" -o -name "*.png" -o -name "*.webp" \) -size +500k 2>/dev/null | wc -l || echo "0")
if [ "$LARGE_IMAGES" -gt 0 ]; then
    check_warn "Found $LARGE_IMAGES image(s) over 500KB"
else
    check_pass "All images under 500KB"
fi

WEBP_COUNT=$(find "$THEME_DIR" -name "*.webp" 2>/dev/null | wc -l || echo "0")
check_info "WebP images found: $WEBP_COUNT"

# ═══════════════════════════════════════════
# PHASE 6: ACCESSIBILITY VALIDATION
# ═══════════════════════════════════════════

print_header "PHASE 6: ACCESSIBILITY VALIDATION"

if [ "$SKIP_DOCKER" = false ]; then
    print_section "6.1 Automated Accessibility Scan"

    if command_exists axe; then
        check_info "Running axe-core scan..."

        AXE_OUTPUT=$(axe "$WP_URL" --exit 2>&1) || true
        AXE_EXIT=$?

        if [ $AXE_EXIT -eq 0 ]; then
            check_pass "axe-core: No accessibility violations"
        else
            VIOLATION_COUNT=$(echo "$AXE_OUTPUT" | grep -c "violation" || echo "unknown")
            check_warn "axe-core: Found accessibility issues"
        fi
    else
        check_info "axe-core CLI not installed"
        check_info "Run: npm install -g @axe-core/cli"
    fi
else
    check_info "Skipped accessibility scan (--skip-docker flag)"
fi

# 6.2 HTML Validation
print_section "6.2 HTML Structure"

# Check for skip link
SKIP_LINK=$(grep -r "skip" "$THEME_DIR/parts" 2>/dev/null | grep -i "content\|main\|nav" | wc -l || echo "0")
[ "$SKIP_LINK" -gt 0 ] && check_pass "Skip link appears to exist" || check_info "Skip link not detected (check manually)"

# Check for lang attribute instruction
LANG_CHECK=$(grep -r "language_attributes" "$THEME_DIR" 2>/dev/null | wc -l || echo "0")
[ "$LANG_CHECK" -gt 0 ] && check_pass "language_attributes() used" || check_info "Ensure <html> has lang attribute"

# ═══════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════

print_header "VALIDATION SUMMARY"

echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASS"
echo -e "  ${YELLOW}Warnings:${NC} $WARN"
echo -e "  ${RED}Failed:${NC}   $FAIL"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "  ${RED}Status: FAILED ($FAIL critical issue(s))${NC}"
    [ "$REPORT" = true ] && echo "" >> "$REPORT_FILE" && echo "## Status: FAILED" >> "$REPORT_FILE"
    [ "$REPORT" = true ] && echo "Report saved: $REPORT_FILE"
    exit 2
elif [ $WARN -gt 0 ]; then
    echo -e "  ${YELLOW}Status: PASSED with warnings${NC}"
    [ "$REPORT" = true ] && echo "" >> "$REPORT_FILE" && echo "## Status: PASSED (with warnings)" >> "$REPORT_FILE"
    [ "$REPORT" = true ] && echo "Report saved: $REPORT_FILE"
    exit 1
else
    echo -e "  ${GREEN}Status: PASSED (all checks clean)${NC}"
    [ "$REPORT" = true ] && echo "" >> "$REPORT_FILE" && echo "## Status: PASSED" >> "$REPORT_FILE"
    [ "$REPORT" = true ] && echo "Report saved: $REPORT_FILE"
    exit 0
fi
