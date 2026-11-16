#!/bin/bash
# Block Markup Validator - PostToolUse hook
# Validates WordPress block comment syntax and HTML class consistency
# Exit 0 (warn) - displays issues but doesn't block

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only check template HTML and pattern PHP files in themes/
if [[ ! "$FILE_PATH" =~ themes/.*\.(html|php)$ ]]; then
    exit 0
fi

if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

ISSUES=0

# --- Check 1: Block tag balance ---
OPEN_BLOCKS=$(grep -c '<!-- wp:[a-z]' "$FILE_PATH" 2>/dev/null || echo "0")
CLOSE_BLOCKS=$(grep -c '<!-- /wp:' "$FILE_PATH" 2>/dev/null || echo "0")
SELF_CLOSING=$(grep -c '<!-- wp:[a-z][^-]*/-->' "$FILE_PATH" 2>/dev/null || echo "0")

EXPECTED_CLOSE=$((OPEN_BLOCKS - SELF_CLOSING))
if [ "$EXPECTED_CLOSE" -ne "$CLOSE_BLOCKS" ]; then
    echo "  ❌ Unbalanced blocks: $OPEN_BLOCKS opening (${SELF_CLOSING} self-closing), $CLOSE_BLOCKS closing" >&2
    ISSUES=$((ISSUES + 1))
fi

# --- Check 2: backgroundColor without matching class ---
while IFS= read -r line_num_and_content; do
    LINE_NUM=$(echo "$line_num_and_content" | cut -d: -f1)
    # Extract the backgroundColor slug
    SLUG=$(echo "$line_num_and_content" | grep -oP '"backgroundColor"\s*:\s*"\K[^"]+' 2>/dev/null)
    if [ -n "$SLUG" ]; then
        # Look at the next HTML line for the matching class
        NEXT_LINES=$(sed -n "$((LINE_NUM)),+3p" "$FILE_PATH" 2>/dev/null)
        if ! echo "$NEXT_LINES" | grep -q "has-${SLUG}-background-color" 2>/dev/null; then
            echo "  ⚠️  Line $LINE_NUM: backgroundColor \"$SLUG\" but missing has-${SLUG}-background-color class" >&2
            ISSUES=$((ISSUES + 1))
        fi
    fi
done < <(grep -n '"backgroundColor"' "$FILE_PATH" 2>/dev/null || true)

# --- Check 3: textColor without matching class ---
while IFS= read -r line_num_and_content; do
    LINE_NUM=$(echo "$line_num_and_content" | cut -d: -f1)
    SLUG=$(echo "$line_num_and_content" | grep -oP '"textColor"\s*:\s*"\K[^"]+' 2>/dev/null)
    if [ -n "$SLUG" ]; then
        NEXT_LINES=$(sed -n "$((LINE_NUM)),+3p" "$FILE_PATH" 2>/dev/null)
        if ! echo "$NEXT_LINES" | grep -q "has-${SLUG}-color" 2>/dev/null; then
            echo "  ⚠️  Line $LINE_NUM: textColor \"$SLUG\" but missing has-${SLUG}-color class" >&2
            ISSUES=$((ISSUES + 1))
        fi
    fi
done < <(grep -n '"textColor"' "$FILE_PATH" 2>/dev/null || true)

# --- Check 4: fontSize without matching class ---
while IFS= read -r line_num_and_content; do
    LINE_NUM=$(echo "$line_num_and_content" | cut -d: -f1)
    SLUG=$(echo "$line_num_and_content" | grep -oP '"fontSize"\s*:\s*"\K[^"]+' 2>/dev/null)
    if [ -n "$SLUG" ]; then
        NEXT_LINES=$(sed -n "$((LINE_NUM)),+3p" "$FILE_PATH" 2>/dev/null)
        if ! echo "$NEXT_LINES" | grep -q "has-${SLUG}-font-size" 2>/dev/null; then
            echo "  ⚠️  Line $LINE_NUM: fontSize \"$SLUG\" but missing has-${SLUG}-font-size class" >&2
            ISSUES=$((ISSUES + 1))
        fi
    fi
