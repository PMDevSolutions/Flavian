#!/bin/bash
# API Endpoint Checker
# Verifies API servers/endpoints are reachable before testing
# Exit 0 (warn) - warns if endpoints unreachable but doesn't block

echo "🔍 Checking API endpoint availability..." >&2

# Common API endpoint files/configs to check
ENDPOINT_CONFIGS=()
[ -f "api-config.json" ] && ENDPOINT_CONFIGS+=(api-config.json)
[ -f "endpoints.json" ] && ENDPOINT_CONFIGS+=(endpoints.json)
[ -f ".env" ] && ENDPOINT_CONFIGS+=(.env)
[ -f ".env.local" ] && ENDPOINT_CONFIGS+=(.env.local)

ENDPOINTS=()

# Try to extract endpoints from config files
for config in "${ENDPOINT_CONFIGS[@]}"; do
    if [ -f "$config" ]; then
        # Extract URLs from JSON files
        if [[ "$config" =~ \.json$ ]]; then
            URLS=$(grep -oE 'https?://[a-zA-Z0-9./?=_-]+' "$config" || true)
            [ -n "$URLS" ] && ENDPOINTS+=($URLS)
        fi

        # Extract URLs from .env files
        if [[ "$config" =~ \.env ]]; then
            URLS=$(grep -oE 'https?://[a-zA-Z0-9./?=_-]+' "$config" || true)
            [ -n "$URLS" ] && ENDPOINTS+=($URLS)
        fi
    fi
done

# Check for WordPress REST API
if [ -f "wp-config.php" ]; then
    # Try to detect site URL from wp-config.php
    if grep -q "WP_HOME\|WP_SITEURL" wp-config.php; then
        SITE_URL=$(grep -E "(WP_HOME|WP_SITEURL)" wp-config.php | head -n 1 | grep -oE 'https?://[a-zA-Z0-9./?=_-]+' || true)
        if [ -n "$SITE_URL" ]; then
            ENDPOINTS+=("${SITE_URL}/wp-json/")
        fi
    fi
fi

# Remove duplicates
ENDPOINTS=($(echo "${ENDPOINTS[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))

if [ ${#ENDPOINTS[@]} -eq 0 ]; then
    echo "ℹ️  No API endpoints detected" >&2
    echo "   Create api-config.json or set endpoints in .env" >&2
    exit 0
fi

echo "Found ${#ENDPOINTS[@]} endpoint(s) to check" >&2
echo "" >&2

# Check each endpoint
REACHABLE=0
UNREACHABLE=0

for endpoint in "${ENDPOINTS[@]}"; do
    # Try to reach the endpoint with curl
    if command -v curl &> /dev/null; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$endpoint" 2>/dev/null || echo "000")

        if [ "$HTTP_CODE" = "000" ]; then
            echo "  ❌ Unreachable: $endpoint" >&2
            ((UNREACHABLE++))
        elif [ "${HTTP_CODE:0:1}" = "2" ] || [ "${HTTP_CODE:0:1}" = "3" ]; then
            echo "  ✅ Reachable: $endpoint (HTTP $HTTP_CODE)" >&2
            ((REACHABLE++))
        elif [ "${HTTP_CODE:0:1}" = "4" ]; then
            echo "  ⚠️  Client error: $endpoint (HTTP $HTTP_CODE)" >&2
            ((REACHABLE++))  # Still counts as reachable, just auth/permission issue
        else
            echo "  ❌ Server error: $endpoint (HTTP $HTTP_CODE)" >&2
            ((UNREACHABLE++))
        fi
    else
        echo "  ⚠️  Cannot check $endpoint - curl not installed" >&2
    fi
done

echo "" >&2

if [ $UNREACHABLE -gt 0 ]; then
    echo "⚠️  Warning: $UNREACHABLE endpoint(s) unreachable" >&2
    echo "   API tests may fail if these endpoints are required" >&2
else
    echo "✅ All endpoints reachable" >&2
fi

# Always exit 0 (warn, don't block)
exit 0
