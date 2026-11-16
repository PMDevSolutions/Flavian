#!/bin/bash
#
# Validate Pattern-First FSE Architecture
# Ensures templates use patterns for images, not inline PHP or empty src
#
# Called by: figma-fse-converter PostToolUse hook
# Blocks: Write/Edit operations that violate pattern-first architecture
#

set -e

THEME_FILE="$1"
THEME_DIR=$(dirname "$THEME_FILE")

# Only validate template files
if [[ ! "$THEME_FILE" =~ templates/.*\.html$ ]]; then
    exit 0  # Not a template file, skip validation
fi

echo "🔍 Validating pattern architecture: $THEME_FILE"

# Check 1: No PHP code in HTML templates
if grep -q '<?php' "$THEME_FILE" 2>/dev/null; then
    echo "❌ VALIDATION FAILED: PHP code found in HTML template"
    echo ""
    echo "HTML templates (.html) do NOT execute PHP code."
    echo "Solution: Move image sections to PHP pattern files in patterns/"
    echo ""
    grep -n '<?php' "$THEME_FILE"
    echo ""
    echo "See: docs/architecture/PATTERN-FIRST-ARCHITECTURE.md"
    exit 1
fi

# Check 2: No inline empty images
if grep -q '<img.*src=""' "$THEME_FILE" 2>/dev/null; then
    echo "❌ VALIDATION FAILED: Empty image src attributes found"
    echo ""
    echo "Images with empty src=\"\" won't display."
    echo "Solution: Create PHP patterns for image sections"
    echo ""
    grep -n '<img.*src=""' "$THEME_FILE"
    echo ""
    echo "See: docs/architecture/PATTERN-FIRST-ARCHITECTURE.md"
    exit 1
fi

# Check 3: No inline <img> with alt="" style= (likely empty)
EMPTY_IMG_COUNT=$(grep -c '<img alt="" style=' "$THEME_FILE" 2>/dev/null || echo "0")
if [ "$EMPTY_IMG_COUNT" -gt 0 ]; then
    echo "⚠️  WARNING: Found $EMPTY_IMG_COUNT inline images that may have empty src"
    echo ""
    echo "Consider extracting image sections to patterns/"
    echo ""
    # Don't fail, just warn
fi

# Check 4: Verify patterns exist if referenced
PATTERN_REFS=$(grep -o 'wp:pattern[^}]*"slug":"[^"]*"' "$THEME_FILE" 2>/dev/null | grep -o '"slug":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -n "$PATTERN_REFS" ]; then
    PATTERNS_DIR="$(dirname "$THEME_DIR")/patterns"

    while IFS= read -r pattern_slug; do
        # Extract pattern file name from slug (themename/pattern-name -> pattern-name.php)
        PATTERN_NAME=$(echo "$pattern_slug" | cut -d'/' -f2)
        PATTERN_FILE="$PATTERNS_DIR/${PATTERN_NAME}.php"

        if [ ! -f "$PATTERN_FILE" ]; then
            echo "❌ VALIDATION FAILED: Referenced pattern not found"
            echo ""
            echo "Template references pattern: $pattern_slug"
            echo "Expected file: $PATTERN_FILE"
            echo "Solution: Create the pattern file"
            exit 1
        fi
    done <<< "$PATTERN_REFS"

    echo "✅ All referenced patterns exist"
fi

echo "✅ Pattern architecture validation passed"
exit 0
