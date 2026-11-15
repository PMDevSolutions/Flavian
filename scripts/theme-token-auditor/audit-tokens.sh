#!/bin/bash
# Theme Token Auditor - PostToolUse hook
# Detects hardcoded values that should use theme.json tokens
# Exit 0 (warn) - displays issues but doesn't block

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only check template/pattern files in themes/
if [[ ! "$FILE_PATH" =~ themes/.*\.(html|php)$ ]]; then
    exit 0
fi

if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

ISSUES=0
BASENAME=$(basename "$FILE_PATH")

# --- Check 1: Hardcoded hex colors in style attributes ---
# Match hex colors in style="" attributes (not in block comment JSON)
HEX_IN_STYLES=$(grep -n 'style="[^"]*#[0-9A-Fa-f]\{3,8\}' "$FILE_PATH" 2>/dev/null | wc -l)
if [ "$HEX_IN_STYLES" -gt 0 ]; then
    echo "  ⚠️  $BASENAME: $HEX_IN_STYLES hardcoded hex color(s) in style attributes" >&2
    grep -n 'style="[^"]*#[0-9A-Fa-f]\{3,8\}' "$FILE_PATH" 2>/dev/null | head -3 | while read line; do
        echo "     $line" >&2
    done
    ISSUES=$((ISSUES + HEX_IN_STYLES))
fi

# --- Check 2: Hardcoded hex colors in block JSON (outside of border-color which is acceptable) ---
HEX_IN_JSON=$(grep -oP '<!-- wp:[^>]+"[^"]*#[0-9A-Fa-f]{6}[^"]*"' "$FILE_PATH" 2>/dev/null | grep -v '"border"' | wc -l)
if [ "$HEX_IN_JSON" -gt 0 ]; then
    echo "  ⚠️  $BASENAME: $HEX_IN_JSON hardcoded hex color(s) in block JSON attributes" >&2
    ISSUES=$((ISSUES + HEX_IN_JSON))
fi

# --- Check 3: Hardcoded pixel spacing (padding/margin in styles, not border-width) ---
HARDCODED_SPACING=$(grep -oP 'style="[^"]*(?:padding|margin|gap)[^"]*?[0-9]+px' "$FILE_PATH" 2>/dev/null | wc -l)
if [ "$HARDCODED_SPACING" -gt 0 ]; then
    echo "  ⚠️  $BASENAME: $HARDCODED_SPACING hardcoded px spacing value(s) — should use var(--wp--preset--spacing--XX)" >&2
    ISSUES=$((ISSUES + HARDCODED_SPACING))
fi

# --- Check 4: Hardcoded font-size in styles ---
HARDCODED_FONT=$(grep -oP 'style="[^"]*font-size:\s*[0-9]+px' "$FILE_PATH" 2>/dev/null | wc -l)
if [ "$HARDCODED_FONT" -gt 0 ]; then
    echo "  ⚠️  $BASENAME: $HARDCODED_FONT hardcoded font-size(s) — should use fontSize preset slug" >&2
    ISSUES=$((ISSUES + HARDCODED_FONT))
fi

# --- Check 5: Hardcoded font-family in styles ---
HARDCODED_FAMILY=$(grep -oP 'style="[^"]*font-family:' "$FILE_PATH" 2>/dev/null | wc -l)
if [ "$HARDCODED_FAMILY" -gt 0 ]; then
    echo "  ⚠️  $BASENAME: $HARDCODED_FAMILY hardcoded font-family — should use fontFamily preset slug" >&2
    ISSUES=$((ISSUES + HARDCODED_FAMILY))
fi

# --- Summary ---
if [ $ISSUES -eq 0 ]; then
    echo "  ✅ Token audit passed: $BASENAME (zero hardcoded values)" >&2
else
    echo "  ⚠️  Token audit: $ISSUES hardcoded value(s) in $BASENAME" >&2
fi

exit 0
