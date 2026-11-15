#!/bin/bash
# Docusaurus Build Checker
# Runs Docusaurus build to check for errors
# Exit 0 (warn) - displays build errors but doesn't block

# Read JSON input from stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check if this is a Docusaurus project
if [ ! -f "docusaurus.config.js" ] && [ ! -f "docusaurus.config.ts" ]; then
    exit 0
fi

# Skip if this was already a build command
if echo "$COMMAND" | grep -qE '(build|npm run build|pnpm build)'; then
    exit 0
fi

echo "🏗️  Checking Docusaurus build..." >&2

# Determine package manager
if [ -f "pnpm-lock.yaml" ]; then
    PKG_MANAGER="pnpm"
elif [ -f "yarn.lock" ]; then
    PKG_MANAGER="yarn"
else
    PKG_MANAGER="npm"
fi

# Run build
BUILD_OUTPUT=$($PKG_MANAGER run build 2>&1)
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ Docusaurus build successful" >&2

    # Check build size
    if [ -d "build" ]; then
        BUILD_SIZE=$(du -sh build 2>/dev/null | cut -f1)
        echo "   Build size: $BUILD_SIZE" >&2
    fi
else
    echo "" >&2
    echo "❌ Docusaurus build failed:" >&2
    echo "$BUILD_OUTPUT" | tail -n 30 >&2
    echo "" >&2
    echo "⚠️  Please fix build errors before deploying" >&2

    # Try to identify common issues
    if echo "$BUILD_OUTPUT" | grep -q "Module not found"; then
        echo "   Hint: Missing module detected. Run: $PKG_MANAGER install" >&2
    fi

    if echo "$BUILD_OUTPUT" | grep -q "Broken link"; then
        echo "   Hint: Broken links detected. Check markdown link paths." >&2
    fi

    if echo "$BUILD_OUTPUT" | grep -q "Duplicate route"; then
        echo "   Hint: Duplicate routes detected. Check for duplicate slugs/paths." >&2
    fi
fi

# Always exit 0 (warn, don't block)
exit 0
