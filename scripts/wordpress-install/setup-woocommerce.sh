#!/usr/bin/env bash
# Install and configure WooCommerce inside the Docker WordPress container.
#
# What it does, in order:
#   1. Verifies WordPress is installed; bails out cleanly if not.
#   2. Installs and activates WooCommerce from WordPress.org.
#   3. Imports the bundled sample products CSV (skippable with --no-sample).
#   4. Creates the cart, checkout, my-account, and shop pages with the slugs
#      that the flavian-shop theme templates expect.
#   5. Configures store base options (currency, country, default address).
#   6. Optionally activates the flavian-shop theme.
#
# Usage:
#   ./scripts/wordpress-install/setup-woocommerce.sh [--no-sample]
#                                                    [--theme flavian-shop|none]
#                                                    [--currency USD]
#                                                    [--country US:CA]
#
# Requires: docker compose, the project's WordPress container running.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

NO_SAMPLE=false
ACTIVATE_THEME="flavian-shop"
CURRENCY="USD"
COUNTRY="US:CA"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

  --no-sample             skip the sample-products import
  --theme NAME|none       theme to activate after WC install (default: flavian-shop)
  --currency CODE         WC currency code (default: USD)
  --country CODE[:STATE]  WC base country/state (default: US:CA)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-sample) NO_SAMPLE=true; shift ;;
    --theme) ACTIVATE_THEME="$2"; shift 2 ;;
    --currency) CURRENCY="$2"; shift 2 ;;
    --country) COUNTRY="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

log() { printf '\n[setup-woocommerce] %s\n' "$*"; }

# Two callers exist: a human running this on the host (use 'docker compose'),
# or the woocommerce-installer sidecar container which mounts the host socket
# and only knows the WordPress container by name. Pick the right invocation.
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
  echo "        (e.g. wp core install via your environment-manager workflow)." >&2
  exit 1
fi

# 1. Install + activate WooCommerce ------------------------------------------
if wp_in_container plugin is-installed woocommerce >/dev/null 2>&1; then
  log "WooCommerce already installed — skipping plugin install"
else
  log "Installing WooCommerce"
  wp_in_container plugin install woocommerce --activate
fi

if ! wp_in_container plugin is-active woocommerce >/dev/null 2>&1; then
  log "Activating WooCommerce"
  wp_in_container plugin activate woocommerce
fi

# 2. Configure base store options --------------------------------------------
log "Setting base store options ($COUNTRY, $CURRENCY)"
wp_in_container option update woocommerce_default_country  "$COUNTRY"      >/dev/null
wp_in_container option update woocommerce_currency          "$CURRENCY"    >/dev/null
wp_in_container option update woocommerce_weight_unit       "kg"           >/dev/null
wp_in_container option update woocommerce_dimension_unit    "cm"           >/dev/null
wp_in_container option update woocommerce_allow_tracking    "no"           >/dev/null
wp_in_container option update woocommerce_demo_store        "no"           >/dev/null

# 3. Create / verify required pages ------------------------------------------
log "Ensuring shop / cart / checkout / my-account pages exist"
ensure_page() {
  local slug="$1" title="$2" template="$3" content="$4"
  local existing
  existing="$(wp_in_container post list --post_type=page --name="$slug" --field=ID 2>/dev/null | tr -d '\r')"
  if [[ -z "$existing" ]]; then
    wp_in_container post create \
      --post_type=page --post_status=publish \
      --post_title="$title" --post_name="$slug" \
      --post_content="$content" \
      --porcelain >/dev/null
    existing="$(wp_in_container post list --post_type=page --name="$slug" --field=ID 2>/dev/null | tr -d '\r')"
  fi
  if [[ -n "$template" ]]; then
    wp_in_container post meta update "$existing" _wp_page_template "$template" >/dev/null
  fi
  printf '%s' "$existing"
}

CART_ID="$(ensure_page cart      "Cart"       "page-cart"      '<!-- wp:woocommerce/cart /-->')"
CHECKOUT_ID="$(ensure_page checkout "Checkout" "page-checkout"  '<!-- wp:woocommerce/checkout /-->')"
ACCOUNT_ID="$(ensure_page my-account "My account" "page-myaccount" '[woocommerce_my_account]')"
SHOP_ID="$(ensure_page shop      "Shop"       "page-shop"      '')"

wp_in_container option update woocommerce_cart_page_id       "$CART_ID"     >/dev/null
wp_in_container option update woocommerce_checkout_page_id   "$CHECKOUT_ID" >/dev/null
wp_in_container option update woocommerce_myaccount_page_id  "$ACCOUNT_ID"  >/dev/null
wp_in_container option update woocommerce_shop_page_id       "$SHOP_ID"     >/dev/null

# 4. Sample data --------------------------------------------------------------
if ! $NO_SAMPLE; then
  log "Importing sample products"
  if wp_in_container plugin is-installed wordpress-importer >/dev/null 2>&1; then
    : # already there
  else
    wp_in_container plugin install wordpress-importer --activate >/dev/null
  fi
  # WooCommerce ships sample CSVs; the cleanest path is its built-in importer.
  if wp_in_container help wc product create >/dev/null 2>&1; then
    SAMPLE_CSV="/var/www/html/wp-content/plugins/woocommerce/sample-data/sample_products.csv"
    if wp_in_container test -f "$SAMPLE_CSV" >/dev/null 2>&1; then
      wp_in_container wc product_importer run --file="$SAMPLE_CSV" --user=1 \
        || log "Sample importer not available — skipping (install woocommerce-cli or import manually)"
    else
      log "Sample CSV not found in container — skipping"
    fi
  else
    log "wc CLI commands unavailable — skipping sample import"
  fi
else
  log "--no-sample given; skipping sample products"
fi

# 5. Theme activation --------------------------------------------------------
if [[ "$ACTIVATE_THEME" != "none" ]]; then
  if wp_in_container theme is-installed "$ACTIVATE_THEME" >/dev/null 2>&1; then
    log "Activating theme: $ACTIVATE_THEME"
    wp_in_container theme activate "$ACTIVATE_THEME"
  else
    log "Theme '$ACTIVATE_THEME' not found in container — skipping activation"
    log "Make sure themes/$ACTIVATE_THEME/ is mounted into wp-content/themes/"
  fi
fi

# 6. Permalink + rewrites ----------------------------------------------------
log "Flushing rewrite rules"
wp_in_container option update permalink_structure '/%postname%/' >/dev/null
wp_in_container rewrite flush --hard >/dev/null

log "Done. Visit:"
log "  Shop:     http://localhost:8080/shop/"
log "  Cart:     http://localhost:8080/cart/"
log "  Checkout: http://localhost:8080/checkout/"
log "  Account:  http://localhost:8080/my-account/"
