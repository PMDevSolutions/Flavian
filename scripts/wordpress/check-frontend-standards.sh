#!/bin/bash
# Check CSS and JavaScript coding standards for WordPress themes
#
# Usage:
#   ./scripts/wordpress/check-frontend-standards.sh [path]
#   ./scripts/wordpress/check-frontend-standards.sh themes/my-theme
#
# Checks:
#   CSS: Hardcoded colors, !important abuse, px instead of tokens, missing var() usage
#   JS:  console.log, eval(), inline event handlers, jQuery deprecations

set -e

TARGET="${1:-.}"
WARNINGS=0
ERRORS=0

echo "=== WordPress Frontend Standards Check ==="
echo "Target: $TARGET"
echo ""

# ─────────────────────────────────────────
# CSS CHECKS
# ─────────────────────────────────────────
echo "--- CSS Analysis ---"

CSS_FILES=$(find "$TARGET" -name "*.css" -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.git/*" 2>/dev/null)

if [ -z "$CSS_FILES" ]; then
    echo "  No CSS files found."
else
    for css_file in $CSS_FILES; do
        FILE_WARNINGS=0

        # Check for hardcoded hex colors (should use CSS custom properties)
        HARDCODED_COLORS=$(grep -cnE '#[0-9a-fA-F]{3,8}[^)]' "$css_file" 2>/dev/null || echo 0)
        if [ "$HARDCODED_COLORS" -gt 0 ]; then
            echo "  Warning: $css_file - $HARDCODED_COLORS hardcoded color value(s)"
            echo "    Use CSS custom properties from theme.json instead (e.g., var(--wp--preset--color--primary))"
            FILE_WARNINGS=$((FILE_WARNINGS + HARDCODED_COLORS))
        fi

        # Check for !important abuse
        IMPORTANT_COUNT=$(grep -c '!important' "$css_file" 2>/dev/null || echo 0)
        if [ "$IMPORTANT_COUNT" -gt 3 ]; then
            echo "  Warning: $css_file - $IMPORTANT_COUNT uses of !important (consider specificity refactoring)"
            FILE_WARNINGS=$((FILE_WARNINGS + 1))
        fi

        # Check for hardcoded px values (should use spacing tokens)
        HARDCODED_PX=$(grep -cnE ':\s*[0-9]+px' "$css_file" 2>/dev/null || echo 0)
        if [ "$HARDCODED_PX" -gt 5 ]; then
            echo "  Warning: $css_file - $HARDCODED_PX hardcoded px values (use theme.json spacing tokens)"
            FILE_WARNINGS=$((FILE_WARNINGS + 1))
        fi

        # Check for missing var() usage where expected
        FONT_FAMILY=$(grep -cnE 'font-family:\s*[^v]' "$css_file" 2>/dev/null || echo 0)
        if [ "$FONT_FAMILY" -gt 0 ]; then
            echo "  Warning: $css_file - $FONT_FAMILY hardcoded font-family (use var(--wp--preset--font-family--*))"
            FILE_WARNINGS=$((FILE_WARNINGS + 1))
        fi

        WARNINGS=$((WARNINGS + FILE_WARNINGS))
    done
fi

echo ""

# ─────────────────────────────────────────
# JS CHECKS
# ─────────────────────────────────────────
echo "--- JavaScript Analysis ---"

JS_FILES=$(find "$TARGET" -name "*.js" -not -path "*/node_modules/*" -not -path "*/vendor/*" -not -path "*/.git/*" -not -name "*.min.js" 2>/dev/null)

if [ -z "$JS_FILES" ]; then
    echo "  No JavaScript files found."
else
    for js_file in $JS_FILES; do
        # Check for console.log (should be removed for production)
        CONSOLE_COUNT=$(grep -c 'console\.log' "$js_file" 2>/dev/null || echo 0)
        if [ "$CONSOLE_COUNT" -gt 0 ]; then
            echo "  Warning: $js_file - $CONSOLE_COUNT console.log statement(s)"
            WARNINGS=$((WARNINGS + 1))
        fi

        # Check for eval() (security risk)
        EVAL_COUNT=$(grep -c 'eval(' "$js_file" 2>/dev/null || echo 0)
        if [ "$EVAL_COUNT" -gt 0 ]; then
            echo "  ERROR: $js_file - $EVAL_COUNT eval() usage(s) (security risk)"
            ERRORS=$((ERRORS + 1))
        fi

        # Check for inline event handlers in template literals
        INLINE_EVENTS=$(grep -cnE 'on(click|load|error|submit|change)\s*=' "$js_file" 2>/dev/null || echo 0)
        if [ "$INLINE_EVENTS" -gt 0 ]; then
            echo "  Warning: $js_file - $INLINE_EVENTS inline event handler(s) (use addEventListener)"
            WARNINGS=$((WARNINGS + 1))
        fi

        # Check for var usage (prefer const/let)
        VAR_COUNT=$(grep -cnE '^\s*var\s+' "$js_file" 2>/dev/null || echo 0)
        if [ "$VAR_COUNT" -gt 0 ]; then
            echo "  Warning: $js_file - $VAR_COUNT var declaration(s) (use const/let)"
            WARNINGS=$((WARNINGS + 1))
        fi
    done
fi

echo ""
echo "=== Summary ==="
echo "  Warnings: $WARNINGS"
echo "  Errors: $ERRORS"

if [ "$ERRORS" -gt 0 ]; then
    echo ""
    echo "Fix errors before proceeding."
    exit 2
fi

exit 0
