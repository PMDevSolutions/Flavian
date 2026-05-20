#!/usr/bin/env bash
# scripts/scaffold-frontend.sh
#
# Generate a Next.js 14 (App Router) headless frontend under frontend/<slug>/
# from the templates in .claude/templates/frontend/nextjs/.
#
# The generated app talks to the headless WordPress configured by
# scripts/wordpress-install/setup-headless.sh — same preview secret, same
# GraphQL endpoint.
#
# Usage:
#   bash scripts/scaffold-frontend.sh <slug> [options]
#
# Options:
#   --name "Human Name"     Display name (default: slug title-cased)
#   --framework nextjs      Frontend framework (default: nextjs; only option today)
#   --force                 Overwrite an existing frontend/<slug>/ directory
#   --dry-run               Print actions but do not write any files
#
# Exit codes: 0 = success, 1 = validation/IO error, 2 = bad usage.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

SLUG=""
NAME=""
FRAMEWORK="nextjs"
FORCE=0
DRY_RUN=0

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-2}"
}

die() {
  printf '✗ %s\n' "$*" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --name)      NAME="$2"; shift 2 ;;
    --framework) FRAMEWORK="$2"; shift 2 ;;
    --force)     FORCE=1; shift ;;
    --dry-run)   DRY_RUN=1; shift ;;
    -h|--help)   usage 0 ;;
    --*)         die "Unknown flag: $1" ;;
    *)
      if [ -z "$SLUG" ]; then SLUG="$1"; shift
      else die "Unexpected positional arg: $1"
      fi
      ;;
  esac
done

[ -n "$SLUG" ] || usage 2

# Only nextjs ships today; nuxt/astro are tracked as follow-ups.
if [ "$FRAMEWORK" != "nextjs" ]; then
  die "Framework '$FRAMEWORK' is not yet implemented. Use --framework nextjs."
fi

TEMPLATE_DIR="$PROJECT_ROOT/.claude/templates/frontend/$FRAMEWORK"
[ -d "$TEMPLATE_DIR" ] || die "Template directory not found: $TEMPLATE_DIR"

# --- Slug validation ---
if ! [[ "$SLUG" =~ ^[a-z][a-z0-9-]*$ ]]; then
  die "Invalid slug '$SLUG'. Must match ^[a-z][a-z0-9-]*\$ (lowercase, digits, hyphens; must start with a letter)."
fi

if [ -z "$NAME" ]; then
  NAME="$(printf '%s' "$SLUG" | sed -E 's/(^|-)([a-z])/\1\u\2/g' | tr '-' ' ')"
fi

TARGET_DIR="$FRONTEND_DIR/$SLUG"

if [ -e "$TARGET_DIR" ]; then
  if [ "$FORCE" -eq 1 ]; then
    [ "$DRY_RUN" -eq 1 ] || rm -rf "$TARGET_DIR"
  else
    die "$TARGET_DIR already exists. Re-run with --force to overwrite."
  fi
fi

# --- Token substitution helper ---
sed_escape() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

render_file() {
  local src="$1" dst="$2"
  local slug_e name_e
  slug_e="$(sed_escape "$SLUG")"
  name_e="$(sed_escape "$NAME")"
  sed \
    -e "s|{{APP_SLUG}}|${slug_e}|g" \
    -e "s|{{APP_NAME}}|${name_e}|g" \
    "$src" > "$dst"
}

printf '▸ Scaffolding %s frontend: %s\n' "$FRAMEWORK" "$SLUG"
printf '  Name:      %s\n' "$NAME"
printf '  Target:    %s\n' "$TARGET_DIR"
[ "$DRY_RUN" -eq 1 ] && printf '  Dry-run:   yes\n'
echo ""

COUNT=0
while IFS= read -r src; do
  rel="${src#$TEMPLATE_DIR/}"
  rel="${rel%.tmpl}"
  dst="$TARGET_DIR/$rel"

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  + %s\n' "$rel"
  else
    mkdir -p "$(dirname "$dst")"
    render_file "$src" "$dst"
  fi
  COUNT=$((COUNT + 1))
done < <(find "$TEMPLATE_DIR" -type f -name '*.tmpl' | LC_ALL=C sort)

echo ""
if [ "$DRY_RUN" -eq 1 ]; then
  printf '✓ Dry run: would write %d files to %s\n' "$COUNT" "$TARGET_DIR"
else
  printf '✓ Wrote %d files to %s\n' "$COUNT" "$TARGET_DIR"
  printf '\nNext steps:\n'
  printf '  1. docker compose --profile headless up headless-installer\n'
  printf '     (installs WPGraphQL + prints WORDPRESS_PREVIEW_SECRET)\n'
  printf '  2. cd frontend/%s\n' "$SLUG"
  printf '     cp .env.local.example .env.local   # paste the printed values\n'
  printf '     pnpm install && pnpm dev\n'
  printf '  3. Open http://localhost:3000\n'
fi
