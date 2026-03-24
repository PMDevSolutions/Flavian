#!/bin/bash
#
# validate-theme-location.sh
# PreToolUse hook: Validates theme files are created in themes/ NOT wp-content/themes/
#
# This hook is triggered BEFORE Write/Edit operations to prevent incorrect file paths
#
# Usage: Called automatically by Claude Code hooks
# Input: Reads CLAUDE_TOOL_INPUT environment variable containing tool parameters
# Exit codes:
#   0 - Path is valid (themes/ at root level)
#   1 - Path is INVALID (wp-content/themes/ detected - BLOCKS operation)
#

set -e

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

# Parse tool input from environment variable
# Expected format: JSON with file_path parameter
TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [ -z "$TOOL_INPUT" ]; then
    # No tool input provided - allow operation (not a file operation)
    exit 0
fi

# Extract file_path from tool input (handles Write, Edit, etc.)
# Try multiple JSON keys: file_path, path, files
FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"\K[^"]+' 2>/dev/null || true)

if [ -z "$FILE_PATH" ]; then
    # Try alternate key: path
    FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"path"\s*:\s*"\K[^"]+' 2>/dev/null || true)
fi

if [ -z "$FILE_PATH" ]; then
    # No file path found - allow operation (not a file write/edit)
    exit 0
fi

# Normalize path to relative path from project root
# Handle both absolute and relative paths
if [[ "$FILE_PATH" == /* ]]; then
    # Absolute path - make relative to PROJECT_ROOT
    FILE_PATH="${FILE_PATH#$PROJECT_ROOT/}"
fi

# Check if path contains wp-content/themes/, wp-content/plugins/, or wp-content/mu-plugins/
if [[ "$FILE_PATH" =~ wp-content/(themes|plugins|mu-plugins)/ ]]; then
    echo "❌ ERROR: Invalid file location detected" >&2
    echo "" >&2
    echo "File path: $FILE_PATH" >&2
    echo "" >&2
    echo "⚠️  This project uses ROOT-LEVEL folders for development:" >&2
    echo "" >&2
    echo "  ✓ CORRECT:   themes/[theme-name]/..." >&2
    echo "  ✓ CORRECT:   plugins/[plugin-name]/..." >&2
    echo "  ✓ CORRECT:   mu-plugins/[plugin-name]/..." >&2
    echo "" >&2
    echo "  ✗ WRONG:     wp-content/themes/[theme-name]/..." >&2
    echo "  ✗ WRONG:     wp-content/plugins/[plugin-name]/..." >&2
    echo "  ✗ WRONG:     wp-content/mu-plugins/[plugin-name]/..." >&2
    echo "" >&2
    echo "Why?" >&2
    echo "  - Cleaner development structure" >&2
    echo "  - Easier version control" >&2
    echo "  - Separation between development and testing environments" >&2
    echo "" >&2
    echo "Deployment:" >&2
    echo "  - Development: Create files in root-level folders (themes/, plugins/, mu-plugins/)" >&2
    echo "  - Testing: Copy files to WordPress wp-content/ (manual step)" >&2
    echo "" >&2
    echo "Fix suggestion:" >&2
    if [[ "$FILE_PATH" =~ wp-content/themes/ ]]; then
        CORRECTED_PATH="${FILE_PATH/wp-content\/themes\//themes/}"
        echo "  Use: $CORRECTED_PATH" >&2
    elif [[ "$FILE_PATH" =~ wp-content/plugins/ ]]; then
        CORRECTED_PATH="${FILE_PATH/wp-content\/plugins\//plugins/}"
        echo "  Use: $CORRECTED_PATH" >&2
    elif [[ "$FILE_PATH" =~ wp-content/mu-plugins/ ]]; then
        CORRECTED_PATH="${FILE_PATH/wp-content\/mu-plugins\//mu-plugins/}"
        echo "  Use: $CORRECTED_PATH" >&2
    fi
    echo "" >&2
    echo "See: CLAUDE.md for complete file structure documentation" >&2
    echo "" >&2
    exit 1
fi

# Path is valid - allow operation
exit 0
