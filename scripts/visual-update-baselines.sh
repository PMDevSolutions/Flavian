#!/usr/bin/env bash
# scripts/visual-update-baselines.sh
#
# Regenerate every PNG in tests/visual/baselines/ from a fresh capture against
# the local Docker WordPress stack. Use this after an *intentional* UI change.
#
# WARNING: This overwrites existing baselines. Stage and review the diff
# carefully (the baselines are committed to git, so `git diff` will tell you
# exactly what changed).
#
# To keep baselines portable across local + CI rendering, this script runs the
# capture step inside the same Playwright Docker image used in CI. That avoids
# subpixel font rendering differences between your local OS and the CI runner.
#
# Flags:
#   --no-docker      Run capture directly on the host instead of in the Playwright image.
#                    Faster, but baselines may not match CI rendering.
#   --only <slug>    Replace baselines for a single page only.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

NO_DOCKER=0
ONLY_ARG=""
PLAYWRIGHT_IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.60.0-jammy}"

while [ $# -gt 0 ]; do
  case "$1" in
    --no-docker) NO_DOCKER=1; shift ;;
    --only)      ONLY_ARG="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,/^$/p' "$0"
      exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

echo "▸ Bringing up + seeding WordPress stack"
docker compose up -d wordpress db
for i in $(seq 1 60); do
  if curl --silent --fail --max-time 2 http://localhost:8080/ >/dev/null 2>&1; then break; fi
  [ "$i" -eq 60 ] && { echo "✗ WordPress did not become healthy" >&2; exit 2; }
  sleep 2
done
WC_INSTALL_SAMPLE_DATA=false docker compose --profile woocommerce up --exit-code-from woocommerce-installer woocommerce-installer
bash tests/visual/seed.sh

# --- Capture into a fresh actual/ ---
rm -rf tests/visual/actual
mkdir -p tests/visual/actual

if [ "$NO_DOCKER" -eq 1 ]; then
  echo "▸ Capturing on host (--no-docker)"
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  pnpm exec playwright install chromium
  # shellcheck disable=SC2086
  pnpm exec node tests/visual/capture.mjs --out tests/visual/actual ${ONLY_ARG:+--only $ONLY_ARG}
else
  echo "▸ Capturing inside ${PLAYWRIGHT_IMAGE}"
  docker run --rm \
    --network host \
    -v "$PROJECT_ROOT":/work \
    -w /work \
    "$PLAYWRIGHT_IMAGE" \
    bash -c "
      set -e
      corepack enable
      corepack prepare pnpm@9.15.0 --activate
      pnpm install --frozen-lockfile 2>/dev/null || pnpm install
      node tests/visual/capture.mjs --out tests/visual/actual ${ONLY_ARG:+--only $ONLY_ARG}
    "
fi

# --- Promote actual/ → baselines/ ---
if [ -n "$ONLY_ARG" ]; then
  echo "▸ Replacing baselines for slug '$ONLY_ARG'"
  find tests/visual/actual -name "${ONLY_ARG}-*.png" -exec cp -v {} tests/visual/baselines/ \;
else
  echo "▸ Replacing all baselines"
  rm -f tests/visual/baselines/*.png
  cp -v tests/visual/actual/*.png tests/visual/baselines/
fi

echo ""
echo "✓ Baselines updated. Review with: git diff --stat tests/visual/baselines/"
echo "  Then commit:  git add tests/visual/baselines && git commit -m 'test(visual): update baselines'"
