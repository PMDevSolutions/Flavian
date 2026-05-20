#!/usr/bin/env bash
# Convert the local WordPress install to a multisite network.
#
# What it does, in order:
#   1. Verifies WordPress is installed and not already multisite.
#   2. Adds WP_ALLOW_MULTISITE to wp-config.php.
#   3. Runs `wp core multisite-convert` (subdirectory mode by default).
#   4. Patches in the network constants WordPress prints on the Network
#      Setup screen (MULTISITE, SUBDOMAIN_INSTALL, DOMAIN_CURRENT_SITE,
#      PATH_CURRENT_SITE, SITE_ID_CURRENT_SITE, BLOG_ID_CURRENT_SITE).
#   5. Writes a multisite-aware .htaccess.
#   6. Optionally creates a sample second site.
#   7. Promotes the WP admin to a super admin.
#
# Subdomain mode is intentionally not wired up here — it requires wildcard
# DNS / *.localhost which is awkward to ship in a generic Docker setup.
# Document the manual flip in docs/multisite/README.md for now.
#
# Usage:
#   ./scripts/wordpress-install/setup-multisite.sh [options]
#
# Options:
#   --network-title TITLE    Network title (default: "Flavian Network")
#   --no-second-site         Skip creating the sample sub-site
#   --second-site-slug SLUG  Slug for the sample sub-site (default: "site2")
#   --second-site-title T    Title for the sample sub-site (default: "Site Two")
#   --skip-htaccess          Don't touch .htaccess
#
# Requires: docker compose, the project's WordPress container running.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

NETWORK_TITLE="${MS_NETWORK_TITLE:-Flavian Network}"
CREATE_SECOND_SITE=true
SECOND_SITE_SLUG="${MS_SECOND_SITE_SLUG:-site2}"
SECOND_SITE_TITLE="${MS_SECOND_SITE_TITLE:-Site Two}"
SKIP_HTACCESS=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

  --network-title TITLE     Network title (default: "Flavian Network")
  --no-second-site          Skip creating the sample sub-site
  --second-site-slug SLUG   Slug for the sample sub-site (default: site2)
  --second-site-title T     Title for the sample sub-site (default: "Site Two")
  --skip-htaccess           Don't touch .htaccess
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network-title) NETWORK_TITLE="$2"; shift 2 ;;
    --no-second-site) CREATE_SECOND_SITE=false; shift ;;
    --second-site-slug) SECOND_SITE_SLUG="$2"; shift 2 ;;
    --second-site-title) SECOND_SITE_TITLE="$2"; shift 2 ;;
    --skip-htaccess) SKIP_HTACCESS=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

log() { printf '\n[setup-multisite] %s\n' "$*"; }

WP_CONTAINER="${WP_CONTAINER:-flavian-wp}"
if [[ -f /.dockerenv ]] || [[ "${WP_USE_DOCKER_EXEC:-}" == "true" ]]; then
  wp_in_container() {
    docker exec -i "$WP_CONTAINER" wp "$@" --allow-root
  }
  raw_in_container() {
    docker exec -i "$WP_CONTAINER" "$@"
  }
else
  wp_in_container() {
    docker compose exec -T wordpress wp "$@" --allow-root
  }
  raw_in_container() {
    docker compose exec -T wordpress "$@"
  }
fi

# 0. Prerequisites -----------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found in PATH" >&2
  exit 1
fi

if [[ ! -f /.dockerenv ]]; then
  if ! docker compose ps --status running --services 2>/dev/null | grep -q '^wordpress$'; then
    log "WordPress container not running — starting it"
    docker compose up -d wordpress db
    for _ in $(seq 1 30); do
      if docker compose exec -T wordpress curl -sf http://localhost/ >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
  fi
fi

if ! wp_in_container core is-installed >/dev/null 2>&1; then
  echo "[ERROR] WordPress is not installed yet. Run the WP install step first" >&2
  exit 1
fi

