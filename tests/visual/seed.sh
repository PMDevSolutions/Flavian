#!/usr/bin/env bash
# tests/visual/seed.sh
#
# Seeds the running flavian-wp Docker container with deterministic content
# so the visual regression suite captures stable baselines.
#
# Assumes:
#   - docker compose service "wordpress" is running and healthy
#   - WooCommerce is already installed and activated (run setup-woocommerce.sh first)
#
# Idempotent: deletes prior visual-test fixtures before recreating them.
#
# Exit codes: 0 = success, 1 = WP not reachable or seed step failed.

set -euo pipefail

WP_SERVICE="${WP_SERVICE:-wordpress}"
WP="docker compose exec -T -u www-data ${WP_SERVICE} wp"

# --- Sanity check: container is up + WP responds ---
if ! docker compose ps "$WP_SERVICE" --status running --quiet | grep -q .; then
  echo "✗ docker compose service '${WP_SERVICE}' is not running" >&2
  exit 1
fi

if ! $WP core is-installed --quiet; then
  echo "✗ WordPress is not installed in ${WP_SERVICE}. Run setup-woocommerce.sh or wp core install first." >&2
  exit 1
fi

echo "▸ Activating flavian-shop theme"
$WP theme activate flavian-shop

# --- Pin site identity so headers/titles are stable across runs ---
echo "▸ Pinning site identity (title, tagline, timezone)"
$WP option update blogname "Flavian Visual Test"
$WP option update blogdescription "Visual regression fixtures"
$WP option update timezone_string "UTC"
$WP option update date_format "Y-m-d"
$WP option update time_format "H:i"
$WP option update start_of_week 1

# --- Ensure a "Sample Page" exists at /sample-page/ (default WP page) ---
echo "▸ Ensuring /sample-page/ exists"
if ! $WP post list --post_type=page --name=sample-page --format=ids | grep -q .; then
  $WP post create \
    --post_type=page \
    --post_title='Sample Page' \
    --post_name='sample-page' \
    --post_status=publish \
    --post_date='2025-01-15 12:00:00' \
    --post_content='<p>This page exists so the page.html template has something to render against during visual regression.</p>'
fi

# --- Wipe any prior visual-test products, then recreate deterministically ---
echo "▸ Removing prior visual-test products"
PRIOR_IDS=$($WP post list --post_type=product --meta_key=_visual_test_fixture --meta_value=1 --format=ids 2>/dev/null || true)
if [ -n "$PRIOR_IDS" ]; then
  # shellcheck disable=SC2086
  $WP post delete $PRIOR_IDS --force
fi

echo "▸ Creating Apparel product category"
if ! $WP wc product_cat list --slug=apparel --user=1 --format=ids 2>/dev/null | grep -q .; then
  $WP term create product_cat 'Apparel' --slug=apparel
fi

create_product() {
  local name="$1" slug="$2" price="$3" desc="$4"
  local id
  id=$($WP post create \
    --post_type=product \
    --post_title="$name" \
    --post_name="$slug" \
    --post_status=publish \
    --post_date='2025-01-15 12:00:00' \
    --post_excerpt="$desc" \
    --porcelain)
  $WP post meta add "$id" _visual_test_fixture 1
  $WP post meta add "$id" _regular_price "$price"
  $WP post meta add "$id" _price "$price"
  $WP post meta add "$id" _virtual no
  $WP post meta add "$id" _downloadable no
  $WP post meta add "$id" _manage_stock no
  $WP post meta add "$id" _stock_status instock
  $WP post meta add "$id" _visibility visible
  $WP post term set "$id" product_cat apparel
  echo "    + $name ($slug) → \$${price}"
}

echo "▸ Creating deterministic products"
create_product 'Test Hoodie' 'test-hoodie' '42.00' 'A reference hoodie used by the visual regression suite.'
create_product 'Test Beanie' 'test-beanie' '18.00' 'A reference beanie used by the visual regression suite.'
create_product 'Test Tee'    'test-tee'    '24.00' 'A reference t-shirt used by the visual regression suite.'

# --- Normalize all publish dates so post_date never causes a diff ---
echo "▸ Normalizing all post dates to 2025-01-15 12:00:00 UTC"
$WP db query "
  UPDATE wp_posts
  SET post_date='2025-01-15 12:00:00',
      post_date_gmt='2025-01-15 12:00:00',
      post_modified='2025-01-15 12:00:00',
      post_modified_gmt='2025-01-15 12:00:00'
  WHERE post_status='publish';
"

# --- Flush rewrite rules so /shop/, /product/, /product-category/ paths resolve ---
echo "▸ Flushing rewrite rules"
$WP rewrite flush --hard

echo ""
echo "✓ Seed complete. Site is ready at http://localhost:8080"
