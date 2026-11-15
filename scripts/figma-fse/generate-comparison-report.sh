#!/bin/bash
# Figma-to-FSE Comparison Report Generator
# Creates comprehensive report comparing Figma designs to generated FSE templates
# Runs on agent completion

echo "📊 Generating Figma-to-FSE comparison report..." >&2

# Create reports directory
mkdir -p .claude/reports

# Report file
REPORT_FILE=".claude/reports/figma-fse-comparison.md"

# Timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Start report
cat > "$REPORT_FILE" << 'EOF'
# Figma-to-FSE Conversion Report

**Generated:** TIMESTAMP_PLACEHOLDER

## Summary

This report documents the conversion of Figma designs to WordPress FSE block theme.

## Design System Extraction

EOF

# Replace timestamp placeholder
sed -i "s/TIMESTAMP_PLACEHOLDER/$TIMESTAMP/" "$REPORT_FILE" 2>/dev/null || sed -i '' "s/TIMESTAMP_PLACEHOLDER/$TIMESTAMP/" "$REPORT_FILE" 2>/dev/null

# Find theme.json files
THEME_JSON_FILES=$(find themes/ -name "theme.json" 2>/dev/null)

if [ -n "$THEME_JSON_FILES" ]; then
    echo "### theme.json Found" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    for theme_json in $THEME_JSON_FILES; do
        echo "**File:** \`$theme_json\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"

        # Count tokens
        if [ -f "$theme_json" ]; then
            COLOR_COUNT=$(jq -r '.settings.color.palette // [] | length' "$theme_json" 2>/dev/null)
            FONT_SIZE_COUNT=$(jq -r '.settings.typography.fontSizes // [] | length' "$theme_json" 2>/dev/null)
            SPACING_COUNT=$(jq -r '.settings.spacing.spacingSizes // [] | length' "$theme_json" 2>/dev/null)

            echo "- Colors: $COLOR_COUNT" >> "$REPORT_FILE"
            echo "- Font Sizes: $FONT_SIZE_COUNT" >> "$REPORT_FILE"
            echo "- Spacing Tokens: $SPACING_COUNT" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
        fi
    done
else
    echo "**Status:** ⚠️ No theme.json files found" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# Find template files
echo "## Templates Converted" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

TEMPLATE_FILES=$(find themes/ -path "*/templates/*.html" 2>/dev/null)
TEMPLATE_COUNT=$(echo "$TEMPLATE_FILES" | grep -c ".html" 2>/dev/null || echo "0")

echo "**Total Templates:** $TEMPLATE_COUNT" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ "$TEMPLATE_COUNT" -gt 0 ]; then
    echo "### Template List" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    for template in $TEMPLATE_FILES; do
        TEMPLATE_NAME=$(basename "$template" .html)
        BLOCK_COUNT=$(grep -o '<!-- wp:' "$template" 2>/dev/null | wc -l)

        echo "- **$TEMPLATE_NAME** (\`$template\`) - $BLOCK_COUNT blocks" >> "$REPORT_FILE"
    done
    echo "" >> "$REPORT_FILE"
fi

# Check for hardcoded values
echo "## Quality Checks" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

HARDCODED_COLORS=0
HARDCODED_SIZES=0

if [ -n "$TEMPLATE_FILES" ]; then
    for template in $TEMPLATE_FILES; do
        if grep -q '#[0-9A-Fa-f]\{6\}' "$template" 2>/dev/null; then
            HARDCODED_COLORS=$((HARDCODED_COLORS + 1))
        fi
        if grep -qE ':\s*"[0-9]+px"' "$template" 2>/dev/null; then
            HARDCODED_SIZES=$((HARDCODED_SIZES + 1))
        fi
    done
fi

echo "### Hardcoded Values Detected" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "- Templates with hardcoded colors: $HARDCODED_COLORS" >> "$REPORT_FILE"
echo "- Templates with hardcoded sizes: $HARDCODED_SIZES" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ "$HARDCODED_COLORS" -eq 0 ] && [ "$HARDCODED_SIZES" -eq 0 ]; then
    echo "✅ **Zero hardcoded values** - All templates use theme.json tokens!" >> "$REPORT_FILE"
else
    echo "⚠️ Some templates contain hardcoded values. Review and convert to theme.json tokens." >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# Check for attribute-level comparison data
echo "## Attribute-Level Validation (Phase 3)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

ATTR_COMPARISON_FILE=".claude/figma-data/attribute-comparison.json"

