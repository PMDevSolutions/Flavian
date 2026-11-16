#!/usr/bin/env bash
# scripts/smoke-block.sh
#
# End-to-end smoke test for the Gutenberg block scaffolder. Proves the full
# acceptance path: scaffold a block → "build" (validate no-build assets) →
# activate in WordPress → render it on a test page.
#
# Requires the project's Docker stack to be running:
#   docker compose up -d wordpress db
#
# Usage:
#   bash scripts/smoke-block.sh [block-name] [--namespace ns] [--keep]
#
# Defaults: block-name "smoke-callout", namespace "flavian".
# --keep leaves the scaffolded plugin + test page in place for inspection.
#
# Exit codes: 0 = all checks passed, 1 = a check failed, 2 = bad usage / no stack.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

BLOCK="smoke-callout"
NAMESPACE="flavian"
KEEP=0

while [ $# -gt 0 ]; do
  case "$1" in
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --keep)      KEEP=1; shift ;;
    -h|--help)   sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --*)         echo "Unknown flag: $1" >&2; exit 2 ;;
    *)           BLOCK="$1"; shift ;;
  esac
done

FQ_NAME="${NAMESPACE}/${BLOCK}"
PASS=0
FAIL=0
PAGE_ID=""

# wp-cli inside the running container. -T disables TTY so it works in CI.
wp() {
  MSYS_NO_PATHCONV=1 docker compose exec -T wordpress wp --allow-root "$@"
}

step()  { printf '\n\xe2\x96\xb8 %s\n' "$*"; }
ok()    { printf '  \xe2\x9c\x93 %s\n' "$*"; PASS=$((PASS+1)); }
bad()   { printf '  \xe2\x9c\x97 %s\n' "$*" >&2; FAIL=$((FAIL+1)); }

cleanup() {
  [ "$KEEP" -eq 1 ] && { printf '\n(--keep) leaving plugins/%s and page %s in place\n' "$BLOCK" "$PAGE_ID"; return; }
  step "Cleanup"
  wp plugin deactivate "$BLOCK" >/dev/null 2>&1 || true
  [ -n "$PAGE_ID" ] && wp post delete "$PAGE_ID" --force >/dev/null 2>&1 || true
  rm -rf "$PROJECT_ROOT/plugins/$BLOCK"
  printf '  removed plugins/%s and test page\n' "$BLOCK"
}
trap cleanup EXIT

# --- Pre-flight: stack must be up ---
if ! wp core version >/dev/null 2>&1; then
  echo "✗ WordPress container not reachable. Start it with: docker compose up -d wordpress db" >&2
  exit 2
fi

# --- 1. Scaffold ---
step "Scaffold $FQ_NAME (dynamic) into plugins/"
rm -rf "$PROJECT_ROOT/plugins/$BLOCK"
bash scripts/scaffold-block.sh "$BLOCK" \
  --namespace "$NAMESPACE" \
  --title "Smoke Callout" \
  --attributes "message:string:Hello from the scaffolder,highlight:boolean:true" \
  --dynamic --force >/dev/null
[ -f "$PROJECT_ROOT/plugins/$BLOCK/$BLOCK.php" ] && ok "plugin scaffolded" || bad "plugin file missing"

# --- 2. "Build" (no build step — validate the no-build assets are coherent) ---
step "Validate assets (no build step required)"
node -e "JSON.parse(require('fs').readFileSync('plugins/$BLOCK/blocks/$BLOCK/block.json','utf8'))" \
  && ok "block.json is valid JSON" || bad "block.json invalid"
node --check "plugins/$BLOCK/blocks/$BLOCK/index.js" >/dev/null 2>&1 \
  && ok "index.js parses" || bad "index.js syntax error"

# --- 3. Activate ---
step "Activate plugin in WordPress"
if wp plugin activate "$BLOCK" >/dev/null 2>&1; then ok "plugin activated"; else bad "activation failed"; fi

registered="$(wp eval "echo WP_Block_Type_Registry::get_instance()->is_registered( '$FQ_NAME' ) ? 'yes' : 'no';" 2>/dev/null || echo 'no')"
[ "$registered" = "yes" ] && ok "block '$FQ_NAME' is registered" || bad "block not registered"

# --- 4. Render on a test page ---
step "Render the block on a test page"
BLOCK_MARKUP="<!-- wp:${FQ_NAME} {\"message\":\"Hello from the scaffolder\",\"highlight\":true} /-->"
PAGE_ID="$(wp post create --post_type=page --post_status=publish \
  --post_title='Block Smoke Test' --post_content="$BLOCK_MARKUP" --porcelain 2>/dev/null || echo '')"
[ -n "$PAGE_ID" ] && ok "created test page (ID $PAGE_ID)" || bad "could not create test page"

if [ -n "$PAGE_ID" ]; then
  rendered="$(wp eval "echo apply_filters( 'the_content', get_post( $PAGE_ID )->post_content );" 2>/dev/null || echo '')"
  printf '  rendered HTML: %s\n' "$(printf '%s' "$rendered" | tr -d '\n' | sed -E 's/\s+/ /g' | cut -c1-200)"
  if printf '%s' "$rendered" | grep -q "wp-block-${NAMESPACE}-${BLOCK}"; then
    ok "front-end render contains the block wrapper class"
  else
    bad "rendered output missing block wrapper class"
  fi
  if printf '%s' "$rendered" | grep -q "Hello from the scaffolder"; then
    ok "front-end render contains the attribute value"
  else
    bad "rendered output missing attribute value"
  fi
fi

# --- Summary ---
printf '\n\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80 Smoke summary: %d passed, %d failed \xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
