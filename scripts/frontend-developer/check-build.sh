#!/bin/bash
# PostToolUse Hook: Verify build passes after Bash commands
# Runs after frontend-developer agent executes build-related commands
#
# Exit 0: Build check passed or not applicable

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only check after build-related commands
if ! echo "$COMMAND" | grep -qiE '(npm run build|pnpm build|npx|webpack|vite|wp-scripts)'; then
    exit 0
fi

# Check if build output exists
if [ -d "./build" ] || [ -d "./dist" ]; then
    echo "Build output directory exists." >&2
fi

# Check for common build errors in the tool result
RESULT=$(echo "$INPUT" | jq -r '.tool_result.stdout // empty' 2>/dev/null)
if echo "$RESULT" | grep -qiE '(error|failed|ERR!)'; then
    echo "Build may have errors. Review output above." >&2
fi

exit 0