if wp_in_container core is-installed --network >/dev/null 2>&1; then
  log "Network already configured — nothing to do"
  log "  Network admin: http://localhost:8080/wp-admin/network/"
  exit 0
fi

# 1. Allow multisite ---------------------------------------------------------
if ! wp_in_container config has WP_ALLOW_MULTISITE --type=constant >/dev/null 2>&1; then
  log "Adding WP_ALLOW_MULTISITE to wp-config.php"
  wp_in_container config set WP_ALLOW_MULTISITE true --raw --type=constant >/dev/null
fi

# 2. Convert to multisite ----------------------------------------------------
log "Converting to multisite (subdirectory mode)"
wp_in_container core multisite-convert \
  --title="$NETWORK_TITLE" \
  --base=/ \
  >/dev/null

# 3. Write the network constants wp-cli omits --------------------------------
# `wp core multisite-convert` writes them on recent wp-cli versions, but on
# older builds it just prints them to stdout. Use `wp config set` for each
# so the result is deterministic regardless of the wp-cli version.
log "Ensuring network constants exist in wp-config.php"
SITE_HOST="$(wp_in_container option get siteurl | sed -E 's|^https?://||; s|/.*$||' | tr -d '\r')"
[[ -z "$SITE_HOST" ]] && SITE_HOST="localhost:8080"

set_config_const() {
  local name="$1" value="$2" raw="${3:-}"
  if wp_in_container config has "$name" --type=constant >/dev/null 2>&1; then
    return
  fi
  if [[ -n "$raw" ]]; then
    wp_in_container config set "$name" "$value" --raw --type=constant >/dev/null
  else
    wp_in_container config set "$name" "$value" --type=constant >/dev/null
  fi
}

set_config_const MULTISITE              true       raw
set_config_const SUBDOMAIN_INSTALL      false      raw
set_config_const DOMAIN_CURRENT_SITE    "$SITE_HOST"
set_config_const PATH_CURRENT_SITE      '/'
set_config_const SITE_ID_CURRENT_SITE   1          raw
set_config_const BLOG_ID_CURRENT_SITE   1          raw

# 4. .htaccess ---------------------------------------------------------------
if ! $SKIP_HTACCESS; then
  log "Writing multisite .htaccess"
  raw_in_container tee /var/www/html/.htaccess >/dev/null <<'HTACCESS'
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
  raw_in_container chown www-data:www-data /var/www/html/.htaccess
fi

# 5. Optional second site ----------------------------------------------------
if $CREATE_SECOND_SITE; then
  if wp_in_container site list --field=url 2>/dev/null | grep -q "/$SECOND_SITE_SLUG/"; then
    log "Sub-site '$SECOND_SITE_SLUG' already exists"
  else
    log "Creating sub-site: $SECOND_SITE_TITLE (/$SECOND_SITE_SLUG/)"
    wp_in_container site create \
      --slug="$SECOND_SITE_SLUG" \
      --title="$SECOND_SITE_TITLE" \
      --email="$(wp_in_container user get 1 --field=user_email)" \
      >/dev/null
  fi
fi

# 6. Super admin -------------------------------------------------------------
ADMIN_LOGIN="$(wp_in_container user get 1 --field=user_login | tr -d '\r')"
if [[ -n "$ADMIN_LOGIN" ]]; then
  wp_in_container super-admin add "$ADMIN_LOGIN" >/dev/null 2>&1 || true
  log "Promoted $ADMIN_LOGIN to super admin"
fi

# 7. Summary -----------------------------------------------------------------
echo ""
log "Multisite ready. Endpoints (host):"
log "  Network admin:  http://localhost:8080/wp-admin/network/"
log "  Main site:      http://localhost:8080/"
if $CREATE_SECOND_SITE; then
  log "  Second site:    http://localhost:8080/$SECOND_SITE_SLUG/"
fi
log "  All sites:      docker compose exec wordpress wp site list --allow-root"
