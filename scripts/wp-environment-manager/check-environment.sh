#!/bin/bash
# WP Environment Manager - SubagentStart hook
# Checks Docker, containers, and WP-CLI status
# Exit 0 (informational - never blocks agent start)

echo "" >&2
echo "🔍 WordPress Environment Status Check" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

# Check Docker
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo "  ✅ Docker: Running" >&2
    else
        echo "  ❌ Docker: Installed but not running" >&2
        echo "     → Start Docker Desktop before proceeding" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        exit 0
    fi
else
    echo "  ❌ Docker: Not installed" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 0
fi

# Check docker-compose.yml exists
if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
    echo "  ✅ docker-compose.yml: Found" >&2
else
    echo "  ❌ docker-compose.yml: Not found" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 0
fi

# Check containers
WP_STATUS=$(docker compose ps --format "{{.Service}} {{.State}}" 2>/dev/null | grep wordpress | awk '{print $2}')
DB_STATUS=$(docker compose ps --format "{{.Service}} {{.State}}" 2>/dev/null | grep -E "db|mysql|mariadb" | awk '{print $2}')

if [ "$WP_STATUS" = "running" ]; then
    echo "  ✅ WordPress container: Running" >&2
else
    echo "  ❌ WordPress container: ${WP_STATUS:-Not started}" >&2
fi

if [ "$DB_STATUS" = "running" ]; then
    echo "  ✅ Database container: Running" >&2
else
    echo "  ❌ Database container: ${DB_STATUS:-Not started}" >&2
fi

# Check WP-CLI
if [ "$WP_STATUS" = "running" ]; then
    if docker compose exec -T wordpress wp --version --allow-root &> /dev/null; then
        WP_VERSION=$(docker compose exec -T wordpress wp --version --allow-root 2>/dev/null)
        echo "  ✅ WP-CLI: $WP_VERSION" >&2
    else
        echo "  ❌ WP-CLI: Not installed in container" >&2
        echo "     → Will need to install during setup" >&2
    fi

    # Check active theme
    ACTIVE_THEME=$(docker compose exec -T wordpress wp theme list --status=active --field=name --allow-root 2>/dev/null)
    if [ -n "$ACTIVE_THEME" ]; then
        echo "  ✅ Active theme: $ACTIVE_THEME" >&2
    fi

    # Check WordPress URL
    SITE_URL=$(docker compose exec -T wordpress wp option get siteurl --allow-root 2>/dev/null)
    if [ -n "$SITE_URL" ]; then
        echo "  ✅ Site URL: $SITE_URL" >&2
    fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
exit 0
