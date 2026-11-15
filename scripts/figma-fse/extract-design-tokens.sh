#!/bin/bash
# Figma Design Token Extractor
# Validates Figma variable extraction and theme.json generation
# Checks for complete design system coverage and token usage

# Read JSON input from stdin (if provided by hook)
INPUT=$(cat)

# Extract file path if provided (for validation after theme.json creation)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only check theme.json files
if [[ "$FILE_PATH" != *"theme.json" ]]; then
    exit 0
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

echo "🎨 Validating Figma design token extraction: $FILE_PATH" >&2

# Validate JSON syntax
if ! jq empty "$FILE_PATH" 2>/dev/null; then
    echo "" >&2
    echo "❌ Invalid JSON syntax in theme.json" >&2
    exit 0
fi

# Check for required theme.json sections
REQUIRED_SECTIONS=("settings.color.palette" "settings.typography" "settings.spacing")
MISSING_SECTIONS=()

for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! jq -e ".$section" "$FILE_PATH" >/dev/null 2>&1; then
        MISSING_SECTIONS+=("$section")
    fi
done

if [ ${#MISSING_SECTIONS[@]} -gt 0 ]; then
    echo "" >&2
    echo "⚠️  Missing design system sections:" >&2
    for section in "${MISSING_SECTIONS[@]}"; do
        echo "   - $section" >&2
    done
    echo "" >&2
fi

# Count design tokens
COLOR_COUNT=$(jq -r '.settings.color.palette // [] | length' "$FILE_PATH" 2>/dev/null)
FONT_SIZE_COUNT=$(jq -r '.settings.typography.fontSizes // [] | length' "$FILE_PATH" 2>/dev/null)
SPACING_COUNT=$(jq -r '.settings.spacing.spacingSizes // [] | length' "$FILE_PATH" 2>/dev/null)

echo "" >&2
echo "📊 Design Token Summary:" >&2
echo "   Colors: $COLOR_COUNT" >&2
echo "   Font Sizes: $FONT_SIZE_COUNT" >&2
echo "   Spacing Tokens: $SPACING_COUNT" >&2

# Check for minimum token counts (design system should be comprehensive)
WARNINGS=()

if [ "$COLOR_COUNT" -lt 6 ]; then
    WARNINGS+=("Only $COLOR_COUNT colors defined. Consider extracting complete color palette (6+ colors).")
fi

if [ "$FONT_SIZE_COUNT" -lt 5 ]; then
    WARNINGS+=("Only $FONT_SIZE_COUNT font sizes defined. Consider extracting complete typography scale (5+ sizes).")
fi

if [ "$SPACING_COUNT" -lt 6 ]; then
    WARNINGS+=("Only $SPACING_COUNT spacing tokens defined. Consider extracting complete spacing scale (6+ tokens).")
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "" >&2
    echo "⚠️  Design System Warnings:" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "   - $warning" >&2
    done
    echo "" >&2
    echo "A comprehensive design system ensures consistent, maintainable templates." >&2
else
    echo "" >&2
    echo "✅ Comprehensive design system detected" >&2
fi

# Check for hardcoded colors (hex values in styles section)
if jq -r '.styles' "$FILE_PATH" 2>/dev/null | grep -q '#[0-9A-Fa-f]\{6\}'; then
    echo "" >&2
    echo "⚠️  Found hardcoded hex colors in styles section" >&2
    echo "   Use CSS variables instead: var(--wp--preset--color--slug)" >&2
fi

# Check for theme.json schema version
SCHEMA_VERSION=$(jq -r '.version // 0' "$FILE_PATH" 2>/dev/null)
if [ "$SCHEMA_VERSION" -lt 2 ]; then
    echo "" >&2
    echo "⚠️  Using theme.json schema version $SCHEMA_VERSION" >&2
    echo "   Consider upgrading to version 2 for latest features" >&2
fi

echo "" >&2
echo "Design token validation complete." >&2

# Always exit 0 (warn, don't block)
exit 0
