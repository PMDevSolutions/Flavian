#!/bin/bash
# FSE Design Token Optimizer
# Analyzes templates for repeated values and suggests promoting to theme.json tokens
# Helps identify common spacing, font-sizes, colors that should become design tokens

set -e

THEME_DIR="${1:-.}"
THEME_NAME=$(basename "$THEME_DIR")

echo "🔍 Analyzing templates for token optimization: $THEME_DIR"
echo ""

# Check if templates directory exists
if [[ ! -d "$THEME_DIR/templates" ]]; then
    echo "❌ No templates directory found at $THEME_DIR/templates"
    exit 1
fi

# Create temp files for analysis
TEMP_DIR=$(mktemp -d)
COLORS_FILE="$TEMP_DIR/colors.txt"
SIZES_FILE="$TEMP_DIR/sizes.txt"
SPACING_FILE="$TEMP_DIR/spacing.txt"
FONT_SIZES_FILE="$TEMP_DIR/font-sizes.txt"

# Extract all values from templates
find "$THEME_DIR/templates" -name "*.html" -type f | while read template; do
    # Extract spacing values (padding, margin, gap)
    grep -oE '"(padding|margin|gap)"[[:space:]]*:[[:space:]]*"[0-9]+px"' "$template" 2>/dev/null | \
        grep -oE '[0-9]+px' >> "$SPACING_FILE" || true

    # Extract font-size values
    grep -oE '"fontSize"[[:space:]]*:[[:space:]]*"[0-9]+px"' "$template" 2>/dev/null | \
        grep -oE '[0-9]+px' >> "$FONT_SIZES_FILE" || true

    # Extract hex colors (for recommendation to convert)
    grep -oE '#[0-9A-Fa-f]{6}' "$template" 2>/dev/null >> "$COLORS_FILE" || true
done

# Analyze spacing patterns
echo "## Spacing Analysis"
echo ""

if [[ -f "$SPACING_FILE" ]] && [[ -s "$SPACING_FILE" ]]; then
    SPACING_USAGE=$(sort "$SPACING_FILE" | uniq -c | sort -rn)
    echo "Most commonly used spacing values:"
    echo ""

    echo "$SPACING_USAGE" | head -10 | while read count value; do
        if [[ $count -ge 3 ]]; then
            echo "  $value used $count times → ⚠️  SHOULD BE THEME.JSON TOKEN"
        else
            echo "  $value used $count times"
        fi
    done

    echo ""
    echo "Recommendations:"
    echo ""

    # Suggest tokens for frequently used values
    echo "$SPACING_USAGE" | head -10 | while read count value; do
        if [[ $count -ge 3 ]]; then
            SIZE=${value%px}

            # Suggest appropriate slug based on size
            if [[ $SIZE -le 8 ]]; then
                SLUG="20"
                NAME="XS"
            elif [[ $SIZE -le 16 ]]; then
                SLUG="30"
                NAME="Small"
            elif [[ $SIZE -le 24 ]]; then
                SLUG="40"
                NAME="Base"
            elif [[ $SIZE -le 32 ]]; then
                SLUG="50"
                NAME="Medium"
            elif [[ $SIZE -le 48 ]]; then
                SLUG="60"
                NAME="Large"
            elif [[ $SIZE -le 64 ]]; then
                SLUG="70"
                NAME="XL"
            else
                SLUG="80"
                NAME="2XL"
            fi

            echo "  ✅ Add to theme.json: { \"slug\": \"$SLUG\", \"size\": \"$value\", \"name\": \"$NAME\" }"
        fi
    done
else
    echo "  ✅ No hardcoded spacing values found"
fi

echo ""
echo "---"
echo ""

# Analyze font-size patterns
echo "## Font Size Analysis"
echo ""

if [[ -f "$FONT_SIZES_FILE" ]] && [[ -s "$FONT_SIZES_FILE" ]]; then
    FONT_SIZE_USAGE=$(sort "$FONT_SIZES_FILE" | uniq -c | sort -rn)
    echo "Most commonly used font sizes:"
    echo ""

    echo "$FONT_SIZE_USAGE" | head -10 | while read count value; do
        if [[ $count -ge 2 ]]; then
            echo "  $value used $count times → ⚠️  SHOULD BE THEME.JSON TOKEN"
        else
            echo "  $value used $count times"
        fi
    done

    echo ""
    echo "Recommendations:"
    echo ""

    # Suggest tokens for frequently used values
    echo "$FONT_SIZE_USAGE" | head -10 | while read count value; do
        if [[ $count -ge 2 ]]; then
            SIZE=${value%px}

            # Suggest appropriate slug based on size
            if [[ $SIZE -le 14 ]]; then
                SLUG="small"
                NAME="Small"
            elif [[ $SIZE -le 16 ]]; then
                SLUG="base"
                NAME="Base"
            elif [[ $SIZE -le 18 ]]; then
                SLUG="medium"
                NAME="Medium"
            elif [[ $SIZE -le 20 ]]; then
                SLUG="large"
                NAME="Large"
            elif [[ $SIZE -le 24 ]]; then
                SLUG="x-large"
                NAME="Extra Large"
            elif [[ $SIZE -le 32 ]]; then
                SLUG="2x-large"
                NAME="2X Large"
            elif [[ $SIZE -le 40 ]]; then
                SLUG="3x-large"
                NAME="3X Large"
            elif [[ $SIZE -le 56 ]]; then
                SLUG="4x-large"
                NAME="4X Large"
            else
                SLUG="5x-large"
                NAME="5X Large"
            fi

            echo "  ✅ Add to theme.json: { \"slug\": \"$SLUG\", \"size\": \"$value\", \"name\": \"$NAME\" }"
        fi
    done
