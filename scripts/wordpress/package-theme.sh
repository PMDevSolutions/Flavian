#!/bin/bash
# Package a WordPress theme into a distributable ZIP file
#
# Usage:
#   ./scripts/wordpress/package-theme.sh <theme-name>
#   ./scripts/wordpress/package-theme.sh <theme-name> --validate
#
# Output: dist/<theme-name>.zip

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
THEME_NAME="$1"
VALIDATE=false

if [ -z "$THEME_NAME" ]; then
    echo "Usage: $0 <theme-name> [--validate]"
    echo ""
    echo "Available themes:"
    ls -d "$PROJECT_ROOT/themes"/*/ 2>/dev/null | xargs -I {} basename {} || echo "  (none)"
    exit 1
fi

if [ "$2" = "--validate" ]; then
    VALIDATE=true
fi

THEME_DIR="$PROJECT_ROOT/themes/$THEME_NAME"
DIST_DIR="$PROJECT_ROOT/dist"

if [ ! -d "$THEME_DIR" ]; then
    echo "Theme not found: $THEME_DIR"
    exit 1
fi

# Validate required files
echo "Checking required files..."
if [ ! -f "$THEME_DIR/style.css" ]; then
    echo "Missing required file: style.css"
    exit 1
fi

if [ ! -f "$THEME_DIR/theme.json" ]; then
    echo "Warning: theme.json not found (required for FSE themes)"
fi

# Extract version from style.css
VERSION=$(grep -i '^Version:' "$THEME_DIR/style.css" | sed 's/.*:\s*//' | tr -d '[:space:]')
if [ -z "$VERSION" ]; then
    VERSION="1.0.0"
fi

echo "Theme: $THEME_NAME"
echo "Version: $VERSION"

# Run validation if requested
if [ "$VALIDATE" = true ]; then
    echo ""
    echo "Running validation..."

    ERRORS=0

    # Security scan
    if [ -f "$PROJECT_ROOT/scripts/wordpress/security-scan.sh" ]; then
        for php_file in "$THEME_DIR"/*.php "$THEME_DIR"/**/*.php; do
            if [ -f "$php_file" ]; then
                echo "{\"tool_input\":{\"file_path\":\"$php_file\"}}" | "$PROJECT_ROOT/scripts/wordpress/security-scan.sh" > /dev/null 2>&1
                if [ $? -eq 2 ]; then
                    echo "  Security issue: $php_file"
                    ERRORS=$((ERRORS + 1))
                fi
            fi
        done
    fi

    if [ $ERRORS -gt 0 ]; then
        echo "$ERRORS validation error(s). Fix before packaging."
        exit 1
    fi
    echo "Validation passed."
fi

# Create dist directory
mkdir -p "$DIST_DIR"

# Create ZIP excluding dev files
OUTPUT="$DIST_DIR/${THEME_NAME}-${VERSION}.zip"
echo ""
echo "Creating: $OUTPUT"

cd "$PROJECT_ROOT/themes"
zip -r "$OUTPUT" "$THEME_NAME/" \
    -x "$THEME_NAME/node_modules/*" \
    -x "$THEME_NAME/.git/*" \
    -x "$THEME_NAME/tests/*" \
    -x "$THEME_NAME/*.test.php" \
    -x "$THEME_NAME/.DS_Store" \
    -x "$THEME_NAME/package.json" \
    -x "$THEME_NAME/package-lock.json" \
    -x "$THEME_NAME/pnpm-lock.yaml" \
    -x "$THEME_NAME/.editorconfig" \
    -x "$THEME_NAME/.eslintrc*" \
    -x "$THEME_NAME/.stylelintrc*" \
    > /dev/null

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Package created: $OUTPUT ($SIZE)"
