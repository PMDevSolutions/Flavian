#!/bin/bash
# Figma FSE Batch Template Converter
# Validates batch conversion process and tracks multi-template progress
# Used by Phase 2 multi-template orchestration

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
THEME_DIR=""
TOTAL_TEMPLATES=0
COMPLETED_TEMPLATES=0
FAILED_TEMPLATES=0
CHECKPOINT_INTERVAL=3

# Read JSON input from stdin (if provided by tool)
INPUT=$(cat)

# Extract parameters if provided
if [ ! -z "$INPUT" ]; then
    THEME_DIR=$(echo "$INPUT" | jq -r '.tool_input.theme_dir // empty' 2>/dev/null)
    TOTAL_TEMPLATES=$(echo "$INPUT" | jq -r '.tool_input.total_templates // 0' 2>/dev/null)
    COMPLETED_TEMPLATES=$(echo "$INPUT" | jq -r '.tool_input.completed_templates // 0' 2>/dev/null)
fi

# Allow command-line override
if [ "$1" ]; then
    THEME_DIR="$1"
fi

if [ "$2" ]; then
    TOTAL_TEMPLATES="$2"
fi

if [ "$3" ]; then
    COMPLETED_TEMPLATES="$3"
fi

# Validate theme directory
if [ -z "$THEME_DIR" ]; then
    echo -e "${RED}❌ No theme directory specified${NC}" >&2
    exit 0
fi

if [ ! -d "$THEME_DIR" ]; then
    echo -e "${RED}❌ Theme directory not found: $THEME_DIR${NC}" >&2
    exit 0
fi

echo -e "${BLUE}📦 Batch Conversion Validation${NC}" >&2
echo -e "${BLUE}Theme: $THEME_DIR${NC}" >&2
echo "" >&2

# Count actual template files
ACTUAL_TEMPLATES=$(find "$THEME_DIR/templates" -name "*.html" 2>/dev/null | wc -l)
TEMPLATE_PARTS=$(find "$THEME_DIR/parts" -name "*.html" 2>/dev/null | wc -l)

echo -e "${BLUE}📊 Progress Statistics:${NC}" >&2
echo "  Total templates expected: $TOTAL_TEMPLATES" >&2
echo "  Templates completed: $COMPLETED_TEMPLATES" >&2
echo "  Templates found: $ACTUAL_TEMPLATES" >&2
echo "  Template parts found: $TEMPLATE_PARTS" >&2
echo "" >&2

# Check if checkpoint is needed
if [ $COMPLETED_TEMPLATES -gt 0 ]; then
    CHECKPOINT_DUE=$((COMPLETED_TEMPLATES % CHECKPOINT_INTERVAL))
    if [ $CHECKPOINT_DUE -eq 0 ]; then
        echo -e "${YELLOW}📌 Checkpoint recommended (every $CHECKPOINT_INTERVAL templates)${NC}" >&2
        echo "  Save state to episodic memory" >&2
        echo "" >&2
    fi
fi

# Calculate progress percentage
if [ $TOTAL_TEMPLATES -gt 0 ]; then
    PROGRESS=$((COMPLETED_TEMPLATES * 100 / TOTAL_TEMPLATES))
    echo -e "${GREEN}Progress: $PROGRESS% ($COMPLETED_TEMPLATES / $TOTAL_TEMPLATES)${NC}" >&2

    # Visual progress bar
    BAR_LENGTH=20
    FILLED=$((PROGRESS * BAR_LENGTH / 100))
    EMPTY=$((BAR_LENGTH - FILLED))

    printf "  [" >&2
    printf "%${FILLED}s" | tr ' ' '=' >&2
    printf "%${EMPTY}s" | tr ' ' ' ' >&2
    printf "]\n" >&2
    echo "" >&2
fi

# Validate each template file
echo -e "${BLUE}🔍 Validating Template Files:${NC}" >&2

if [ -d "$THEME_DIR/templates" ]; then
    for template in "$THEME_DIR/templates"/*.html; do
        if [ -f "$template" ]; then
            TEMPLATE_NAME=$(basename "$template")

            # Check for hardcoded hex colors
            HARDCODED_COLORS=$(grep -c '#[0-9A-Fa-f]\{6\}' "$template" 2>/dev/null || echo "0")

            # Check block balance
            OPEN_BLOCKS=$(grep -o '<!-- wp:' "$template" 2>/dev/null | wc -l)
            CLOSE_BLOCKS=$(grep -o '<!-- /wp:' "$template" 2>/dev/null | wc -l)

            if [ "$HARDCODED_COLORS" -gt 0 ]; then
                echo -e "  ${YELLOW}⚠  $TEMPLATE_NAME: $HARDCODED_COLORS hardcoded colors found${NC}" >&2
                FAILED_TEMPLATES=$((FAILED_TEMPLATES + 1))
            elif [ "$OPEN_BLOCKS" -ne "$CLOSE_BLOCKS" ]; then
                echo -e "  ${YELLOW}⚠  $TEMPLATE_NAME: Unbalanced blocks ($OPEN_BLOCKS open, $CLOSE_BLOCKS close)${NC}" >&2
                FAILED_TEMPLATES=$((FAILED_TEMPLATES + 1))
            else
                echo -e "  ${GREEN}✓ $TEMPLATE_NAME: Valid ($OPEN_BLOCKS blocks)${NC}" >&2
            fi
        fi
    done
fi

echo "" >&2

# Check for theme.json
if [ -f "$THEME_DIR/theme.json" ]; then
    echo -e "${GREEN}✓ theme.json found${NC}" >&2

    # Count design tokens
    if command -v jq &> /dev/null; then
        COLORS=$(jq '.settings.color.palette | length' "$THEME_DIR/theme.json" 2>/dev/null || echo "?")
        FONT_SIZES=$(jq '.settings.typography.fontSizes | length' "$THEME_DIR/theme.json" 2>/dev/null || echo "?")
        SPACING=$(jq '.settings.spacing.spacingSizes | length' "$THEME_DIR/theme.json" 2>/dev/null || echo "?")

        echo "  Colors: $COLORS" >&2
        echo "  Font Sizes: $FONT_SIZES" >&2
        echo "  Spacing Tokens: $SPACING" >&2
    fi
else
    echo -e "${RED}❌ theme.json not found${NC}" >&2
fi

echo "" >&2

# Summary
echo -e "${BLUE}📋 Batch Conversion Summary:${NC}" >&2
if [ $FAILED_TEMPLATES -eq 0 ]; then
    echo -e "${GREEN}✅ All templates valid${NC}" >&2
else
    echo -e "${YELLOW}⚠  $FAILED_TEMPLATES templates have issues${NC}" >&2
fi

# Check if conversion complete
TEMPLATES_REMAINING=$((TOTAL_TEMPLATES - COMPLETED_TEMPLATES))
if [ $TEMPLATES_REMAINING -gt 0 ]; then
    echo -e "${BLUE}➡️  $TEMPLATES_REMAINING templates remaining${NC}" >&2
    echo "" >&2
    echo -e "${BLUE}Continue with next template (autonomous)${NC}" >&2
else
    echo -e "${GREEN}🎉 All templates complete!${NC}" >&2
    echo "" >&2
    echo -e "${BLUE}Run completion hook: .claude/hooks/figma-fse-completion.sh${NC}" >&2
fi

exit 0