done < <(grep -n '"fontSize"' "$FILE_PATH" 2>/dev/null || true)

# --- Check 5: wp-element-button class on non-button elements ---
if grep -n 'wp-element-button' "$FILE_PATH" | grep -v 'wp-block-button' > /dev/null 2>&1; then
    echo "  ❌ Found wp-element-button class on non-button element" >&2
    grep -n 'wp-element-button' "$FILE_PATH" | grep -v 'wp-block-button' | head -3 | while read line; do
        echo "     $line" >&2
    done
    ISSUES=$((ISSUES + 1))
fi

# --- Check 6: Heading level mismatch ---
while IFS= read -r line; do
    LINE_NUM=$(echo "$line" | cut -d: -f1)
    JSON_LEVEL=$(echo "$line" | grep -oP '"level"\s*:\s*\K[0-9]+' 2>/dev/null)
    if [ -n "$JSON_LEVEL" ]; then
        NEXT_LINES=$(sed -n "$((LINE_NUM)),+2p" "$FILE_PATH" 2>/dev/null)
        HTML_TAG=$(echo "$NEXT_LINES" | grep -oP '<h\K[0-9]' 2>/dev/null | head -1)
        if [ -n "$HTML_TAG" ] && [ "$JSON_LEVEL" != "$HTML_TAG" ]; then
            echo "  ❌ Line $LINE_NUM: Block says level:$JSON_LEVEL but HTML is <h$HTML_TAG>" >&2
            ISSUES=$((ISSUES + 1))
        fi
    fi
done < <(grep -n '"level"' "$FILE_PATH" 2>/dev/null || true)

# --- Check 7: Theme.json slug validation (if theme.json exists) ---
THEME_DIR=$(echo "$FILE_PATH" | grep -oP 'themes/[^/]+' 2>/dev/null)
THEME_JSON="$THEME_DIR/theme.json"

if [ -f "$THEME_JSON" ] && command -v jq &> /dev/null; then
    # Get valid color slugs
    VALID_COLORS=$(jq -r '.settings.color.palette[]?.slug // empty' "$THEME_JSON" 2>/dev/null | tr '\n' '|')
    VALID_COLORS="${VALID_COLORS}transparent"  # transparent is always valid

    # Check backgroundColor slugs
    for slug in $(grep -oP '"backgroundColor"\s*:\s*"\K[^"]+' "$FILE_PATH" 2>/dev/null); do
        if ! echo "$VALID_COLORS" | grep -qw "$slug"; then
            echo "  ⚠️  backgroundColor \"$slug\" not found in theme.json palette" >&2
            ISSUES=$((ISSUES + 1))
        fi
    done

    # Check textColor slugs
    for slug in $(grep -oP '"textColor"\s*:\s*"\K[^"]+' "$FILE_PATH" 2>/dev/null); do
        if ! echo "$VALID_COLORS" | grep -qw "$slug"; then
            echo "  ⚠️  textColor \"$slug\" not found in theme.json palette" >&2
            ISSUES=$((ISSUES + 1))
        fi
    done

    # Get valid fontSize slugs
    VALID_SIZES=$(jq -r '.settings.typography.fontSizes[]?.slug // empty' "$THEME_JSON" 2>/dev/null | tr '\n' '|')
    for slug in $(grep -oP '"fontSize"\s*:\s*"\K[^"]+' "$FILE_PATH" 2>/dev/null); do
        if ! echo "$VALID_SIZES" | grep -qw "$slug"; then
            echo "  ⚠️  fontSize \"$slug\" not found in theme.json fontSizes" >&2
            ISSUES=$((ISSUES + 1))
        fi
    done
fi

# --- Summary ---
if [ $ISSUES -eq 0 ]; then
    echo "  ✅ Block markup validation passed: $(basename "$FILE_PATH")" >&2
else
    echo "  ⚠️  $ISSUES issue(s) found in $(basename "$FILE_PATH")" >&2
fi

exit 0
