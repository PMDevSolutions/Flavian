#!/usr/bin/env bash
# scripts/visual-capture.sh
#
# Boot the local WordPress Docker stack, install WooCommerce, seed deterministic
# content, then capture visual regression screenshots into tests/visual/actual/.
#
# Use this when running the workflow locally. CI uses .github/workflows/visual-regression.yml
# which inlines equivalent steps.
#
# Flags:
#   --skip-stack   Don't touch docker compose (assume the stack is already up + seeded).
#   --only <slug>  Capture a single page by slug (matches tests/visual/urls.json pages[].slug).
#
# Exit codes: 0 = success, 1 = capture failed, 2 = environment problem.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

SKIP_STACK=0
ONLY_ARG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-stack) SKIP_STACK=1; shift ;;
    --only)       ONLY_ARG="--only $2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--skip-stack] [--only <slug>]"
      exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# --- Ensure pnpm is available ---
if ! command -v pnpm >/dev/null 2>&1; then
  echo "✗ pnpm not found. Install via corepack: corepack enable && corepack prepare pnpm@9.15.0 --activate" >&2
  exit 2
fi

# --- Stack ---
if [ "$SKIP_STACK" -eq 0 ]; then
  echo "▸ Starting WordPress stack"
  docker compose up -d wordpress db

  echo "▸ Waiting for wordpress healthcheck"
  for i in $(seq 1 60); do
    if curl --silent --fail --max-time 2 http://localhost:8080/ >/dev/null 2>&1; then
      echo "  ✓ WordPress is responding"
      break
    fi
    [ "$i" -eq 60 ] && { echo "✗ WordPress did not become healthy in 120s" >&2; exit 2; }
    sleep 2
  done

  echo "▸ Installing WooCommerce (no sample data)"
  WC_INSTALL_SAMPLE_DATA=false docker compose --profile woocommerce up --exit-code-from woocommerce-installer woocommerce-installer

  echo "▸ Seeding deterministic content"
  bash tests/visual/seed.sh
fi

# --- Install Node deps + Playwright Chromium ---
echo "▸ Installing Node dependencies"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

if [ ! -d "$(pnpm exec node -p 'require("path").dirname(require.resolve("playwright/package.json"))' 2>/dev/null)/.local-browsers" ]; then
  echo "▸ Installing Playwright Chromium"
  pnpm exec playwright install chromium
fi

# --- Capture ---
echo "▸ Capturing screenshots"
# shellcheck disable=SC2086
pnpm exec node tests/visual/capture.mjs --out tests/visual/actual $ONLY_ARG

echo ""
echo "✓ Screenshots written to tests/visual/actual/"
echo "  Compare:  pnpm visual:diff"
echo "  Accept:   pnpm visual:update"
