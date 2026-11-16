#!/bin/bash
# Content Seeder Verification - Stop hook
# Verifies all required pages exist and are accessible
# Exit 0 (informational only)

echo "" >&2
echo "📋 Content Seeder Verification" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

# Find the active theme
THEME_DIR=$(find themes/ -maxdepth 1 -type d -not -name "themes" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

if [ -z "$THEME_DIR" ]; then
    echo "  ⚠️  No theme directory found" >&2
    exit 0
fi

THEME_NAME=$(basename "$THEME_DIR")

# List expected pages from template filenames
echo "  Theme: $THEME_NAME" >&2
echo "" >&2
echo "  Expected pages (from templates/):" >&2

EXPECTED_PAGES=()
for template in "$THEME_DIR/templates"/page-*.html; do
    if [ -f "$template" ]; then
        SLUG=$(basename "$template" .html | sed 's/^page-//')
        EXPECTED_PAGES+=("$SLUG")
        echo "    - $SLUG (from $(basename "$template"))" >&2
    fi
done

if [ -f "$THEME_DIR/templates/front-page.html" ]; then
    echo "    - home (from front-page.html)" >&2
    EXPECTED_PAGES+=("home")
fi

# Check if Docker/WP-CLI is available to verify
if command -v docker &> /dev/null && docker compose ps 2>/dev/null | grep -q "wordpress.*running"; then
    echo "" >&2
    echo "  WordPress status:" >&2

    # List actual pages
    ACTUAL_PAGES=$(docker compose exec -T wordpress wp post list --post_type=page --fields=post_name,post_status --format=csv --allow-root 2>/dev/null)

    for slug in "${EXPECTED_PAGES[@]}"; do
        if echo "$ACTUAL_PAGES" | grep -q "^$slug,publish"; then
            echo "    ✅ $slug (published)" >&2
        elif echo "$ACTUAL_PAGES" | grep -q "^$slug"; then
            echo "    ⚠️  $slug (exists but not published)" >&2
        else
            echo "    ❌ $slug (MISSING — needs creation)" >&2
        fi
    done

    # Check homepage setting
    FRONT_PAGE=$(docker compose exec -T wordpress wp option get page_on_front --allow-root 2>/dev/null)
    SHOW_ON_FRONT=$(docker compose exec -T wordpress wp option get show_on_front --allow-root 2>/dev/null)

    echo "" >&2
    if [ "$SHOW_ON_FRONT" = "page" ] && [ "$FRONT_PAGE" != "0" ]; then
        echo "  ✅ Static homepage configured (page ID: $FRONT_PAGE)" >&2
    else
        echo "  ⚠️  No static homepage configured" >&2
    fi
else
    echo "" >&2
    echo "  ℹ️  WordPress not running — skipping live verification" >&2
    echo "  Run wp-environment-manager to start WordPress" >&2
fi

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
exit 0
