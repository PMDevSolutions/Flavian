#!/bin/bash
# WordPress Local Development Helper Script
# Quick commands for managing local WordPress with Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- .env-aware configuration -------------------------------------------------
# This script runs on the host, so it reads settings straight from .env. We parse
# line-by-line rather than `source`-ing the file: generated .env values (e.g.
# WP_SITE_TITLE=My Network) are unquoted and may contain spaces, which would break
# a naive `source`.
ENV_FILE="$SCRIPT_DIR/.env"

read_env() {
    # read_env KEY [default] — echo KEY's value from .env, else the default.
    local key="$1" default="${2:-}" val=""
    if [ -f "$ENV_FILE" ]; then
        val="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2-)"
        val="${val%$'\r'}"   # strip trailing CR from CRLF-encoded files
    fi
    printf '%s' "${val:-$default}"
}

WP_PORT="$(read_env WP_PORT 8080)"
SITE_URL="http://localhost:${WP_PORT}"
WP_MULTISITE="$(read_env WP_MULTISITE false)"
WP_MULTISITE_MODE="$(read_env WP_MULTISITE_MODE subdirectory)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}===================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop first."
        exit 1
    fi
}

# Build Docker images with layer caching
build() {
    print_header "Building WordPress Docker Image"
    check_docker

    local start_time=$(date +%s)

    # Build with BuildKit for better caching
    DOCKER_BUILDKIT=1 docker-compose build --progress=plain wordpress

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    print_success "Build completed in ${duration} seconds"
}

# Rebuild without cache (for benchmarking)
rebuild() {
    print_header "Rebuilding WordPress Docker Image (no cache)"
    check_docker

    local start_time=$(date +%s)

    # Build without cache
    DOCKER_BUILDKIT=1 docker-compose build --no-cache --progress=plain wordpress

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    print_success "Clean build completed in ${duration} seconds"
}

# Benchmark build times (with and without cache)
benchmark() {
    print_header "Docker Build Benchmark"
    check_docker

    echo ""
    echo "This will run two builds to measure cache effectiveness."
    echo "1. Clean build (no cache)"
    echo "2. Cached build (incremental)"
    echo ""
    read -p "Continue? [y/N] " confirm

    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_warning "Benchmark cancelled."
        return
    fi

    # Clean build
    echo ""
    print_header "Step 1/2: Clean Build (no cache)"
    local clean_start=$(date +%s)
    DOCKER_BUILDKIT=1 docker-compose build --no-cache --progress=plain wordpress 2>&1 | tail -20
    local clean_end=$(date +%s)
    local clean_duration=$((clean_end - clean_start))

    # Make a trivial change to force rebuild while using cache
    touch .dockerignore

    # Cached build
    echo ""
    print_header "Step 2/2: Cached Build"
    local cache_start=$(date +%s)
    DOCKER_BUILDKIT=1 docker-compose build --progress=plain wordpress 2>&1 | tail -20
    local cache_end=$(date +%s)
    local cache_duration=$((cache_end - cache_start))

    # Calculate improvement
    local improvement=0
    if [ $clean_duration -gt 0 ]; then
        improvement=$(( (clean_duration - cache_duration) * 100 / clean_duration ))
    fi

    # Results
    echo ""
    print_header "Benchmark Results"
    echo ""
    echo "  Clean build time:  ${clean_duration}s"
    echo "  Cached build time: ${cache_duration}s"
    echo "  Improvement:       ${improvement}%"
    echo ""

    if [ $improvement -ge 30 ]; then
        print_success "Layer caching achieved ${improvement}% improvement (target: 30%)"
    else
        print_warning "Layer caching achieved ${improvement}% improvement (target: 30%)"
    fi

    # Save results to file
    local results_file="docker-benchmark-results.txt"
    {
        echo "Docker Build Benchmark - $(date)"
        echo "================================"
        echo "Clean build time:  ${clean_duration}s"
        echo "Cached build time: ${cache_duration}s"
        echo "Improvement:       ${improvement}%"
        echo ""
    } >> "$results_file"

    echo ""
    echo "Results appended to: $results_file"
}

# Start WordPress
start() {
    print_header "Starting WordPress Development Environment"
    check_docker

    docker-compose up -d

    echo ""
    print_success "WordPress is starting..."
    echo ""
    echo "Services will be available at:"
    echo "  • WordPress:   $SITE_URL"
    echo "  • phpMyAdmin:  http://localhost:8081"
    echo ""
    echo "Database credentials: (see .env file)"
    echo ""
    print_warning "First-time setup may take 1-2 minutes while WordPress downloads..."
    echo ""
    echo "Run './wordpress-local.sh logs' to see startup progress"
}

