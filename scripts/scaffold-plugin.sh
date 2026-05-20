#!/usr/bin/env bash
# scripts/scaffold-plugin.sh
#
# Generate a new WordPress plugin under plugins/<slug>/ from the templates
# in .claude/templates/plugin/.
#
# Usage:
#   bash scripts/scaffold-plugin.sh <slug> [options]
#
# Options:
#   --name "Human Name"         Default: slug title-cased
#   --description "What it is"  Default: placeholder text
#   --author "Author Name"      Default: $(git config user.name) or "Anonymous"
#   --namespace "Vendor\\Name"  Default: Flavian\Plugins\<PluginClass>
#   --no-cpt                    Omit the CPT example (src/PostTypes/)
#   --no-taxonomy               Omit the taxonomy example (src/Taxonomies/)
#   --no-settings               Omit the settings page (src/Admin/)
#   --no-block                  Omit the block example (src/Blocks/ + assets/blocks/)
#   --minimal                   Equivalent to --no-cpt --no-taxonomy --no-settings --no-block
#   --force                     Overwrite an existing plugins/<slug>/ directory
#   --dry-run                   Print actions but do not write any files
#
# Exit codes: 0 = success, 1 = validation/IO error, 2 = bad usage.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_DIR="$PROJECT_ROOT/.claude/templates/plugin"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

# --- Reserved slugs that would collide with existing/default plugins ---
RESERVED_SLUGS=("akismet" "hello" "index")

# --- Argument parsing ---
SLUG=""
NAME=""
DESCRIPTION=""
AUTHOR=""
NAMESPACE=""
WITH_CPT=1
WITH_TAXONOMY=1
WITH_SETTINGS=1
WITH_BLOCK=1
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
    --name)        NAME="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --author)      AUTHOR="$2"; shift 2 ;;
    --namespace)   NAMESPACE="$2"; shift 2 ;;
    --no-cpt)      WITH_CPT=0; shift ;;
    --no-taxonomy) WITH_TAXONOMY=0; shift ;;
    --no-settings) WITH_SETTINGS=0; shift ;;
    --no-block)    WITH_BLOCK=0; shift ;;
    --minimal)     WITH_CPT=0; WITH_TAXONOMY=0; WITH_SETTINGS=0; WITH_BLOCK=0; shift ;;
    --force)       FORCE=1; shift ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)     usage 0 ;;
    --*)           die "Unknown flag: $1" ;;
    *)
      if [ -z "$SLUG" ]; then SLUG="$1"; shift
      else die "Unexpected positional arg: $1"
      fi
      ;;
  esac
done

[ -n "$SLUG" ] || usage 2

# --- Slug validation ---
if ! [[ "$SLUG" =~ ^[a-z][a-z0-9-]*$ ]]; then
  die "Invalid slug '$SLUG'. Must match ^[a-z][a-z0-9-]*\$ (lowercase, digits, hyphens; must start with a letter)."
fi

for reserved in "${RESERVED_SLUGS[@]}"; do
  if [ "$SLUG" = "$reserved" ]; then
    die "Slug '$SLUG' is reserved (collides with a default WordPress plugin)."
  fi
done

# --- Template dir sanity check ---
[ -d "$TEMPLATE_DIR" ] || die "Template directory not found: $TEMPLATE_DIR"

# --- Derive tokens ---
# slug → PascalCase: 'flavian-starter' → 'FlavianStarter'
slug_to_pascal() {
  local s="$1" out=""
  IFS='-' read -ra parts <<< "$s"
  for p in "${parts[@]}"; do
    out+="$(printf '%s' "${p:0:1}" | tr '[:lower:]' '[:upper:]')${p:1}"
  done
  printf '%s' "$out"
}

# slug → UPPER_SNAKE: 'flavian-starter' → 'FLAVIAN_STARTER'
slug_to_const() {
  printf '%s' "$1" | tr 'a-z-' 'A-Z_'
}

PLUGIN_CLASS="$(slug_to_pascal "$SLUG")"
PLUGIN_CONST="$(slug_to_const "$SLUG")"

if [ -z "$NAME" ]; then
  # 'flavian-starter' → 'Flavian Starter'
  NAME="$(printf '%s' "$SLUG" | sed -E 's/(^|-)([a-z])/\1\u\2/g' | tr '-' ' ')"
fi

if [ -z "$DESCRIPTION" ]; then
  DESCRIPTION="A WordPress plugin scaffolded with scripts/scaffold-plugin.sh."
fi

if [ -z "$AUTHOR" ]; then
  AUTHOR="$(git -C "$PROJECT_ROOT" config user.name 2>/dev/null || true)"
  [ -n "$AUTHOR" ] || AUTHOR="Anonymous"
fi

if [ -z "$NAMESPACE" ]; then
  NAMESPACE="Flavian\\Plugins\\${PLUGIN_CLASS}"
fi

VERSION="0.1.0"
TARGET_DIR="$PLUGINS_DIR/$SLUG"

