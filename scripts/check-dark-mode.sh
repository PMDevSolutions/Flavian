#!/bin/bash
# Dark mode screenshot capture and visual diff comparison
#
# Usage:
#   ./scripts/check-dark-mode.sh [url] [--output-dir <dir>]
#   ./scripts/check-dark-mode.sh http://localhost:8080
#   ./scripts/check-dark-mode.sh http://localhost:5173 --output-dir ./my-diffs
#
# Captures dark mode screenshots using Playwright's colorScheme: 'dark' and
# compares them against light mode baselines via visual-diff.js.
#
# Exit codes: 0=within tolerance, 1=differences above threshold, 2=error

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="http://localhost:8080"
CUSTOM_OUTPUT_DIR=""

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        --output-dir)
            CUSTOM_OUTPUT_DIR="$2"
            shift 2
            ;;
        -*)
            echo "Error: Unknown option '$1'"
            echo "Usage: $0 [url] [--output-dir <dir>]"
            exit 2
            ;;
        *)
            URL="$1"
            shift
            ;;
    esac
done

# Read config from pipeline.config.json using node
CONFIG_FILE="$PROJECT_ROOT/.claude/pipeline.config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: pipeline.config.json not found at $CONFIG_FILE"
    exit 2
fi

DARK_ENABLED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf-8'));console.log(c.darkMode?.enabled ?? true)")
DIFF_THRESHOLD=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf-8'));console.log(c.darkMode?.diffThreshold ?? 0.03)")
DARK_SCREENSHOT_DIR=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf-8'));console.log(c.darkMode?.screenshotDir ?? '.claude/visual-qa/screenshots/dark')")
BREAKPOINTS_JSON=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf-8'));const bp=c.visualDiff?.breakpoints||{mobile:375,tablet:768,desktop:1440,wide:1920};console.log(JSON.stringify(bp))")

# Check if dark mode is disabled
if [ "$DARK_ENABLED" = "false" ]; then
    echo "Dark mode visual verification is disabled in pipeline.config.json"
    exit 0
fi

# Resolve directories
DARK_DIR="$PROJECT_ROOT/$DARK_SCREENSHOT_DIR"
LIGHT_DIR="$PROJECT_ROOT/.claude/visual-qa/screenshots/chromium"
DIFF_OUTPUT_DIR="${CUSTOM_OUTPUT_DIR:-$PROJECT_ROOT/.claude/visual-qa/diffs/dark-vs-light}"

# Verify light mode screenshots exist
if [ ! -d "$LIGHT_DIR" ]; then
    echo "Error: Light mode screenshots not found at $LIGHT_DIR"
    echo "Run cross-browser-test.sh with chromium first to capture light mode baselines."
    exit 2
fi

LIGHT_COUNT=$(find "$LIGHT_DIR" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
if [ "$LIGHT_COUNT" -eq 0 ]; then
    echo "Error: No light mode screenshots found in $LIGHT_DIR"
    echo "Run cross-browser-test.sh with chromium first to capture light mode baselines."
    exit 2
fi

mkdir -p "$DARK_DIR"
mkdir -p "$DIFF_OUTPUT_DIR"

echo "=== Dark Mode Visual Verification ==="
echo "URL: $URL"
echo "Light baselines: $LIGHT_DIR ($LIGHT_COUNT screenshots)"
echo "Dark screenshots: $DARK_DIR"
echo "Diff output: $DIFF_OUTPUT_DIR"
echo "Diff threshold: $DIFF_THRESHOLD"
echo ""

# Generate Playwright script for dark mode capture
SCRIPT_FILE=$(mktemp /tmp/playwright-dark-mode-XXXXXX.mjs)

cat > "$SCRIPT_FILE" << SCRIPT
import { chromium } from 'playwright';

const url = '$URL';
const outputDir = '$DARK_DIR';
const breakpoints = $BREAKPOINTS_JSON;

const breakpointNames = {};
for (const [name, width] of Object.entries(breakpoints)) {
    breakpointNames[width] = name;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    for (const [name, width] of Object.entries(breakpoints)) {
        const context = await browser.newContext({
            viewport: { width: Number(width), height: 900 },
            colorScheme: 'dark'
        });
        const page = await context.newPage();

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            // Wait for dark mode CSS to fully apply
            await page.waitForTimeout(500);
            const filename = outputDir + '/' + name + '_' + width + 'px.png';
            await page.screenshot({ path: filename, fullPage: true });
            console.log('  Captured: ' + name + ' (' + width + 'px) [dark mode]');
        } catch (err) {
            console.error('  Failed: ' + name + ' (' + width + 'px) - ' + err.message);
        }

        await context.close();
    }

    await browser.close();
    console.log('');
    console.log('Dark mode screenshots saved to: ' + outputDir);
})();
SCRIPT

echo "=== Capturing Dark Mode Screenshots ==="
echo ""

node "$SCRIPT_FILE"
CAPTURE_EXIT=$?

# Cleanup temp script
rm -f "$SCRIPT_FILE"

if [ $CAPTURE_EXIT -ne 0 ]; then
    echo ""
    echo "Error: Dark mode screenshot capture failed"
    exit 2
fi

echo ""
echo "=== Comparing Dark vs Light Screenshots ==="
echo ""

# Run visual-diff.js in batch mode comparing dark vs light
node "$PROJECT_ROOT/scripts/visual-diff.js" \
    --batch "$DARK_DIR" "$LIGHT_DIR" \
    --output-dir "$DIFF_OUTPUT_DIR" \
    --threshold "$DIFF_THRESHOLD"
DIFF_EXIT=$?

echo ""
if [ $DIFF_EXIT -eq 0 ]; then
    echo "=== Result: Dark mode within tolerance (threshold: $DIFF_THRESHOLD) ==="
elif [ $DIFF_EXIT -eq 1 ]; then
    echo "=== Result: Dark mode differences detected above threshold ==="
    echo "Review diff images in: $DIFF_OUTPUT_DIR"
else
    echo "=== Result: Error during visual comparison ==="
fi

exit $DIFF_EXIT