# Stop WordPress
stop() {
    print_header "Stopping WordPress"
    docker-compose down
    print_success "WordPress stopped"
}

# Restart WordPress
restart() {
    print_header "Restarting WordPress"
    docker-compose restart
    print_success "WordPress restarted"
}

# Show logs
logs() {
    docker-compose logs -f wordpress
}

# Show status
status() {
    print_header "WordPress Status"
    docker-compose ps
}

# Clean everything (removes database!)
clean() {
    print_header "⚠️  WARNING: This will delete ALL WordPress data!"
    echo ""
    read -p "Are you sure? Type 'yes' to confirm: " confirm

    if [ "$confirm" = "yes" ]; then
        docker-compose down -v
        print_success "All data cleaned. Run './wordpress-local.sh start' to begin fresh."
    else
        print_warning "Clean cancelled."
    fi
}

# Install WordPress via WP-CLI in container
install() {
    print_header "Installing WordPress"
    check_docker

    # Check if containers are running
    if ! docker-compose ps | grep -q "Up"; then
        print_error "WordPress containers are not running. Run './wordpress-local.sh start' first."
        exit 1
    fi

    # Wait for WordPress to be ready
    echo "Waiting for WordPress to be ready..."
    sleep 5

    # Admin credentials (override via environment variables, else .env, else defaults)
    local admin_user="${WP_ADMIN_USER:-$(read_env WP_ADMIN_USER admin)}"
    local admin_password="${WP_ADMIN_PASSWORD:-$(read_env WP_ADMIN_PASSWORD admin)}"
    local admin_email="${WP_ADMIN_EMAIL:-$(read_env WP_ADMIN_EMAIL admin@example.com)}"

    # Multisite is configured by the init wizard via WP_MULTISITE in .env.
    if [ "$WP_MULTISITE" = "true" ]; then
        install_multisite "$admin_user" "$admin_password" "$admin_email"
        return
    fi

    local site_title
    site_title="$(read_env WP_SITE_TITLE 'FSE Dev Site')"

    # Install WordPress (single site)
    docker-compose exec wordpress wp core install \
        --url="$SITE_URL" \
        --title="$site_title" \
        --admin_user="$admin_user" \
        --admin_password="$admin_password" \
        --admin_email="$admin_email" \
        --skip-email \
        --allow-root

    print_success "WordPress installed!"
    echo ""
    echo "Admin Login:"
    echo "  • URL:      $SITE_URL/wp-admin"
    echo "  • Username: $admin_user"
    echo "  • Password: $admin_password"
}

# Write the multisite-aware .htaccess into the container.
# `wp core multisite-install` writes the network constants to wp-config.php but
# never touches .htaccess — without the rewrite block, sub-site URLs 404 on the
# Apache image. The two rule sets differ between subdirectory and subdomain mode.
write_multisite_htaccess() {
    print_header "Writing multisite .htaccess ($WP_MULTISITE_MODE)"

    local htaccess
    if [ "$WP_MULTISITE_MODE" = "subdomain" ]; then
        htaccess="$(cat <<'HTACCESS'
# BEGIN WordPress Multisite
RewriteEngine On
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
RewriteBase /
RewriteRule ^index\.php$ - [L]

# add a trailing slash to /wp-admin
RewriteRule ^wp-admin$ wp-admin/ [R=301,L]

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^(wp-(content|admin|includes).*) $1 [L]
RewriteRule ^(.*\.php)$ $1 [L]
RewriteRule . index.php [L]
# END WordPress Multisite
HTACCESS
)"
    else
        htaccess="$(cat <<'HTACCESS'
# BEGIN WordPress Multisite
RewriteEngine On
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
RewriteBase /
RewriteRule ^index\.php$ - [L]

# add a trailing slash to /wp-admin
RewriteRule ^([_0-9a-zA-Z-]+/)?wp-admin$ $1wp-admin/ [R=301,L]

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^([_0-9a-zA-Z-]+/)?(wp-(content|admin|includes).*) $2 [L]
RewriteRule ^([_0-9a-zA-Z-]+/)?(.*\.php)$ $2 [L]
RewriteRule . index.php [L]
# END WordPress Multisite
HTACCESS
)"
    fi

    printf '%s\n' "$htaccess" | docker-compose exec -T wordpress tee /var/www/html/.htaccess >/dev/null
    docker-compose exec -T wordpress chown www-data:www-data /var/www/html/.htaccess
}