if [ -f "$ATTR_COMPARISON_FILE" ]; then
    echo "### Figma vs. Template Attribute Comparison" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # Count mismatches
    MISMATCH_COUNT=$(jq -r '.mismatches // [] | length' "$ATTR_COMPARISON_FILE" 2>/dev/null || echo "0")

    if [ "$MISMATCH_COUNT" -eq 0 ]; then
        echo "✅ **Perfect attribute match** - All template attributes match Figma properties!" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    else
        echo "⚠️ **$MISMATCH_COUNT attribute mismatches found**" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"

        # List mismatches
        echo "#### Mismatches Detail" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"

        jq -r '.mismatches[] | "**\(.component)** (\(.template)):\n- Property: `\(.property)`\n- Figma: `\(.figma_value)`\n- Template: `\(.template_value)`\n- Recommendation: \(.recommendation)\n"' "$ATTR_COMPARISON_FILE" 2>/dev/null >> "$REPORT_FILE" || echo "Error reading mismatch data" >> "$REPORT_FILE"

        echo "" >> "$REPORT_FILE"
    fi

    # Show validation summary
    TOTAL_ATTRS=$(jq -r '.total_attributes_checked // 0' "$ATTR_COMPARISON_FILE" 2>/dev/null || echo "0")
    MATCHED_ATTRS=$(jq -r '.matched_attributes // 0' "$ATTR_COMPARISON_FILE" 2>/dev/null || echo "0")

    if [ "$TOTAL_ATTRS" -gt 0 ]; then
        MATCH_PERCENT=$((MATCHED_ATTRS * 100 / TOTAL_ATTRS))
        echo "**Validation Summary:**" >> "$REPORT_FILE"
        echo "- Total attributes checked: $TOTAL_ATTRS" >> "$REPORT_FILE"
        echo "- Matched attributes: $MATCHED_ATTRS ($MATCH_PERCENT%)" >> "$REPORT_FILE"
        echo "- Mismatched attributes: $MISMATCH_COUNT" >> "$REPORT_FILE"
    fi
else
    echo "*Attribute-level comparison data not available.*" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "To enable attribute comparison:" >> "$REPORT_FILE"
    echo "1. Agent extracts Figma component properties during generation" >> "$REPORT_FILE"
    echo "2. Agent saves properties to `.claude/figma-data/attribute-comparison.json`" >> "$REPORT_FILE"
    echo "3. This report will show detailed attribute mismatches" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# Token optimization recommendations
echo "## Token Optimization Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Run optimize-tokens.sh if it exists
if [ -x "scripts/figma-fse/optimize-tokens.sh" ] && [ -n "$THEME_JSON_FILES" ]; then
    THEME_DIR=$(dirname "$(echo "$THEME_JSON_FILES" | head -1)")

    echo "Running token optimization analysis..." >&2
    OPTIMIZE_OUTPUT=$(scripts/figma-fse/optimize-tokens.sh "$THEME_DIR" 2>&1 || echo "Optimization analysis failed")

    # Extract summary from optimization output
    if echo "$OPTIMIZE_OUTPUT" | grep -q "EXCELLENT\|GOOD\|NEEDS WORK"; then
        SUMMARY_LINE=$(echo "$OPTIMIZE_OUTPUT" | grep -E "EXCELLENT|GOOD|NEEDS WORK" | head -1)
        echo "$SUMMARY_LINE" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"

        # Extract total hardcoded count
        HARDCODED_LINE=$(echo "$OPTIMIZE_OUTPUT" | grep "Total hardcoded values found:" | head -1)
        if [ -n "$HARDCODED_LINE" ]; then
            echo "$HARDCODED_LINE" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
        fi

        # Link to full analysis
        echo "*Run \`./scripts/figma-fse/optimize-tokens.sh $THEME_DIR\` for detailed token recommendations.*" >> "$REPORT_FILE"
    else
        echo "Token optimization analysis completed. Run \`./scripts/figma-fse/optimize-tokens.sh $THEME_DIR\` for details." >> "$REPORT_FILE"
    fi
else
    echo "Token optimization script not found or no themes to analyze." >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# Check for errors log
echo "## Issues & Errors" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ -f ".claude/logs/figma-access.log" ]; then
    ERROR_COUNT=$(grep -c "error\|failed" ".claude/logs/figma-access.log" 2>/dev/null || echo "0")
    echo "- Figma MCP calls logged: $(wc -l < .claude/logs/figma-access.log)" >> "$REPORT_FILE"
    echo "- Errors encountered: $ERROR_COUNT" >> "$REPORT_FILE"
else
    echo "No error log found." >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# Next steps
echo "## Next Steps" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "1. **Install WordPress** (if not already installed)" >> "$REPORT_FILE"
echo "2. **Activate theme** in WordPress admin" >> "$REPORT_FILE"
echo "3. **Test templates** with real content" >> "$REPORT_FILE"
echo "4. **Adjust design tokens** in theme.json as needed" >> "$REPORT_FILE"
echo "5. **Add custom functionality** in functions.php (optional)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "*Report generated by figma-fse-converter agent*" >> "$REPORT_FILE"

echo "" >&2
echo "✅ Comparison report generated: $REPORT_FILE" >&2

# Always exit 0
exit 0
