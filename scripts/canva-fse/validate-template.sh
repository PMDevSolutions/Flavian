#!/bin/bash
# FSE Template Validator
# Validates WordPress FSE template files for correct block syntax and token usage
# Checks for hardcoded values and ensures theme.json token references

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only check HTML template files
if [[ ! "$FILE_PATH" =~ \.html$ ]]; then
    exit 0
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

echo "🔍 Validating FSE template: $FILE_PATH" >&2

ISSUES_FOUND=0

# Check for hardcoded hex colors
if grep -q '#[0-9A-Fa-f]\{6\}' "$FILE_PATH"; then
    echo "" >&2
    echo "❌ Found hardcoded hex colors in template" >&2
    echo "   Templates should use theme.json color slugs:" >&2
    echo "   ✅ \"backgroundColor\": \"primary\"" >&2
    echo "   ❌ \"backgroundColor\": \"#0066CC\"" >&2
    echo "" >&2
    grep -n '#[0-9A-Fa-f]\{6\}' "$FILE_PATH" | head -5 | while read line; do
        echo "   $line" >&2
    done
    ISSUES_FOUND=1
fi

# Check for hardcoded pixel sizes
if grep -qE ':\s*"[0-9]+px"' "$FILE_PATH"; then
    echo "" >&2
    echo "⚠️  Found hardcoded pixel sizes in template" >&2
    echo "   Consider using theme.json spacing tokens:" >&2
    echo "   ✅ \"var(--wp--preset--spacing--50)\"" >&2
    echo "   ❌ \"32px\"" >&2
    echo "" >&2
    grep -nE ':\s*"[0-9]+px"' "$FILE_PATH" | head -5 | while read line; do
        echo "   $line" >&2
    done
    ISSUES_FOUND=1
fi

# Check for proper WordPress block comment syntax
if ! grep -q '<!-- wp:' "$FILE_PATH"; then
    echo "" >&2
    echo "⚠️  No WordPress block comments found" >&2
    echo "   FSE templates should use block syntax:" >&2
    echo "   <!-- wp:group -->...<!-- /wp:group -->" >&2
    ISSUES_FOUND=1
fi

# Check for unclosed blocks
OPEN_BLOCKS=$(grep -o '<!-- wp:[a-zA-Z/-]*' "$FILE_PATH" | wc -l)
CLOSE_BLOCKS=$(grep -o '<!-- /wp:[a-zA-Z/-]*' "$FILE_PATH" | wc -l)

if [ "$OPEN_BLOCKS" -ne "$CLOSE_BLOCKS" ]; then
    echo "" >&2
    echo "❌ Mismatched block tags" >&2
    echo "   Opening blocks: $OPEN_BLOCKS" >&2
    echo "   Closing blocks: $CLOSE_BLOCKS" >&2
    echo "   Every <!-- wp:block --> must have <!-- /wp:block -->" >&2
    ISSUES_FOUND=1
fi

# Check for invalid JSON in block attributes
TEMP_FILE=$(mktemp)
grep -o '{[^}]*}' "$FILE_PATH" > "$TEMP_FILE"

INVALID_JSON=0
while IFS= read -r json; do
    if [ -n "$json" ]; then
        if ! echo "$json" | jq empty 2>/dev/null; then
            INVALID_JSON=1
            break
        fi
    fi
done < "$TEMP_FILE"
rm -f "$TEMP_FILE"

if [ "$INVALID_JSON" -eq 1 ]; then
    echo "" >&2
    echo "❌ Found invalid JSON in block attributes" >&2
    echo "   Block attributes must be valid JSON" >&2
    ISSUES_FOUND=1
fi

# Count blocks used
BLOCK_COUNT=$(grep -o '<!-- wp:[a-zA-Z/-]*' "$FILE_PATH" | wc -l)
echo "" >&2
echo "📊 Template Statistics:" >&2
echo "   Blocks used: $BLOCK_COUNT" >&2

# Check for common FSE blocks
COMMON_BLOCKS=("wp:group" "wp:heading" "wp:paragraph" "wp:image" "wp:button")
for block in "${COMMON_BLOCKS[@]}"; do
    COUNT=$(grep -o "<!-- $block" "$FILE_PATH" | wc -l)
    if [ "$COUNT" -gt 0 ]; then
        echo "   $block: $COUNT" >&2
    fi
done

if [ "$ISSUES_FOUND" -eq 0 ]; then
    echo "" >&2
    echo "✅ Template validation passed" >&2
else
    echo "" >&2
    echo "Template has issues. Please review and fix." >&2
fi

# Always exit 0 (warn, don't block)
exit 0