# Install WordPress as a multisite network.
# Mode (subdirectory|subdomain) comes from WP_MULTISITE_MODE in .env.
install_multisite() {
    local admin_user="$1" admin_password="$2" admin_email="$3"
    local network_title subdomains_flag=""
    network_title="$(read_env MS_NETWORK_TITLE "$(read_env WP_SITE_TITLE 'Flavian Network')")"

    if [ "$WP_MULTISITE_MODE" = "subdomain" ]; then
        subdomains_flag="--subdomains"
    fi

    print_header "Installing WordPress Multisite ($WP_MULTISITE_MODE)"

    # `wp core multisite-install` installs WordPress and converts it to a network
    # in one step. --subdomains selects subdomain mode; omitting it = subdirectory.
    docker-compose exec wordpress wp core multisite-install \
        --url="$SITE_URL" \
        --title="$network_title" \
        --admin_user="$admin_user" \
        --admin_password="$admin_password" \
        --admin_email="$admin_email" \
        $subdomains_flag \
        --skip-email \
        --allow-root

    write_multisite_htaccess

    print_success "Multisite network installed!"
    echo ""
    echo "Network Admin:"
    echo "  • URL:      $SITE_URL/wp-admin/network/"
    echo "  • Username: $admin_user"
    echo "  • Password: $admin_password"
    echo ""
    if [ "$WP_MULTISITE_MODE" = "subdomain" ]; then
        print_warning "Subdomain mode needs wildcard DNS for *.localhost."
        echo "  Add a hosts entry per sub-site (e.g. 127.0.0.1 site2.localhost) or use dnsmasq."
        echo "  See docs/multisite/README.md."
    else
        echo "  Create sub-sites at: $SITE_URL/wp-admin/network/sites.php"
    fi
}

# Activate a theme
activate_theme() {
    local theme_slug="$1"

    if [ -z "$theme_slug" ]; then
        print_error "Usage: ./wordpress-local.sh activate-theme <theme-slug>"
        echo ""
        echo "Available themes:"
        ls -1 themes/
        exit 1
    fi

    if [ ! -d "themes/$theme_slug" ]; then
        print_error "Theme not found: themes/$theme_slug"
        echo ""
        echo "Available themes:"
        ls -1 themes/
        exit 1
    fi

    print_header "Activating Theme: $theme_slug"

    docker-compose exec wordpress wp theme activate "$theme_slug" --allow-root

    print_success "Theme '$theme_slug' activated!"
    echo "View at: $SITE_URL"
}

# List themes
list_themes() {
    print_header "Installed Themes"
    docker-compose exec wordpress wp theme list --allow-root
}

# Shell into WordPress container
shell() {
    print_header "Opening WordPress Container Shell"
    docker-compose exec wordpress bash
}

# Show help
help() {
    echo "WordPress Local Development Helper"
    echo ""
    echo "Usage: ./wordpress-local.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start              Start WordPress and database"
    echo "  stop               Stop WordPress and database"
    echo "  restart            Restart WordPress"
    echo "  logs               Show WordPress logs (Ctrl+C to exit)"
    echo "  status             Show container status"
    echo "  install            Install WordPress (first-time setup; multisite-aware)"
    echo "  activate-theme     Activate a theme"
    echo "  list-themes        List all themes"
    echo "  shell              Open shell in WordPress container"
    echo "  clean              Delete all data and start fresh"
    echo "  help               Show this help message"
    echo ""
    echo "Build Commands:"
    echo "  build              Build Docker image with layer caching"
    echo "  rebuild            Rebuild Docker image (no cache)"
    echo "  benchmark          Run build time benchmark"
    echo ""
    echo "Quick Start:"
    echo "  1. ./wordpress-local.sh build    (first time only)"
    echo "  2. ./wordpress-local.sh start"
    echo "  3. ./wordpress-local.sh install"
    echo "  4. ./wordpress-local.sh activate-theme your-theme"
    echo "  5. Open $SITE_URL"
    echo ""
    echo "Multisite:"
    echo "  Set WP_MULTISITE=true (and WP_MULTISITE_MODE=subdirectory|subdomain) in .env"
    echo "  — 'pnpm run init -- --multisite' does this — then run 'install' to build the network."
}

# Main command router
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    install)
        install
        ;;
    activate-theme)
        activate_theme "$2"
        ;;
    list-themes)
        list_themes
        ;;
    shell)
        shell
        ;;
    build)
        build
        ;;
    rebuild)
        rebuild
        ;;
    benchmark)
        benchmark
        ;;
    help|--help|-h)
        help
        ;;
    *)
        help
        ;;
esac
