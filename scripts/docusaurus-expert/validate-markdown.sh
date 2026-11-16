#!/bin/bash
# Markdown/MDX Validator
# Validates markdown and MDX syntax
# Exit 0 (warn) - displays issues but doesn't block

# Read JSON input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check markdown and MDX files
if [[ ! "$FILE_PATH" =~ \.(md|mdx)$ ]]; then
    exit 0
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

echo "🔍 Validating markdown file: $FILE_PATH" >&2

WARNINGS=()

# Check for common markdown issues
CONTENT=$(cat "$FILE_PATH")

# Check for broken internal links
if echo "$CONTENT" | grep -E '\[.*\]\(\.\/[^)]+\)' > /dev/null; then
    # Extract internal links
    LINKS=$(echo "$CONTENT" | grep -oE '\]\([^)]+\)' | sed 's/](\(.*\))/\1/' | grep '^\.')

    for link in $LINKS; do
        # Resolve relative path
        DIR=$(dirname "$FILE_PATH")
        LINK_PATH="$DIR/$link"

        if [[ ! -f "$LINK_PATH" ]] && [[ ! -d "$LINK_PATH" ]]; then
            WARNINGS+=("Broken link: $link")
        fi
    done
fi

# Check for MDX-specific issues
if [[ "$FILE_PATH" =~ \.mdx$ ]]; then
    # Check for unclosed JSX tags
    OPEN_TAGS=$(echo "$CONTENT" | grep -oE '<[A-Z][a-zA-Z0-9]*[^/>]*>' | wc -l)
    CLOSE_TAGS=$(echo "$CONTENT" | grep -oE '</[A-Z][a-zA-Z0-9]*>' | wc -l)

    if [ "$OPEN_TAGS" -ne "$CLOSE_TAGS" ]; then
        WARNINGS+=("Potential unclosed JSX tags (open: $OPEN_TAGS, close: $CLOSE_TAGS)")
    fi

    # Check for missing imports for components
    if echo "$CONTENT" | grep -E '<[A-Z][a-zA-Z0-9]*' > /dev/null; then
        if ! echo "$CONTENT" | grep -E '^import.*from' > /dev/null; then
            WARNINGS+=("MDX file uses components but has no imports")
        fi
    fi
fi

# Check for broken image references
if echo "$CONTENT" | grep -E '!\[.*\]\([^)]+\)' > /dev/null; then
    IMAGES=$(echo "$CONTENT" | grep -oE '!\[.*\]\([^)]+\)' | grep -oE '\([^)]+\)' | sed 's/[\(\)]//g')

    for img in $IMAGES; do
        # Skip external URLs
        if [[ "$img" =~ ^https?:// ]]; then
            continue
        fi

        # Check if image exists
        DIR=$(dirname "$FILE_PATH")
        IMG_PATH="$DIR/$img"

        if [[ ! -f "$IMG_PATH" ]]; then
            WARNINGS+=("Missing image: $img")
        fi
    done
fi

# Display warnings
if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "" >&2
    echo "⚠️  Markdown validation warnings:" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "  ⚠️  $warning" >&2
    done
    echo "" >&2
fi

# Check markdown syntax with markdownlint if available
if command -v markdownlint &> /dev/null || [ -f "node_modules/.bin/markdownlint" ]; then
    echo "  Running markdownlint..." >&2
    OUTPUT=$(npx markdownlint "$FILE_PATH" 2>&1 || true)

    if [ -n "$OUTPUT" ]; then
        echo "$OUTPUT" >&2
    fi
fi

# Always exit 0 (warn, don't block)
exit 0
