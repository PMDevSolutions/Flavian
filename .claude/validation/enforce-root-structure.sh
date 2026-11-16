#!/bin/bash
#
# enforce-root-structure.sh
# Validates that WordPress development folders exist at root level
# (NOT nested in wp-content/)
#
# Usage: ./enforce-root-structure.sh
# Exit codes:
#   0 - Structure valid (themes/, plugins/, mu-plugins/ at root)
#   1 - Structure invalid (missing folders or files in wp-content/)
#

set -e

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$PROJECT_ROOT"

echo "=== WordPress Root Structure Validation ==="
echo "Project root: $PROJECT_ROOT"
echo ""

# Check for required root-level directories
ERRORS=0

echo "Checking for required root-level directories..."

if [ ! -d "themes" ]; then
    echo "❌ ERROR: themes/ directory not found at project root"
    echo "   Expected: $PROJECT_ROOT/themes/"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ themes/ directory exists at root level"
fi

if [ ! -d "plugins" ]; then
    echo "⚠️  WARNING: plugins/ directory not found at project root"
    echo "   Expected: $PROJECT_ROOT/plugins/"
    echo "   (This is optional, but recommended for plugin development)"
else
    echo "✓ plugins/ directory exists at root level"
fi

if [ ! -d "mu-plugins" ]; then
    echo "⚠️  WARNING: mu-plugins/ directory not found at project root"
    echo "   Expected: $PROJECT_ROOT/mu-plugins/"
    echo "   (This is optional, but recommended for must-use plugins)"
else
    echo "✓ mu-plugins/ directory exists at root level"
fi

echo ""

# Check for wp-content/ subdirectories (should NOT exist during development)
echo "Checking for wp-content/ subdirectories (should NOT exist)..."

if [ -d "wp-content/themes" ] && [ "$(ls -A wp-content/themes 2>/dev/null)" ]; then
    echo "❌ ERROR: wp-content/themes/ directory contains files"
    echo "   Development should use root-level themes/ directory"
    echo "   Files found in: $PROJECT_ROOT/wp-content/themes/"
    ls -la wp-content/themes/
    ERRORS=$((ERRORS + 1))
else
    echo "✓ No files in wp-content/themes/ (correct)"
fi

if [ -d "wp-content/plugins" ] && [ "$(ls -A wp-content/plugins 2>/dev/null)" ]; then
    echo "❌ ERROR: wp-content/plugins/ directory contains files"
    echo "   Development should use root-level plugins/ directory"
    echo "   Files found in: $PROJECT_ROOT/wp-content/plugins/"
    ls -la wp-content/plugins/
    ERRORS=$((ERRORS + 1))
else
    echo "✓ No files in wp-content/plugins/ (correct)"
fi

if [ -d "wp-content/mu-plugins" ] && [ "$(ls -A wp-content/mu-plugins 2>/dev/null)" ]; then
    echo "❌ ERROR: wp-content/mu-plugins/ directory contains files"
    echo "   Development should use root-level mu-plugins/ directory"
    echo "   Files found in: $PROJECT_ROOT/wp-content/mu-plugins/"
    ls -la wp-content/mu-plugins/
    ERRORS=$((ERRORS + 1))
else
    echo "✓ No files in wp-content/mu-plugins/ (correct)"
fi

echo ""

# Summary
if [ $ERRORS -eq 0 ]; then
    echo "✅ SUCCESS: WordPress root structure is valid"
    echo ""
    echo "Summary:"
    echo "  - Root-level directories: ✓ Present"
    echo "  - wp-content/ subdirectories: ✓ Empty (correct for development)"
    echo ""
    echo "Development files should be created in:"
    echo "  - $PROJECT_ROOT/themes/"
    echo "  - $PROJECT_ROOT/plugins/"
    echo "  - $PROJECT_ROOT/mu-plugins/"
    echo ""
    exit 0
else
    echo "❌ FAILED: WordPress root structure has $ERRORS error(s)"
    echo ""
    echo "Fix required:"
    echo "  1. Create missing root-level directories (themes/, plugins/, mu-plugins/)"
    echo "  2. Move files from wp-content/ subdirectories to root-level directories"
    echo "  3. Re-run this validation script"
    echo ""
    echo "Example fix:"
    echo "  mkdir -p themes plugins mu-plugins"
    echo "  [ -d wp-content/themes ] && mv wp-content/themes/* themes/ 2>/dev/null || true"
    echo "  [ -d wp-content/plugins ] && mv wp-content/plugins/* plugins/ 2>/dev/null || true"
    echo ""
    exit 1
fi
