#!/bin/bash
# PostToolUse Hook: Lint and format written/edited files
# Runs after frontend-developer agent writes or edits files
#
# Exit 0: Warnings only (non-blocking)
# Exit 2: Critical issues (blocking)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# No file path = not a file operation
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Get file extension
EXT="${FILE_PATH##*.}"

case "$EXT" in
    php)
        # Run PHPCS if available
        if [ -f "./vendor/bin/phpcs" ]; then
            RESULT=$(./vendor/bin/phpcs --standard=WordPress --severity=1 "$FILE_PATH" 2>&1)
            if [ $? -ne 0 ]; then
                echo "WordPress Coding Standards issues in: $FILE_PATH" >&2
                echo "$RESULT" >&2
            fi
        fi
        # Run security scan
        if [ -f "./scripts/wordpress/security-scan.sh" ]; then
            echo "$INPUT" | ./scripts/wordpress/security-scan.sh
            if [ $? -eq 2 ]; then
                exit 2
            fi
        fi
        ;;
    css)
        # Check for hardcoded colors (should use CSS custom properties)
        if grep -nE '#[0-9a-fA-F]{3,8}' "$FILE_PATH" 2>/dev/null | grep -v '^\s*//' | grep -v '^\s*\*'; then
            echo "CSS contains hardcoded color values. Use CSS custom properties from theme.json instead." >&2
        fi
        ;;
    js)
        # Basic JS checks - warn about console.log in production code
        if grep -n 'console\.log' "$FILE_PATH" 2>/dev/null; then
            echo "JavaScript contains console.log statements. Remove before production." >&2
        fi
        ;;
esac

exit 0
