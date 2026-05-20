#!/usr/bin/env bash
# Install and configure headless WordPress inside the Docker WP container.
#
# What it does, in order:
#   1. Verifies WordPress is installed; bails out cleanly if not.
#   2. Installs and activates WPGraphQL (+ optional companions).
#   3. Sets HEADLESS_MODE option so flavian-headless.php mu-plugin activates.
#   4. Generates a preview secret and stores it in wp_options.
#   5. Configures pretty permalinks (required for REST + WPGraphQL routes).
#   6. Pings /graphql and /wp-json/wp/v2/ to confirm both APIs respond.
#
# Usage:
#   ./scripts/wordpress-install/setup-headless.sh [--frontend-url URL]
#                                                 [--no-jwt]
#                                                 [--no-blocks]
#                                                 [--preview-secret VALUE]
#
# Requires: docker compose, the project's WordPress container running.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FRONTEND_URL="${HEADLESS_FRONTEND_URL:-http://localhost:3000}"
INSTALL_JWT=true
INSTALL_BLOCKS=true
PREVIEW_SECRET=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

  --frontend-url URL       Origin allowed by CORS + used for preview links
                           (default: http://localhost:3000)
  --no-jwt                 Skip WPGraphQL JWT Auth (auth via app passwords only)
  --no-blocks              Skip WPGraphQL Content Blocks (FSE block exposure)
  --preview-secret VALUE   Use a specific preview secret instead of generating
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend-url) FRONTEND_URL="$2"; shift 2 ;;
    --no-jwt) INSTALL_JWT=false; shift ;;
    --no-blocks) INSTALL_BLOCKS=false; shift ;;
    --preview-secret) PREVIEW_SECRET="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

log() { printf '\n[setup-headless] %s\n' "$*"; }

WP_CONTAINER="${WP_CONTAINER:-flavian-wp}"
if [[ -f /.dockerenv ]] || [[ "${WP_USE_DOCKER_EXEC:-}" == "true" ]]; then
  wp_in_container() {
    docker exec -i "$WP_CONTAINER" wp "$@" --allow-root
  }
else
  wp_in_container() {
    docker compose exec -T wordpress wp "$@" --allow-root
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
    log "Waiting for WordPress to become healthy..."
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

# 1. Install WPGraphQL + companions ------------------------------------------
install_plugin() {
  local slug="$1"
  if wp_in_container plugin is-installed "$slug" >/dev/null 2>&1; then
    log "$slug already installed"
  else
    log "Installing $slug"
    wp_in_container plugin install "$slug" --activate
  fi
  if ! wp_in_container plugin is-active "$slug" >/dev/null 2>&1; then
    wp_in_container plugin activate "$slug"
  fi
}

install_plugin wp-graphql

# wp-graphql-jwt-authentication: token-based auth for the frontend's
# preview/draft fetches. Optional — apps can also use WP application passwords.
if $INSTALL_JWT; then
  install_plugin wp-graphql-jwt-authentication || \
    log "JWT plugin install failed — continuing without it"
fi

# wp-graphql-content-blocks: exposes the FSE block tree as a queryable field
# (editorBlocks). Critical for any frontend that wants to render block content.
if $INSTALL_BLOCKS; then
  install_plugin wp-graphql-content-blocks || \
    log "Content Blocks plugin install failed — continuing without it"
fi

# 2. Headless mode toggle + secrets ------------------------------------------
log "Enabling HEADLESS_MODE option"
wp_in_container option update flavian_headless_mode 1 >/dev/null
wp_in_container option update flavian_headless_frontend_url "$FRONTEND_URL" >/dev/null

if [[ -z "$PREVIEW_SECRET" ]]; then
  # 32-byte hex secret. wp eval avoids needing openssl in the container.
  PREVIEW_SECRET="$(wp_in_container eval 'echo bin2hex(random_bytes(32));' 2>/dev/null | tr -d '\r\n')"
fi
wp_in_container option update flavian_headless_preview_secret "$PREVIEW_SECRET" >/dev/null
log "Preview secret stored in wp_options (key: flavian_headless_preview_secret)"

# JWT signing key — required by wp-graphql-jwt-authentication. The plugin
# reads GRAPHQL_JWT_AUTH_SECRET_KEY from wp-config.php OR a filter. We can't
# write to wp-config from here safely, so we surface the value to the user.
if $INSTALL_JWT; then
  JWT_SECRET="$(wp_in_container eval 'echo bin2hex(random_bytes(32));' 2>/dev/null | tr -d '\r\n')"
  wp_in_container option update flavian_headless_jwt_secret "$JWT_SECRET" >/dev/null
fi

# 3. Permalinks --------------------------------------------------------------
log "Setting pretty permalinks"
wp_in_container option update permalink_structure '/%postname%/' >/dev/null
wp_in_container rewrite flush --hard >/dev/null

# 4. Verify endpoints --------------------------------------------------------
log "Verifying API endpoints"
if wp_in_container option get permalink_structure >/dev/null 2>&1; then
  REST_STATUS=$(docker exec "$WP_CONTAINER" curl -s -o /dev/null -w '%{http_code}' http://localhost/wp-json/wp/v2/posts 2>/dev/null || echo "000")
  log "REST API /wp-json/wp/v2/posts → HTTP $REST_STATUS"

  GQL_STATUS=$(docker exec "$WP_CONTAINER" curl -s -o /dev/null -w '%{http_code}' \
    -X POST -H 'Content-Type: application/json' \
    -d '{"query":"{ generalSettings { title } }"}' \
    http://localhost/graphql 2>/dev/null || echo "000")
  log "GraphQL /graphql → HTTP $GQL_STATUS"
fi

# 5. Summary -----------------------------------------------------------------
echo ""
log "Headless WordPress configured. Endpoints (host):"
log "  REST API:    http://localhost:8080/wp-json/wp/v2/"
log "  GraphQL:     http://localhost:8080/graphql"
log "  GraphiQL UI: http://localhost:8080/wp-admin/admin.php?page=graphiql-ide"
echo ""
log "Frontend env values to copy into frontend/.env.local:"
echo "  WORDPRESS_URL=http://localhost:8080"
echo "  WORDPRESS_GRAPHQL_URL=http://localhost:8080/graphql"
echo "  WORDPRESS_PREVIEW_SECRET=$PREVIEW_SECRET"
if $INSTALL_JWT; then
  echo "  # Add the following line to wp-config.php for JWT auth:"
  echo "  # define( 'GRAPHQL_JWT_AUTH_SECRET_KEY', '$JWT_SECRET' );"
fi
