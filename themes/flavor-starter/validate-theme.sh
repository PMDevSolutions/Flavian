#!/bin/bash

# Flavor Starter Theme Validation Script
# Validates the theme structure, files, and content for FSE compliance.
#
# Usage: ./validate-theme.sh [theme-directory]
# Default: Current directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Theme directory (default to current directory)
THEME_DIR="${1:-.}"

# Counters
PASS=0
FAIL=0
WARN=0

# Helper functions
pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASS++))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAIL++))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARN++))
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

# ============================================================================
# VALIDATION CHECKS
# ============================================================================

header "Flavor Starter Theme Validation"
info "Theme Directory: $THEME_DIR"

# ----------------------------------------------------------------------------
# 1. Required Files Check
# ----------------------------------------------------------------------------
header "1. Required Files"

REQUIRED_FILES=(
    "style.css"
    "theme.json"
    "functions.php"
    "templates/index.html"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$THEME_DIR/$file" ]; then
        pass "$file exists"
    else
        fail "$file is missing (REQUIRED)"
    fi
done

# Template files
TEMPLATE_FILES=(
    "templates/front-page.html"
    "templates/single.html"
    "templates/page.html"
    "templates/404.html"
)

for file in "${TEMPLATE_FILES[@]}"; do
    if [ -f "$THEME_DIR/$file" ]; then
        pass "$file exists"
    else
        warn "$file is missing"
    fi
done

# Template parts
PART_FILES=(
    "parts/header.html"
    "parts/footer.html"
)

for file in "${PART_FILES[@]}"; do
    if [ -f "$THEME_DIR/$file" ]; then
        pass "$file exists"
    else
        warn "$file is missing"
    fi
done

# Pattern files
PATTERN_FILES=(
    "patterns/hero-section.php"
    "patterns/about-section.php"
)

for file in "${PATTERN_FILES[@]}"; do
    if [ -f "$THEME_DIR/$file" ]; then
        pass "$file exists"
    else
        warn "$file is missing"
    fi
done

# ----------------------------------------------------------------------------
# 2. style.css Validation
# ----------------------------------------------------------------------------
header "2. style.css Validation"

if [ -f "$THEME_DIR/style.css" ]; then
    # Check for Theme Name
    if grep -q "Theme Name:" "$THEME_DIR/style.css"; then
        pass "Theme Name header found"
    else
        fail "Theme Name header missing"
    fi

    # Check for Version
    if grep -q "Version:" "$THEME_DIR/style.css"; then
        pass "Version header found"
    else
        fail "Version header missing"
    fi

    # Check for Text Domain
    if grep -q "Text Domain:" "$THEME_DIR/style.css"; then
        pass "Text Domain header found"
    else
        fail "Text Domain header missing"
    fi

    # Check for Requires at least
    if grep -q "Requires at least:" "$THEME_DIR/style.css"; then
        pass "Requires at least header found"
    else
        warn "Requires at least header missing"
    fi
fi

# ----------------------------------------------------------------------------
# 3. theme.json Validation
# ----------------------------------------------------------------------------
header "3. theme.json Validation"

if [ -f "$THEME_DIR/theme.json" ]; then
    # Check if valid JSON
    if command -v python3 &> /dev/null; then
        if python3 -c "import json; json.load(open('$THEME_DIR/theme.json'))" 2>/dev/null; then
            pass "theme.json is valid JSON"
        else
            fail "theme.json is invalid JSON"
        fi
    elif command -v node &> /dev/null; then
        if node -e "require('$THEME_DIR/theme.json')" 2>/dev/null; then
            pass "theme.json is valid JSON"
        else
            fail "theme.json is invalid JSON"
        fi
    else
        warn "Cannot validate JSON (no python3 or node available)"
    fi

    # Check for version 3
    if grep -q '"version": *3' "$THEME_DIR/theme.json" || grep -q '"version":3' "$THEME_DIR/theme.json"; then
        pass "theme.json version is 3"
    else
        fail "theme.json version should be 3"
    fi

    # Check for color palette
    if grep -q '"palette"' "$THEME_DIR/theme.json"; then
        pass "Color palette defined"

        # Count colors
        COLOR_COUNT=$(grep -c '"slug":' "$THEME_DIR/theme.json" | head -1 || echo "0")
        if [ "$COLOR_COUNT" -ge 6 ]; then
            pass "At least 6 design tokens defined"
        else
            warn "Less than 6 design tokens found"
        fi
    else
        fail "Color palette missing"
    fi

    # Check for font families
    if grep -q '"fontFamilies"' "$THEME_DIR/theme.json"; then
        pass "Font families defined"
    else
        fail "Font families missing"
    fi

    # Check for font sizes
    if grep -q '"fontSizes"' "$THEME_DIR/theme.json"; then
        pass "Font sizes defined"
    else
        fail "Font sizes missing"
    fi

    # Check for spacing
    if grep -q '"spacingSizes"' "$THEME_DIR/theme.json"; then
        pass "Spacing sizes defined"
    else
        fail "Spacing sizes missing"
    fi

    # Check for layout
    if grep -q '"contentSize"' "$THEME_DIR/theme.json" && grep -q '"wideSize"' "$THEME_DIR/theme.json"; then
        pass "Layout contentSize and wideSize defined"
    else
        fail "Layout contentSize or wideSize missing"
    fi
fi

# ----------------------------------------------------------------------------
# 4. Template Validation
# ----------------------------------------------------------------------------
header "4. Template Validation"

# Check templates reference valid parts
for template in "$THEME_DIR/templates/"*.html; do
    if [ -f "$template" ]; then
        TEMPLATE_NAME=$(basename "$template")

        # Check for header part reference
        if grep -q 'template-part.*"slug":"header"' "$template" || grep -q "template-part.*'slug':'header'" "$template"; then
            pass "$TEMPLATE_NAME references header part"
        else
            warn "$TEMPLATE_NAME may not reference header part"
        fi

        # Check for footer part reference
        if grep -q 'template-part.*"slug":"footer"' "$template" || grep -q "template-part.*'slug':'footer'" "$template"; then
            pass "$TEMPLATE_NAME references footer part"
        else
            warn "$TEMPLATE_NAME may not reference footer part"
        fi

        # Check for matching block comments
        OPENING=$(grep -c '<!-- wp:' "$template" || echo "0")
        CLOSING=$(grep -c '<!-- /wp:' "$template" || echo "0")
        SELF_CLOSING=$(grep -c '/-->' "$template" || echo "0")

        # Self-closing blocks don't need closing comments
        if [ "$OPENING" -ge "$CLOSING" ]; then
            pass "$TEMPLATE_NAME block comments appear balanced"
        else
            warn "$TEMPLATE_NAME may have unbalanced block comments"
        fi
    fi
done

# ----------------------------------------------------------------------------
# 5. Pattern Validation
# ----------------------------------------------------------------------------
header "5. Pattern Validation"

for pattern in "$THEME_DIR/patterns/"*.php; do
    if [ -f "$pattern" ]; then
        PATTERN_NAME=$(basename "$pattern")

        # Check for Title header
        if grep -q '* Title:' "$pattern"; then
            pass "$PATTERN_NAME has Title header"
        else
            fail "$PATTERN_NAME missing Title header"
        fi

        # Check for Slug header
        if grep -q '* Slug:' "$pattern"; then
            pass "$PATTERN_NAME has Slug header"
        else
            fail "$PATTERN_NAME missing Slug header"
        fi

        # Check for Categories header
        if grep -q '* Categories:' "$pattern"; then
            pass "$PATTERN_NAME has Categories header"
        else
            fail "$PATTERN_NAME missing Categories header"
        fi

        # Check for get_theme_file_uri usage (for images)
        if grep -q 'get_theme_file_uri' "$pattern"; then
            pass "$PATTERN_NAME uses get_theme_file_uri() for images"
        else
            warn "$PATTERN_NAME may not use get_theme_file_uri() for images"
        fi

        # Check for esc_html__ usage
        if grep -q 'esc_html__' "$pattern"; then
            pass "$PATTERN_NAME uses esc_html__() for text"
        else
            warn "$PATTERN_NAME may not use esc_html__() for text"
        fi

        # Check for esc_url usage
        if grep -q 'esc_url' "$pattern"; then
            pass "$PATTERN_NAME uses esc_url() for URLs"
        else
            warn "$PATTERN_NAME may not use esc_url() for URLs"
        fi
    fi
done

# ----------------------------------------------------------------------------
# 6. Image Assets Check
# ----------------------------------------------------------------------------
header "6. Image Assets"

if [ -d "$THEME_DIR/assets/images" ]; then
    pass "assets/images directory exists"

    # Check for placeholder images
    if ls "$THEME_DIR/assets/images/"*.svg 1> /dev/null 2>&1 || \
       ls "$THEME_DIR/assets/images/"*.jpg 1> /dev/null 2>&1 || \
       ls "$THEME_DIR/assets/images/"*.png 1> /dev/null 2>&1; then
        pass "Image files found in assets/images"
    else
        warn "No image files found in assets/images"
    fi
else
    warn "assets/images directory missing"
fi

# ----------------------------------------------------------------------------
# 7. WordPress Standards Check
# ----------------------------------------------------------------------------
header "7. WordPress Standards"

# Check for hardcoded colors in templates
HARDCODED_COLORS=0
for file in "$THEME_DIR/templates/"*.html "$THEME_DIR/parts/"*.html; do
    if [ -f "$file" ]; then
        if grep -E 'style="[^"]*color:[^"]*#[0-9a-fA-F]' "$file" >/dev/null 2>&1; then
            warn "$(basename "$file") may contain hardcoded color values"
            ((HARDCODED_COLORS++))
        fi
    fi
done

if [ "$HARDCODED_COLORS" -eq 0 ]; then
    pass "No hardcoded color values in templates"
fi

# Check for semantic heading structure
for file in "$THEME_DIR/templates/"*.html; do
    if [ -f "$file" ]; then
        H1_COUNT=$(grep -c '"level":1' "$file" 2>/dev/null || echo "0")
        if [ "$H1_COUNT" -le 1 ]; then
            pass "$(basename "$file") has proper h1 usage (max 1)"
        else
            warn "$(basename "$file") may have multiple h1 headings"
        fi
    fi
done

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
header "Validation Summary"

echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASS"
echo -e "  ${RED}Failed:${NC}   $FAIL"
echo -e "  ${YELLOW}Warnings:${NC} $WARN"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}Theme validation PASSED${NC}"
    exit 0
else
    echo -e "${RED}Theme validation FAILED${NC}"
    echo "Fix the failed checks before deploying."
    exit 1
fi
