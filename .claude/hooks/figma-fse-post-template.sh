#!/bin/bash
# Figma-to-FSE Post-Template Hook
# Runs after each FSE template creation to validate syntax and quality
# Part of the figma-fse-converter agent workflow
#
# Input: the hook event as JSON on stdin (a Write/Edit event). Output to stderr;
# always exits 0.
set -u
trap 'exit 0' ERR

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only process HTML template files in themes directory
if [[ ! "$FILE_PATH" =~ themes/.*/templates/.*\.html$ ]]; then
    exit 0
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

echo "" >&2
echo "🎯 Post-Template Validation: $(basename "$FILE_PATH")" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

# Run template validation
if [ -x "./scripts/figma-fse/validate-template.sh" ]; then
    echo "$INPUT" | ./scripts/figma-fse/validate-template.sh
fi

# Run security scan
if [ -x "./scripts/wordpress/security-scan.sh" ]; then
    echo "$INPUT" | ./scripts/wordpress/security-scan.sh
fi

# Run coding standards check
if [ -x "./scripts/wordpress/check-coding-standards.sh" ]; then
    echo "$INPUT" | ./scripts/wordpress/check-coding-standards.sh
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

# Always exit 0 (warn, don't block)
exit 0
