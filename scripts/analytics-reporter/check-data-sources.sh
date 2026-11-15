#!/bin/bash
# Analytics Data Source Checker
# Verifies database and analytics API connections
# Exit 0 (warn) - warns if sources unavailable but doesn't block

echo "🔍 Checking analytics data sources..." >&2

WARNINGS=()
AVAILABLE=()

# Check for database connection (common databases)
if command -v mysql &> /dev/null; then
    AVAILABLE+=("MySQL client installed")
elif command -v psql &> /dev/null; then
    AVAILABLE+=("PostgreSQL client installed")
elif command -v sqlite3 &> /dev/null; then
    AVAILABLE+=("SQLite3 client installed")
else
    WARNINGS+=("No database client found (mysql, psql, or sqlite3)")
fi

# Check for analytics API credentials in env files
ENV_FILES=(.env .env.local .env.production)
API_KEYS_FOUND=false

for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        # Check for common analytics API keys
        if grep -qE '(GOOGLE_ANALYTICS|GA_|MIXPANEL|SEGMENT|AMPLITUDE|ANALYTICS_API)' "$env_file"; then
            AVAILABLE+=("Analytics API credentials found in $env_file")
            API_KEYS_FOUND=true
        fi
    fi
done

if [ "$API_KEYS_FOUND" = false ]; then
    WARNINGS+=("No analytics API credentials found in .env files")
fi

# Check for analytics config files
if [ -f "analytics.config.js" ] || [ -f "analytics.json" ]; then
    AVAILABLE+=("Analytics configuration file found")
fi

# Display available sources
if [ ${#AVAILABLE[@]} -gt 0 ]; then
    echo "" >&2
    echo "✅ Available data sources:" >&2
    for item in "${AVAILABLE[@]}"; do
        echo "  ✓ $item" >&2
    done
fi

# Display warnings
if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "" >&2
    echo "⚠️  Data source warnings:" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "  ⚠️  $warning" >&2
    done
    echo "" >&2
    echo "Analytics reporting may be limited without data sources." >&2
fi

exit 0
