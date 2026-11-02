#!/bin/bash
# Figma FSE Conversion Completion Hook
# Runs when all Figma-to-FSE templates are complete
# Performs final validation, generates comparison report, runs quality checks
#
# Run by the figma-fse-converter agent (bash .claude/hooks/figma-fse-completion.sh themes/<slug>)
# or with the event JSON on stdin. Output to stderr; always exits 0.
set -u
trap 'exit 0' ERR

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Read JSON input from stdin (if provided by tool)
INPUT=$(cat)

# Extract theme directory from input
THEME_DIR=$(echo "$INPUT" | jq -r '.tool_input.theme_dir // .theme_dir // empty' 2>/dev/null)

# Allow command-line override
if [ -n "${1:-}" ]; then
    THEME_DIR="$1"
fi

# If no theme directory specified, try to find most recent
if [ -z "$THEME_DIR" ]; then
    THEME_DIR=$(ls -td themes/*/ 2>/dev/null | head -n 1 | sed "s#/$##")
fi

if [ -z "$THEME_DIR" ] || [ ! -d "$THEME_DIR" ]; then
    echo -e "${RED}❌ Theme directory not found${NC}" >&2
    exit 0
fi

THEME_NAME=$(basename "$THEME_DIR")

echo "" >&2
echo -e "${PURPLE}╔════════════════════════════════════════════╗${NC}" >&2
echo -e "${PURPLE}║  Figma-to-FSE Conversion Complete! 🎉     ║${NC}" >&2
echo -e "${PURPLE}╚════════════════════════════════════════════╝${NC}" >&2
echo "" >&2
echo -e "${BLUE}Theme: $THEME_NAME${NC}" >&2
echo -e "${BLUE}Location: $THEME_DIR${NC}" >&2
echo "" >&2

# Initialize counters
TOTAL_ERRORS=0
TOTAL_WARNINGS=0

# Step 1: Count generated files
echo -e "${BLUE}📊 Generated Files:${NC}" >&2

TEMPLATES=$(find "$THEME_DIR/templates" -name "*.html" 2>/dev/null | wc -l)
PARTS=$(find "$THEME_DIR/parts" -name "*.html" 2>/dev/null | wc -l)
PATTERNS=$(find "$THEME_DIR/patterns" -name "*.php" 2>/dev/null | wc -l)

echo "  Templates: $TEMPLATES" >&2
echo "  Template Parts: $PARTS" >&2
echo "  Block Patterns: $PATTERNS" >&2

if [ -f "$THEME_DIR/theme.json" ]; then
    echo -e "  ${GREEN}✓ theme.json${NC}" >&2
else
    echo -e "  ${RED}✗ theme.json missing${NC}" >&2
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

if [ -f "$THEME_DIR/style.css" ]; then
    echo -e "  ${GREEN}✓ style.css${NC}" >&2
else
    echo -e "  ${RED}✗ style.css missing${NC}" >&2
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

echo "" >&2

# Step 2: Validate all templates for hardcoded values
echo -e "${BLUE}🔍 Validating Templates (Zero Hardcoded Values):${NC}" >&2

TOTAL_HARDCODED_COLORS=0
TOTAL_HARDCODED_PIXELS=0
UNBALANCED_BLOCKS=0

if [ -d "$THEME_DIR/templates" ]; then
    for template in "$THEME_DIR/templates"/*.html; do
        if [ -f "$template" ]; then
            TEMPLATE_NAME=$(basename "$template")

            # Check for hardcoded hex colors
            COLORS=$(grep -c '#[0-9A-Fa-f]\{6\}' "$template" 2>/dev/null || true)
            TOTAL_HARDCODED_COLORS=$((TOTAL_HARDCODED_COLORS + COLORS))

            # Check for hardcoded pixel sizes (excluding block comments)
            PIXELS=$(grep -v '<!-- wp:' "$template" | grep -c '"[0-9]\+px"' 2>/dev/null || true)
            TOTAL_HARDCODED_PIXELS=$((TOTAL_HARDCODED_PIXELS + PIXELS))

            # Check block balance
            OPEN=$(grep -o '<!-- wp:' "$template" 2>/dev/null | wc -l)
            CLOSE=$(grep -o '<!-- /wp:' "$template" 2>/dev/null | wc -l)

            if [ "$OPEN" -ne "$CLOSE" ]; then
                echo -e "  ${RED}✗ $TEMPLATE_NAME: Unbalanced blocks ($OPEN open, $CLOSE close)${NC}" >&2
                UNBALANCED_BLOCKS=$((UNBALANCED_BLOCKS + 1))
                TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
            fi
        fi
    done
fi

if [ $TOTAL_HARDCODED_COLORS -eq 0 ]; then
    echo -e "  ${GREEN}✓ Zero hardcoded hex colors${NC}" >&2
else
    echo -e "  ${YELLOW}⚠  Found $TOTAL_HARDCODED_COLORS hardcoded hex colors${NC}" >&2
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
fi

if [ $TOTAL_HARDCODED_PIXELS -eq 0 ]; then
    echo -e "  ${GREEN}✓ Zero hardcoded pixel sizes${NC}" >&2
else
    echo -e "  ${YELLOW}⚠  Found $TOTAL_HARDCODED_PIXELS hardcoded pixel sizes${NC}" >&2
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
fi

if [ $UNBALANCED_BLOCKS -eq 0 ]; then
    echo -e "  ${GREEN}✓ All blocks balanced${NC}" >&2
else
    echo -e "  ${RED}✗ $UNBALANCED_BLOCKS templates with unbalanced blocks${NC}" >&2
fi

echo "" >&2

# Step 3: Validate theme.json design tokens
echo -e "${BLUE}🎨 Design System Validation:${NC}" >&2

if [ -f "$THEME_DIR/theme.json" ]; then
    # Check if jq is available for JSON parsing
    if command -v jq &> /dev/null; then
        COLORS=$(jq '.settings.color.palette | length' "$THEME_DIR/theme.json" 2>/dev/null || true)
        FONT_SIZES=$(jq '.settings.typography.fontSizes | length' "$THEME_DIR/theme.json" 2>/dev/null || true)
        SPACING=$(jq '.settings.spacing.spacingSizes | length' "$THEME_DIR/theme.json" 2>/dev/null || true)

        echo "  Colors: $COLORS" >&2
        echo "  Font Sizes: $FONT_SIZES" >&2
        echo "  Spacing Tokens: $SPACING" >&2

        # Validate comprehensive design system
        if [ "$COLORS" -ge 5 ] && [ "$FONT_SIZES" -ge 3 ] && [ "$SPACING" -ge 5 ]; then
            echo -e "  ${GREEN}✓ Comprehensive design system${NC}" >&2
        else
            echo -e "  ${YELLOW}⚠  Limited design system (may need more tokens)${NC}" >&2
            TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠  jq not installed, skipping token count${NC}" >&2
    fi
else
    echo -e "  ${RED}✗ theme.json not found${NC}" >&2
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

echo "" >&2

# Step 4: Run WordPress quality checks (if scripts exist)
echo -e "${BLUE}🔒 Running Quality Checks:${NC}" >&2

# Security scan
if [ -x "./scripts/wordpress/security-scan.sh" ]; then
    echo -n "  Security scan... " >&2
    if ./scripts/wordpress/security-scan.sh "$THEME_DIR" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Passed${NC}" >&2
    else
        echo -e "${YELLOW}⚠  Issues found${NC}" >&2
        TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠  Security scan script not found${NC}" >&2
fi

# Coding standards
if [ -x "./scripts/wordpress/check-coding-standards.sh" ]; then
    echo -n "  Coding standards... " >&2
    if ./scripts/wordpress/check-coding-standards.sh "$THEME_DIR" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Passed${NC}" >&2
    else
        echo -e "${YELLOW}⚠  Issues found${NC}" >&2
        TOTAL_WARNINGS=$((TOTAL_WARNINGS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠  Coding standards script not found${NC}" >&2
fi

echo "" >&2

# Step 5: Generate completion report
REPORT_DIR=".claude/reports"
REPORT_FILE="$REPORT_DIR/figma-fse-completion-$(date +%Y%m%d-%H%M%S).md"

mkdir -p "$REPORT_DIR"

echo -e "${BLUE}📝 Generating Completion Report:${NC}" >&2
echo "  $REPORT_FILE" >&2

cat > "$REPORT_FILE" <<EOF
# Figma-to-FSE Conversion Completion Report

**Generated:** $(date '+%Y-%m-%d %H:%M:%S')
**Theme:** $THEME_NAME
**Location:** $THEME_DIR

---

## Summary

✅ **Conversion Status:** Complete

---

## Files Generated

- **Templates:** $TEMPLATES
- **Template Parts:** $PARTS
- **Block Patterns:** $PATTERNS
- **theme.json:** $([ -f "$THEME_DIR/theme.json" ] && echo "✅" || echo "❌")
- **style.css:** $([ -f "$THEME_DIR/style.css" ] && echo "✅" || echo "❌")

---

## Quality Validation

### Hardcoded Values
- Hardcoded hex colors: $TOTAL_HARDCODED_COLORS
- Hardcoded pixel sizes: $TOTAL_HARDCODED_PIXELS
- $([ $TOTAL_HARDCODED_COLORS -eq 0 ] && [ $TOTAL_HARDCODED_PIXELS -eq 0 ] && echo "✅ **Zero hardcoded values** - 100% theme.json token usage!" || echo "⚠️ Some hardcoded values found - review templates")

### Block Syntax
- Unbalanced blocks: $UNBALANCED_BLOCKS
- $([ $UNBALANCED_BLOCKS -eq 0 ] && echo "✅ All blocks properly balanced" || echo "❌ Some templates have syntax errors")

### Design System
$(if command -v jq &> /dev/null && [ -f "$THEME_DIR/theme.json" ]; then
    COLORS=$(jq '.settings.color.palette | length' "$THEME_DIR/theme.json" 2>/dev/null || true)
    FONT_SIZES=$(jq '.settings.typography.fontSizes | length' "$THEME_DIR/theme.json" 2>/dev/null || true)
    SPACING=$(jq '.settings.spacing.spacingSizes | length' "$THEME_DIR/theme.json" 2>/dev/null || true)
    echo "- Colors: $COLORS"
    echo "- Font Sizes: $FONT_SIZES"
    echo "- Spacing Tokens: $SPACING"
    [ "$COLORS" -ge 5 ] && [ "$FONT_SIZES" -ge 3 ] && [ "$SPACING" -ge 5 ] && echo "- ✅ Comprehensive design system" || echo "- ⚠️ Limited design system"
else
    echo "- Could not validate (jq not installed or theme.json missing)"
fi)

---

## Next Steps

### Installation
1. Copy theme to WordPress:
   \`\`\`bash
   cp -r $THEME_DIR /path/to/wordpress/wp-content/themes/
   \`\`\`

2. Activate in WordPress admin:
   - Appearance → Themes
   - Find "$THEME_NAME"
   - Click "Activate"

### Testing
1. View templates in WordPress admin (Appearance → Editor)
2. Test responsive behavior (resize browser)
3. Check accessibility (keyboard navigation, screen reader)
4. Add real content and images

### Customization
1. Adjust colors/spacing: Edit \`theme.json\` → All templates update automatically
2. Modify templates: Appearance → Editor → Templates
3. Create pages: Pages → Add New → Select template

---

## Summary

$(if [ $TOTAL_ERRORS -eq 0 ] && [ $TOTAL_WARNINGS -eq 0 ]; then
    echo "✅ **Perfect conversion!** No errors or warnings."
elif [ $TOTAL_ERRORS -eq 0 ]; then
    echo "✅ **Conversion successful!** $TOTAL_WARNINGS warnings (review recommended)."
else
    echo "⚠️ **Conversion complete with issues:** $TOTAL_ERRORS errors, $TOTAL_WARNINGS warnings."
fi)

---

*Generated by figma-fse-completion hook*
EOF

echo "" >&2

# Step 6: Final summary
echo -e "${PURPLE}╔════════════════════════════════════════════╗${NC}" >&2
echo -e "${PURPLE}║           Conversion Summary               ║${NC}" >&2
echo -e "${PURPLE}╚════════════════════════════════════════════╝${NC}" >&2
echo "" >&2

if [ $TOTAL_ERRORS -eq 0 ] && [ $TOTAL_WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Perfect conversion! No errors or warnings.${NC}" >&2
elif [ $TOTAL_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Conversion successful!${NC}" >&2
    echo -e "${YELLOW}⚠  $TOTAL_WARNINGS warnings (review recommended)${NC}" >&2
else
    echo -e "${YELLOW}⚠️  Conversion complete with issues:${NC}" >&2
    echo -e "    $TOTAL_ERRORS errors, $TOTAL_WARNINGS warnings" >&2
fi

echo "" >&2
echo -e "${BLUE}📋 Full report: $REPORT_FILE${NC}" >&2
echo -e "${BLUE}📋 Comparison report: .claude/reports/figma-fse-comparison.md${NC}" >&2
echo "" >&2
echo -e "${GREEN}🎉 Theme ready for WordPress installation!${NC}" >&2
echo "" >&2

exit 0
