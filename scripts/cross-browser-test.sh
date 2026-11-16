#!/bin/bash
# Cross-browser screenshot capture using Playwright
#
# Usage:
#   ./scripts/cross-browser-test.sh <browser> <url> [breakpoints]
#   ./scripts/cross-browser-test.sh firefox http://localhost:8080
#   ./scripts/cross-browser-test.sh webkit http://localhost:8080
#   ./scripts/cross-browser-test.sh firefox http://localhost:8080 "1920,1440,768,375"
#
# Captures screenshots at all breakpoints for the specified browser engine.
# Results saved to .claude/visual-qa/screenshots/wordpress/<browser>/
#
# Browsers: chromium, firefox, webkit

set -e

BROWSER="${1:-chromium}"
URL="${2:-http://localhost:8080}"
BREAKPOINTS="${3:-1920,1440,768,375}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/.claude/visual-qa/screenshots/wordpress/$BROWSER"

if [ -z "$1" ]; then
    echo "Usage: $0 <browser> <url> [breakpoints]"
    echo ""
    echo "Browsers: chromium, firefox, webkit"
    echo "Breakpoints: comma-separated widths (default: 1920,1440,768,375)"
    echo ""
    echo "Examples:"
    echo "  $0 firefox http://localhost:8080"
    echo "  $0 webkit http://localhost:8080 \"1920,1440,768,375\""
    exit 1
fi

# Validate browser
case "$BROWSER" in
    chromium|firefox|webkit) ;;
    *)
        echo "Error: Unknown browser '$BROWSER'. Use: chromium, firefox, webkit"
        exit 1
        ;;
esac

mkdir -p "$OUTPUT_DIR"

echo "=== Cross-Browser Screenshot Capture ==="
echo "Browser: $BROWSER"
echo "URL: $URL"
echo "Breakpoints: $BREAKPOINTS"
echo "Output: $OUTPUT_DIR"
echo ""

# Generate a Playwright script for capturing screenshots
SCRIPT_FILE=$(mktemp /tmp/playwright-capture-XXXXXX.mjs)

cat > "$SCRIPT_FILE" << SCRIPT
import { chromium, firefox, webkit } from 'playwright';

const browsers = { chromium, firefox, webkit };
const browserType = browsers['$BROWSER'];
const url = '$URL';
const breakpoints = '$BREAKPOINTS'.split(',').map(Number);
const outputDir = '$OUTPUT_DIR';

const breakpointNames = {
    1920: 'extra-large',
    1440: 'desktop',
    768: 'tablet',
    375: 'mobile'
};

(async () => {
    const browser = await browserType.launch({ headless: true });

    for (const width of breakpoints) {
        const name = breakpointNames[width] || width + 'px';
        const context = await browser.newContext({
            viewport: { width, height: 900 }
        });
        const page = await context.newPage();

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            const filename = outputDir + '/' + name + '_' + width + 'px.png';
            await page.screenshot({ path: filename, fullPage: true });
            console.log('  Captured: ' + name + ' (' + width + 'px)');
        } catch (err) {
            console.error('  Failed: ' + name + ' (' + width + 'px) - ' + err.message);
        }

        await context.close();
    }

    await browser.close();
    console.log('');
    console.log('Screenshots saved to: ' + outputDir);
})();
SCRIPT

# Run the script
node "$SCRIPT_FILE"
EXIT_CODE=$?

# Cleanup
rm -f "$SCRIPT_FILE"

exit $EXIT_CODE