else
    echo "  ✅ No hardcoded font sizes found"
fi

echo ""
echo "---"
echo ""

# Analyze color patterns
echo "## Color Analysis"
echo ""

if [[ -f "$COLORS_FILE" ]] && [[ -s "$COLORS_FILE" ]]; then
    COLOR_USAGE=$(sort "$COLORS_FILE" | uniq -c | sort -rn)
    echo "Most commonly used colors:"
    echo ""

    echo "$COLOR_USAGE" | head -10 | while read count value; do
        if [[ $count -ge 2 ]]; then
            echo "  $value used $count times → ⚠️  SHOULD BE THEME.JSON TOKEN"
        else
            echo "  $value used $count times"
        fi
    done

    echo ""
    echo "Recommendations:"
    echo ""

    # Suggest tokens for frequently used values
    INDEX=1
    echo "$COLOR_USAGE" | head -10 | while read count value; do
        if [[ $count -ge 2 ]]; then
            # Try to guess semantic meaning from color
            case "$value" in
                "#"[fF][fF][fF][fF][fF][fF] | "#"[fF][fF][fF][fF][fF][fF])
                    SLUG="white"
                    NAME="White"
                    ;;
                "#000000" | "#"[0-1][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f])
                    SLUG="black"
                    NAME="Black"
                    ;;
                *)
                    SLUG="color-$INDEX"
                    NAME="Color $INDEX"
                    INDEX=$((INDEX + 1))
                    ;;
            esac

            echo "  ✅ Add to theme.json: { \"slug\": \"$SLUG\", \"color\": \"$value\", \"name\": \"$NAME\" }"
        fi
    done
else
    echo "  ✅ No hardcoded colors found"
fi

echo ""
echo "---"
echo ""

# Load theme.json if it exists
THEME_JSON="$THEME_DIR/theme.json"

if [[ -f "$THEME_JSON" ]]; then
    echo "## Current theme.json Token Coverage"
    echo ""

    COLOR_COUNT=$(jq -r '.settings.color.palette // [] | length' "$THEME_JSON" 2>/dev/null || echo "0")
    FONT_SIZE_COUNT=$(jq -r '.settings.typography.fontSizes // [] | length' "$THEME_JSON" 2>/dev/null || echo "0")
    SPACING_COUNT=$(jq -r '.settings.spacing.spacingSizes // [] | length' "$THEME_JSON" 2>/dev/null || echo "0")

    echo "  Colors: $COLOR_COUNT tokens"
    echo "  Font Sizes: $FONT_SIZE_COUNT tokens"
    echo "  Spacing: $SPACING_COUNT tokens"
    echo ""

    # Check if we have minimum viable coverage
    if [[ $COLOR_COUNT -ge 10 ]] && [[ $FONT_SIZE_COUNT -ge 8 ]] && [[ $SPACING_COUNT -ge 8 ]]; then
        echo "  ✅ Good token coverage - design system is comprehensive"
    else
        echo "  ⚠️  Limited token coverage - consider adding more tokens"
        if [[ $COLOR_COUNT -lt 10 ]]; then
            echo "     • Add more color tokens (minimum 10 recommended)"
        fi
        if [[ $FONT_SIZE_COUNT -lt 8 ]]; then
            echo "     • Add more font size tokens (minimum 8 recommended)"
        fi
        if [[ $SPACING_COUNT -lt 8 ]]; then
            echo "     • Add more spacing tokens (minimum 8 recommended)"
        fi
    fi
else
    echo "## theme.json Not Found"
    echo ""
    echo "  ⚠️  No theme.json at $THEME_JSON"
    echo "  Create theme.json with recommended tokens from analysis above"
fi

echo ""
echo "---"
echo ""

# Summary
echo "## Summary"
echo ""

HARDCODED_SPACING_COUNT=$(wc -l < "$SPACING_FILE" 2>/dev/null || echo "0")
HARDCODED_FONT_SIZE_COUNT=$(wc -l < "$FONT_SIZES_FILE" 2>/dev/null || echo "0")
HARDCODED_COLOR_COUNT=$(wc -l < "$COLORS_FILE" 2>/dev/null || echo "0")

TOTAL_HARDCODED=$((HARDCODED_SPACING_COUNT + HARDCODED_FONT_SIZE_COUNT + HARDCODED_COLOR_COUNT))

echo "Total hardcoded values found: $TOTAL_HARDCODED"
echo "  - Spacing: $HARDCODED_SPACING_COUNT"
echo "  - Font sizes: $HARDCODED_FONT_SIZE_COUNT"
echo "  - Colors: $HARDCODED_COLOR_COUNT"
echo ""

if [[ $TOTAL_HARDCODED -eq 0 ]]; then
    echo "✅ EXCELLENT: Zero hardcoded values! All templates use theme.json tokens."
elif [[ $TOTAL_HARDCODED -le 10 ]]; then
    echo "⚠️  GOOD: Few hardcoded values. Review recommendations above to promote to tokens."
else
    echo "❌ NEEDS WORK: Many hardcoded values. Templates should use theme.json tokens exclusively."
    echo ""
    echo "Next steps:"
    echo "1. Add recommended tokens to theme.json"
    echo "2. Replace hardcoded values with token references in templates"
    echo "3. Re-run this script to verify improvements"
fi

echo ""

# Cleanup
rm -rf "$TEMP_DIR"

exit 0