# --- Pre-flight ---
if [ -e "$TARGET_DIR" ]; then
  if [ "$FORCE" -eq 1 ]; then
    [ "$DRY_RUN" -eq 1 ] || rm -rf "$TARGET_DIR"
  else
    die "$TARGET_DIR already exists. Re-run with --force to overwrite."
  fi
fi

# --- Token substitution helper ---
# Escape characters that have special meaning in sed *replacement* strings:
# backslash, ampersand, and the chosen delimiter ('|'). Critical for namespace
# (contains backslashes) and free-text fields (author / description).
sed_escape() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

render_file() {
  local src="$1" dst="$2"
  local slug_e name_e desc_e class_e const_e ns_e ns_json ns_json_e author_e version_e
  slug_e="$(sed_escape "$SLUG")"
  name_e="$(sed_escape "$NAME")"
  desc_e="$(sed_escape "$DESCRIPTION")"
  class_e="$(sed_escape "$PLUGIN_CLASS")"
  const_e="$(sed_escape "$PLUGIN_CONST")"
  ns_e="$(sed_escape "$NAMESPACE")"
  # JSON-encoded namespace: each '\' becomes '\\' before sed-escaping.
  ns_json="${NAMESPACE//\\/\\\\}"
  ns_json_e="$(sed_escape "$ns_json")"
  author_e="$(sed_escape "$AUTHOR")"
  version_e="$(sed_escape "$VERSION")"

  sed \
    -e "s|{{PLUGIN_SLUG}}|${slug_e}|g" \
    -e "s|{{PLUGIN_NAME}}|${name_e}|g" \
    -e "s|{{PLUGIN_DESC}}|${desc_e}|g" \
    -e "s|{{PLUGIN_CLASS}}|${class_e}|g" \
    -e "s|{{PLUGIN_CONST}}|${const_e}|g" \
    -e "s|{{PLUGIN_NS_JSON}}|${ns_json_e}|g" \
    -e "s|{{PLUGIN_NS}}|${ns_e}|g" \
    -e "s|{{TEXT_DOMAIN}}|${slug_e}|g" \
    -e "s|{{AUTHOR}}|${author_e}|g" \
    -e "s|{{VERSION}}|${version_e}|g" \
    "$src" > "$dst"
}

# --- Plan ---
printf '▸ Scaffolding plugin: %s\n' "$SLUG"
printf '  Name:        %s\n' "$NAME"
printf '  Description: %s\n' "$DESCRIPTION"
printf '  Class:       %s\n' "$PLUGIN_CLASS"
printf '  Const:       %s\n' "$PLUGIN_CONST"
printf '  Namespace:   %s\n' "$NAMESPACE"
printf '  Author:      %s\n' "$AUTHOR"
printf '  Target:      %s\n' "$TARGET_DIR"
printf '  Features:    cpt=%d taxonomy=%d settings=%d block=%d\n' \
  "$WITH_CPT" "$WITH_TAXONOMY" "$WITH_SETTINGS" "$WITH_BLOCK"
[ "$DRY_RUN" -eq 1 ] && printf '  Dry-run: yes\n'
echo ""

# --- Walk template tree + render ---
COUNT=0
while IFS= read -r src; do
  rel="${src#$TEMPLATE_DIR/}"
  rel="${rel%.tmpl}"

  # Substitute PLUGIN_SLUG in file/dir path (only the main plugin file uses this).
  rel="${rel//PLUGIN_SLUG/$SLUG}"

  dst="$TARGET_DIR/$rel"

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  + %s\n' "$rel"
  else
    mkdir -p "$(dirname "$dst")"
    render_file "$src" "$dst"
  fi
  COUNT=$((COUNT + 1))
done < <(find "$TEMPLATE_DIR" -type f -name '*.tmpl' | LC_ALL=C sort)

# --- Conditional feature removal ---
remove_feature() {
  local label="$1"; shift
  local paths=("$@")
  for p in "${paths[@]}"; do
    target="$TARGET_DIR/$p"
    if [ -e "$target" ]; then
      [ "$DRY_RUN" -eq 1 ] || rm -rf "$target"
      printf '  - %s (omitted: %s)\n' "$p" "$label"
    fi
  done
}

[ "$WITH_CPT"      -eq 0 ] && remove_feature 'cpt'      'src/PostTypes' 'tests/PostTypes'
[ "$WITH_TAXONOMY" -eq 0 ] && remove_feature 'taxonomy' 'src/Taxonomies'
[ "$WITH_SETTINGS" -eq 0 ] && remove_feature 'settings' 'src/Admin'
[ "$WITH_BLOCK"    -eq 0 ] && remove_feature 'block'    'src/Blocks' 'assets/blocks'

# --- Done ---
echo ""
if [ "$DRY_RUN" -eq 1 ]; then
  printf '✓ Dry run: would write %d files to %s\n' "$COUNT" "$TARGET_DIR"
else
  printf '✓ Wrote %d files to %s\n' "$COUNT" "$TARGET_DIR"
  printf '\nNext steps:\n'
  printf '  cd plugins/%s\n' "$SLUG"
  printf '  composer install\n'
  printf '  composer test\n'
  printf '  composer lint\n'
fi
