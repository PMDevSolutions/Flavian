#!/bin/bash
# Install Playwright and browser engines for cross-browser testing
#
# Usage:
#   ./scripts/setup-playwright.sh          # Install all browsers
#   ./scripts/setup-playwright.sh chromium # Install Chromium only
#   ./scripts/setup-playwright.sh firefox  # Install Firefox only
#   ./scripts/setup-playwright.sh webkit   # Install WebKit only
#
# Requirements: Node.js 18+, npx

set -e

BROWSER="${1:-all}"

echo "=== Playwright Cross-Browser Setup ==="
echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ is required. Current: $(node -v 2>/dev/null || echo 'not installed')"
    exit 1
fi
echo "Node.js: $(node -v)"

# Install @playwright/mcp if not already available
echo ""
echo "Checking @playwright/mcp..."
if npx @playwright/mcp@latest --help > /dev/null 2>&1; then
    echo "  @playwright/mcp is available"
else
    echo "  Installing @playwright/mcp..."
    npm install -g @playwright/mcp@latest
fi

# Install browser engines
echo ""
echo "Installing browser engines..."

case "$BROWSER" in
    chromium)
        npx playwright install chromium
        echo "  Chromium installed"
        ;;
    firefox)
        npx playwright install firefox
        echo "  Firefox installed"
        ;;
    webkit)
        npx playwright install webkit
        echo "  WebKit (Safari engine) installed"
        ;;
    all)
        npx playwright install chromium
        echo "  Chromium installed"
        npx playwright install firefox
        echo "  Firefox installed"
        npx playwright install webkit
        echo "  WebKit (Safari engine) installed"
        ;;
    *)
        echo "Unknown browser: $BROWSER"
        echo "Options: chromium, firefox, webkit, all"
        exit 1
        ;;
esac

# Install system dependencies (Linux only)
if [ "$(uname)" = "Linux" ]; then
    echo ""
    echo "Installing system dependencies for Linux..."
    npx playwright install-deps
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Browsers available for cross-browser testing:"
echo "  - Chromium (Chrome/Edge equivalent)"
echo "  - Firefox (Gecko engine)"
echo "  - WebKit (Safari engine)"
echo ""
echo "The Playwright MCP server in .mcp.json defaults to Chromium."
echo "Use scripts/cross-browser-test.sh to test with other browsers."
