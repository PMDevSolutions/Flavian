#!/usr/bin/env bash
# scripts/scaffold-block.sh
#
# Generate a self-contained, activatable Gutenberg custom block plugin under
# plugins/<block>/ (no build step required — uses the WordPress runtime
# globals declared in index.asset.php).
#
# Usage:
#   bash scripts/scaffold-block.sh <block-name> [options]
#
# Inputs (per the v2.0.0 "Gutenberg custom block scaffolding" milestone):
#   <block-name>                 Block slug (kebab-case). Positional, required.
#   --namespace "vendor"         Block namespace → block.json "name" is
#                                "<namespace>/<block-name>". Default: flavian
#   --attributes "spec"          Supported attributes, comma-separated, each
#                                "name:type[:default]". Types: string, number,
#                                boolean, array, object.
#                                e.g. "heading:string:Hello,count:number:3,featured:boolean"
#
# Options:
#   --dynamic                    Generate a server-side render callback
#                                (blocks/<block>/render.php). Default: static.
#   --title "Human Title"        Default: title-cased block name.
#   --description "What it is"    Default: placeholder text.
#   --category "widgets"         Block category. Default: widgets.
#   --icon "block-default"       Dashicon name. Default: block-default.
#   --keywords "a,b,c"           Search keywords. Default: block name.
#   --text-domain "slug"         i18n text domain. Default: block slug.
#   --author "Name"              Default: git user.name or "Anonymous".
#   --php-namespace "Vendor\\X"  PHP @package. Default: <Namespace>\Blocks\<Class>.
#   --version "0.1.0"            Default: 0.1.0.
#   --dest "plugins"             Parent directory for the generated plugin.
#                                Default: plugins (repo root-level convention).
#   --force                      Overwrite an existing target directory.
#   --dry-run                    Print the plan/files but write nothing.
#   -h, --help                   Show this help.
#
# Outputs (plugins/<block>/):
#   <block>.php                       Plugin header + register_block_type()
#   blocks/<block>/block.json         Block metadata + attributes + supports
#   blocks/<block>/index.js           edit() + save() (no build, runtime globals)
#   blocks/<block>/index.asset.php    Script dependencies + version
#   blocks/<block>/editor.css         Editor-only styles
#   blocks/<block>/style.css          Front-end styles
#   blocks/<block>/render.php         Dynamic render callback (--dynamic only)
#   tests/<Class>Test.php             PHPUnit test stub
#   tests/bootstrap.php               Lightweight WP function stubs for tests
#   phpunit.xml.dist                  PHPUnit config
#   README.md                         Usage + smoke-test notes
#
# Exit codes: 0 = success, 1 = validation/IO error, 2 = bad usage.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Defaults ---
BLOCK_SLUG=""
NAMESPACE="flavian"
ATTR_SPEC=""
DYNAMIC=0
TITLE=""
DESCRIPTION=""
CATEGORY="widgets"
ICON="block-default"
KEYWORDS=""
TEXT_DOMAIN=""
AUTHOR=""
PHP_NAMESPACE=""
VERSION="0.1.0"
DEST="plugins"
FORCE=0
DRY_RUN=0

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-2}"
}

die() {
  printf '\xe2\x9c\x97 %s\n' "$*" >&2
  exit 1
}

# --- Argument parsing ---
while [ $# -gt 0 ]; do
  case "$1" in
    --namespace)     NAMESPACE="$2"; shift 2 ;;
    --attributes)    ATTR_SPEC="$2"; shift 2 ;;
    --dynamic)       DYNAMIC=1; shift ;;
    --static)        DYNAMIC=0; shift ;;
    --title)         TITLE="$2"; shift 2 ;;
    --description)   DESCRIPTION="$2"; shift 2 ;;
    --category)      CATEGORY="$2"; shift 2 ;;
    --icon)          ICON="$2"; shift 2 ;;
    --keywords)      KEYWORDS="$2"; shift 2 ;;
    --text-domain)   TEXT_DOMAIN="$2"; shift 2 ;;
    --author)        AUTHOR="$2"; shift 2 ;;
    --php-namespace) PHP_NAMESPACE="$2"; shift 2 ;;
    --version)       VERSION="$2"; shift 2 ;;
    --dest)          DEST="$2"; shift 2 ;;
    --force)         FORCE=1; shift ;;
    --dry-run)       DRY_RUN=1; shift ;;
    -h|--help)       usage 0 ;;
    --*)             die "Unknown flag: $1" ;;
    *)
      if [ -z "$BLOCK_SLUG" ]; then BLOCK_SLUG="$1"; shift
      else die "Unexpected positional arg: $1"
      fi
      ;;
  esac
done

[ -n "$BLOCK_SLUG" ] || usage 2

# --- Slug + namespace validation ---
if ! [[ "$BLOCK_SLUG" =~ ^[a-z][a-z0-9-]*$ ]]; then
  die "Invalid block name '$BLOCK_SLUG'. Must match ^[a-z][a-z0-9-]*\$ (lowercase, digits, hyphens; start with a letter)."
fi
if ! [[ "$NAMESPACE" =~ ^[a-z][a-z0-9-]*$ ]]; then
  die "Invalid namespace '$NAMESPACE'. Must match ^[a-z][a-z0-9-]*\$ (block.json names allow lowercase, digits, hyphens)."
fi

# --- Helpers ---
# 'pricing-table' → 'PricingTable'
slug_to_pascal() {
  local s="$1" out="" p
  IFS='-' read -ra parts <<< "$s"
  for p in "${parts[@]}"; do
    out+="$(printf '%s' "${p:0:1}" | tr '[:lower:]' '[:upper:]')${p:1}"
  done
  printf '%s' "$out"
}

# 'pricing-table' → 'Pricing Table' ; 'showImage' → 'Show Image'
humanize() {
  printf '%s' "$1" \
    | sed -E 's/([a-z0-9])([A-Z])/\1 \2/g; s/[-_]+/ /g' \
    | sed -E 's/\b(.)/\U\1/g'
}

# Escape sed *replacement* special chars: backslash, ampersand, delimiter '|'.
sed_escape() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

# Replace a token line in $2 with the multiline content in env var SNIP.
inject_multiline() {
  local token="$1" file="$2" tmp
  tmp="$(mktemp)"
  TOKEN="$token" awk '
    BEGIN { t = ENVIRON["TOKEN"]; s = ENVIRON["SNIP"] }
    index($0, t) { printf "%s\n", s; next }
    { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

# --- Derive identifiers ---
BLOCK_CLASS="$(slug_to_pascal "$BLOCK_SLUG")"
NAMESPACE_PASCAL="$(slug_to_pascal "$NAMESPACE")"
CSS_BASE="wp-block-${NAMESPACE}-${BLOCK_SLUG}"   # WP wrapper class
PLUGIN_SLUG="$BLOCK_SLUG"

[ -n "$TITLE" ]       || TITLE="$(humanize "$BLOCK_SLUG")"
[ -n "$DESCRIPTION" ] || DESCRIPTION="A custom block scaffolded with scripts/scaffold-block.sh."
[ -n "$TEXT_DOMAIN" ] || TEXT_DOMAIN="$BLOCK_SLUG"
[ -n "$KEYWORDS" ]    || KEYWORDS="$BLOCK_SLUG"
[ -n "$PHP_NAMESPACE" ] || PHP_NAMESPACE="${NAMESPACE_PASCAL}\\Blocks\\${BLOCK_CLASS}"
PLUGIN_NAME="$TITLE"
if [ -z "$AUTHOR" ]; then
  AUTHOR="$(git -C "$PROJECT_ROOT" config user.name 2>/dev/null || true)"
  [ -n "$AUTHOR" ] || AUTHOR="Anonymous"
fi

# Resolve dest (absolute or relative to repo root)
case "$DEST" in
  /*) DEST_DIR="$DEST" ;;
  *)  DEST_DIR="$PROJECT_ROOT/$DEST" ;;
esac
TARGET_DIR="$DEST_DIR/$PLUGIN_SLUG"
BLOCK_DIR="$TARGET_DIR/blocks/$BLOCK_SLUG"

# --- Parse attributes into parallel arrays ---
ATTR_NAMES=()
ATTR_TYPES=()
ATTR_DEFAULTS=()      # JSON-encoded default, "" sentinel means "unset → empty"
VALID_TYPES="string number boolean array object"

if [ -n "$ATTR_SPEC" ]; then
  IFS=',' read -ra _specs <<< "$ATTR_SPEC"
  for spec in "${_specs[@]}"; do
    spec="$(printf '%s' "$spec" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
    [ -n "$spec" ] || continue
    aname="${spec%%:*}"
    if [ "$aname" = "$spec" ]; then
      atype="string"; araw=""
    else
      rest="${spec#*:}"
      atype="${rest%%:*}"
      if [ "$atype" = "$rest" ]; then araw=""; else araw="${rest#*:}"; fi
    fi
    if ! [[ "$aname" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
      die "Invalid attribute name '$aname'. Use a valid identifier (letters, digits, underscore; camelCase recommended)."
    fi
    case " $VALID_TYPES " in
      *" $atype "*) ;;
      *) die "Invalid attribute type '$atype' for '$aname'. Allowed: $VALID_TYPES." ;;
    esac
    # JSON-encode the default by type.
    case "$atype" in
      string)
        if [ -n "$araw" ]; then adef="\"$(printf '%s' "$araw" | sed 's/"/\\"/g')\""; else adef="\"\""; fi ;;
      number)
        if [ -n "$araw" ]; then
          [[ "$araw" =~ ^-?[0-9]+(\.[0-9]+)?$ ]] || die "Default for number attribute '$aname' must be numeric, got '$araw'."
          adef="$araw"
        else adef="0"; fi ;;
      boolean)
        case "$araw" in
          ""|false|0) adef="false" ;;
          true|1)     adef="true" ;;
          *) die "Default for boolean attribute '$aname' must be true/false, got '$araw'." ;;
        esac ;;
      array)  adef="[]" ;;
      object) adef="{}" ;;
    esac
    ATTR_NAMES+=("$aname")
    ATTR_TYPES+=("$atype")
    ATTR_DEFAULTS+=("$adef")
  done
fi
ATTR_COUNT=${#ATTR_NAMES[@]}

# --- Pre-flight ---
[ -d "$DEST_DIR" ] || { [ "$DRY_RUN" -eq 1 ] || mkdir -p "$DEST_DIR"; }
if [ -e "$TARGET_DIR" ]; then
  if [ "$FORCE" -eq 1 ]; then
    [ "$DRY_RUN" -eq 1 ] || rm -rf "$TARGET_DIR"
  else
    die "$TARGET_DIR already exists. Re-run with --force to overwrite."
  fi
fi

# --- Build JSON keywords array ---
build_json_array() {
  local csv="$1" out="[" first=1 item
  IFS=',' read -ra _items <<< "$csv"
  for item in "${_items[@]}"; do
    item="$(printf '%s' "$item" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
    [ -n "$item" ] || continue
    [ "$first" -eq 1 ] || out+=", "
    out+="\"$(printf '%s' "$item" | sed 's/"/\\"/g')\""
    first=0
  done
  out+="]"
  printf '%s' "$out"
}
KEYWORDS_JSON="$(build_json_array "$KEYWORDS")"

# ===========================================================================
# Snippet generators (produce multiline strings; no trailing newline)
# ===========================================================================

# Emits the full '    "attributes": { ... },' line(s) so the surrounding key
# prefix survives the whole-line inject_multiline replacement.
gen_attributes_block() {
  if [ "$ATTR_COUNT" -eq 0 ]; then printf '    "attributes": {},'; return; fi
  local i body="" sep=""
  for ((i=0; i<ATTR_COUNT; i++)); do
    body+="${sep}        \"${ATTR_NAMES[$i]}\": {
            \"type\": \"${ATTR_TYPES[$i]}\",
            \"default\": ${ATTR_DEFAULTS[$i]}
        }"
    sep=",
"
  done
  printf '    "attributes": {\n%s\n    },' "$body"
}

gen_edit_controls() {
  if [ "$ATTR_COUNT" -eq 0 ]; then
    printf "\t\t\t\t\t\tel( 'p', null, __( 'This block has no editable settings.', '%s' ) )" "$TEXT_DOMAIN"
    return
  fi
  local i name type label out="" sep="" has=0
  for ((i=0; i<ATTR_COUNT; i++)); do
    name="${ATTR_NAMES[$i]}"; type="${ATTR_TYPES[$i]}"; label="$(humanize "$name")"
    case "$type" in
      string)
        out+="${sep}\t\t\t\t\t\tel( TextControl, {
\t\t\t\t\t\t\tlabel: __( '${label}', '${TEXT_DOMAIN}' ),
\t\t\t\t\t\t\tvalue: attributes.${name},
\t\t\t\t\t\t\tonChange: function ( value ) {
\t\t\t\t\t\t\t\tsetAttributes( { ${name}: value } );
\t\t\t\t\t\t\t},
\t\t\t\t\t\t} )"
        sep=",\n"; has=1 ;;
      number)
        out+="${sep}\t\t\t\t\t\tel( TextControl, {
\t\t\t\t\t\t\tlabel: __( '${label}', '${TEXT_DOMAIN}' ),
\t\t\t\t\t\t\ttype: 'number',
\t\t\t\t\t\t\tvalue: String( attributes.${name} ),
\t\t\t\t\t\t\tonChange: function ( value ) {
\t\t\t\t\t\t\t\tsetAttributes( { ${name}: parseFloat( value ) || 0 } );
\t\t\t\t\t\t\t},
\t\t\t\t\t\t} )"
        sep=",\n"; has=1 ;;
      boolean)
        out+="${sep}\t\t\t\t\t\tel( ToggleControl, {
\t\t\t\t\t\t\tlabel: __( '${label}', '${TEXT_DOMAIN}' ),
\t\t\t\t\t\t\tchecked: !! attributes.${name},
\t\t\t\t\t\t\tonChange: function ( value ) {
\t\t\t\t\t\t\t\tsetAttributes( { ${name}: value } );
\t\t\t\t\t\t\t},
\t\t\t\t\t\t} )"
        sep=",\n"; has=1 ;;
      *) : ;; # array/object: no auto control
    esac
  done
  if [ "$has" -eq 0 ]; then
    printf "\t\t\t\t\t\tel( 'p', null, __( 'Edit %s / %s attributes in code.', '%s' ) )" "array" "object" "$TEXT_DOMAIN"
    return
  fi
  printf '%b' "$out"
}

# Emits the full '\t\tsave: <fn>' line so the 'save:' key survives the
# whole-line inject_multiline replacement.
gen_save_function() {
  if [ "$DYNAMIC" -eq 1 ]; then
    printf '\t\tsave: function () {\n\t\t\treturn null;\n\t\t}'
    return
  fi
  # Static: serialize scalar attributes into markup.
  local i name type out="" sep="" has=0
  for ((i=0; i<ATTR_COUNT; i++)); do
    name="${ATTR_NAMES[$i]}"; type="${ATTR_TYPES[$i]}"
    case "$type" in
      string|number)
        out+="${sep}\t\t\t\tel( 'p', { className: '${CSS_BASE}__${name}' }, String( attributes.${name} ) )"
        sep=",\n"; has=1 ;;
      boolean)
        out+="${sep}\t\t\t\tattributes.${name} ? el( 'p', { className: '${CSS_BASE}__${name}' }, '${name}' ) : null"
        sep=",\n"; has=1 ;;
      *) : ;;
    esac
  done
  [ "$has" -eq 1 ] || out="\t\t\t\tnull"
  printf '\t\tsave: function ( props ) {\n\t\t\tvar attributes = props.attributes;\n\t\t\tvar blockProps = useBlockProps.save();\n\t\t\treturn el(\n\t\t\t\t%bdiv%b,\n\t\t\t\tblockProps,\n%b\n\t\t\t);\n\t\t}' "'" "'" "$(printf '%b' "$out")"
}

gen_render_body() {
  if [ "$ATTR_COUNT" -eq 0 ]; then
    printf '\t<?php echo wp_kses_post( $content ); ?>'
    return
  fi
  local i name type label out="" first=1
  for ((i=0; i<ATTR_COUNT; i++)); do
    name="${ATTR_NAMES[$i]}"; type="${ATTR_TYPES[$i]}"; label="$(humanize "$name")"
    [ "$first" -eq 1 ] || out+="\n"
    case "$type" in
      string|number)
        out+="\t<p class=\"${CSS_BASE}__${name}\"><?php echo esc_html( (string) ( \$attributes['${name}'] ?? '' ) ); ?></p>" ;;
      boolean)
        out+="\t<?php if ( ! empty( \$attributes['${name}'] ) ) : ?>\n\t\t<p class=\"${CSS_BASE}__${name}\"><?php esc_html_e( '${label}', '${TEXT_DOMAIN}' ); ?></p>\n\t<?php endif; ?>" ;;
      *)
        out+="\t<?php /* '${name}' (${type}) — render in code as needed. */ ?>" ;;
    esac
    first=0
  done
  printf '%b' "$out"
}

gen_test_attr_assertions() {
  if [ "$ATTR_COUNT" -eq 0 ]; then
    printf '\t\t$this->assertIsArray( $this->block_json()[%battributes%b] ?? array() );' "'" "'"
    return
  fi
  local i out="" first=1
  for ((i=0; i<ATTR_COUNT; i++)); do
    [ "$first" -eq 1 ] || out+="\n"
    out+="\t\t\$this->assertArrayHasKey( '${ATTR_NAMES[$i]}', \$attributes );"
    first=0
  done
  printf '%b' "$out"
}

# Emits the closing '}' of the preceding method first (it shares the token's
# line), then — for dynamic blocks only — the render test method.
gen_test_render_method() {
  if [ "$DYNAMIC" -eq 0 ]; then printf '\t}'; return; fi
  local i sample="" name type val
  for ((i=0; i<ATTR_COUNT; i++)); do
    name="${ATTR_NAMES[$i]}"; type="${ATTR_TYPES[$i]}"
    case "$type" in
      string)  val="'Sample'" ;;
      number)  val="1" ;;
      boolean) val="true" ;;
      array)   val="array()" ;;
      object)  val="array()" ;;
    esac
    sample+="\t\t\t'${name}' => ${val},\n"
  done
  printf '\t}\n\n\t/**\n\t * The render template should emit the block wrapper element.\n\t *\n\t * @return void\n\t */\n\tpublic function test_render_emits_wrapper_markup(): void {\n\t\t$attributes = array(\n%b\t\t);\n\t\t$content = %b%b;\n\t\t$block   = null;\n\n\t\tob_start();\n\t\trequire dirname( __DIR__ ) . %b/blocks/%s/render.php%b;\n\t\t$html = (string) ob_get_clean();\n\n\t\t$this->assertStringContainsString( %b<div%b, $html );\n\t}' \
    "$sample" "'" "'" "'" "$BLOCK_SLUG" "'" "'" "'"
}

# The block.json style/render line. Injected as a full-line replacement so the
# (multiline) dynamic "render" field never has to pass through sed.
if [ "$DYNAMIC" -eq 1 ]; then
  RENDER_FIELD='    "style": "file:./style.css",
    "render": "file:./render.php"'
else
  RENDER_FIELD='    "style": "file:./style.css"'
fi

# ===========================================================================
# Plan output
# ===========================================================================
printf '\xe2\x96\xb8 Scaffolding block: %s/%s\n' "$NAMESPACE" "$BLOCK_SLUG"
printf '  Title:        %s\n' "$TITLE"
printf '  Mode:         %s\n' "$([ "$DYNAMIC" -eq 1 ] && echo 'dynamic (server-rendered)' || echo 'static (save markup)')"
printf '  Attributes:   %d\n' "$ATTR_COUNT"
printf '  PHP package:  %s\n' "$PHP_NAMESPACE"
printf '  Text domain:  %s\n' "$TEXT_DOMAIN"
printf '  Target:       %s\n' "$TARGET_DIR"
[ "$DRY_RUN" -eq 1 ] && printf '  Dry-run:      yes\n'
echo ""

# List of files to be produced.
FILES=(
  "$PLUGIN_SLUG.php"
  "blocks/$BLOCK_SLUG/block.json"
  "blocks/$BLOCK_SLUG/index.js"
  "blocks/$BLOCK_SLUG/index.asset.php"
  "blocks/$BLOCK_SLUG/editor.css"
  "blocks/$BLOCK_SLUG/style.css"
)
[ "$DYNAMIC" -eq 1 ] && FILES+=("blocks/$BLOCK_SLUG/render.php")
FILES+=(
  "tests/${BLOCK_CLASS}Test.php"
  "tests/bootstrap.php"
  "phpunit.xml.dist"
  "README.md"
)

if [ "$DRY_RUN" -eq 1 ]; then
  for f in "${FILES[@]}"; do printf '  + %s\n' "$f"; done
  echo ""
  printf '\xe2\x9c\x93 Dry run: would write %d files to %s\n' "${#FILES[@]}" "$TARGET_DIR"
  exit 0
fi

mkdir -p "$BLOCK_DIR" "$TARGET_DIR/tests"

# Apply all scalar token replacements to a file, in place.
sub() {
  local file="$1" tmp
  tmp="$(mktemp)"
  sed \
    -e "s|{{NAMESPACE}}|$(sed_escape "$NAMESPACE")|g" \
    -e "s|{{BLOCK_SLUG}}|$(sed_escape "$BLOCK_SLUG")|g" \
    -e "s|{{BLOCK_CLASS}}|$(sed_escape "$BLOCK_CLASS")|g" \
    -e "s|{{CSS_BASE}}|$(sed_escape "$CSS_BASE")|g" \
    -e "s|{{TITLE}}|$(sed_escape "$TITLE")|g" \
    -e "s|{{PLUGIN_NAME}}|$(sed_escape "$PLUGIN_NAME")|g" \
    -e "s|{{DESCRIPTION}}|$(sed_escape "$DESCRIPTION")|g" \
    -e "s|{{CATEGORY}}|$(sed_escape "$CATEGORY")|g" \
    -e "s|{{ICON}}|$(sed_escape "$ICON")|g" \
    -e "s|{{KEYWORDS_JSON}}|$(sed_escape "$KEYWORDS_JSON")|g" \
    -e "s|{{TEXT_DOMAIN}}|$(sed_escape "$TEXT_DOMAIN")|g" \
    -e "s|{{AUTHOR}}|$(sed_escape "$AUTHOR")|g" \
    -e "s|{{VERSION}}|$(sed_escape "$VERSION")|g" \
    -e "s|{{PHP_NAMESPACE}}|$(sed_escape "$PHP_NAMESPACE")|g" \
    "$file" > "$tmp"
  mv "$tmp" "$file"
}

# --- block.json ---
cat > "$BLOCK_DIR/block.json" <<'TPL'
{
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "{{NAMESPACE}}/{{BLOCK_SLUG}}",
    "version": "{{VERSION}}",
    "title": "{{TITLE}}",
    "category": "{{CATEGORY}}",
    "icon": "{{ICON}}",
    "description": "{{DESCRIPTION}}",
    "keywords": {{KEYWORDS_JSON}},
    "supports": {
        "html": false,
        "anchor": true
    },
    "textdomain": "{{TEXT_DOMAIN}}",
{{ATTRIBUTES_BLOCK}}
    "editorScript": "file:./index.js",
    "editorStyle": "file:./editor.css",
{{RENDER_FIELD}}
}
TPL
SNIP="$(gen_attributes_block)" inject_multiline '{{ATTRIBUTES_BLOCK}}' "$BLOCK_DIR/block.json"
SNIP="$RENDER_FIELD" inject_multiline '{{RENDER_FIELD}}' "$BLOCK_DIR/block.json"
sub "$BLOCK_DIR/block.json"

# --- index.js ---
cat > "$BLOCK_DIR/index.js" <<'TPL'
/* global window */
/**
 * Editor registration for the {{TITLE}} block.
 *
 * No build step: the dependencies declared in index.asset.php
 * (wp-blocks, wp-element, wp-block-editor, wp-components, wp-i18n) guarantee
 * the WordPress runtime globals are loaded before this script runs.
 *
 * @package {{PHP_NAMESPACE}}
 */
( function ( wp ) {
	'use strict';

	var blocks      = wp.blocks;
	var element     = wp.element;
	var blockEditor = wp.blockEditor;
	var components  = wp.components;
	var i18n        = wp.i18n;

	var registerBlockType = blocks.registerBlockType;
	var useBlockProps     = blockEditor.useBlockProps;
	var InspectorControls = blockEditor.InspectorControls;
	var PanelBody         = components.PanelBody;
	var TextControl       = components.TextControl;
	var ToggleControl     = components.ToggleControl;
	var Fragment          = element.Fragment;
	var el                = element.createElement;
	var __                = i18n.__;

	registerBlockType( '{{NAMESPACE}}/{{BLOCK_SLUG}}', {
		edit: function ( props ) {
			var attributes    = props.attributes;
			var setAttributes = props.setAttributes;
			var blockProps    = useBlockProps( { className: '{{CSS_BASE}}__editor' } );

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Settings', '{{TEXT_DOMAIN}}' ), initialOpen: true },
{{EDIT_CONTROLS}}
					)
				),
				el(
					'div',
					blockProps,
					el( 'strong', null, __( '{{TITLE}}', '{{TEXT_DOMAIN}}' ) )
				)
			);
		},
{{SAVE_FUNCTION}}
	} );
}( window.wp ) );
TPL
SNIP="$(gen_edit_controls)" inject_multiline '{{EDIT_CONTROLS}}' "$BLOCK_DIR/index.js"
SNIP="$(gen_save_function)" inject_multiline '{{SAVE_FUNCTION}}' "$BLOCK_DIR/index.js"
sub "$BLOCK_DIR/index.js"

# --- index.asset.php (script deps + version; lets WP enqueue wp-* packages) ---
cat > "$BLOCK_DIR/index.asset.php" <<'TPL'
<?php
/**
 * Script dependencies + version for the {{TITLE}} block editor script.
 *
 * Mirrors what @wordpress/scripts would emit, so the no-build index.js gets
 * its WordPress package dependencies enqueued in the right order.
 *
 * @package {{PHP_NAMESPACE}}
 */

return array(
	'dependencies' => array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
	'version'      => '{{VERSION}}',
);
TPL
sub "$BLOCK_DIR/index.asset.php"

# --- editor.css ---
cat > "$BLOCK_DIR/editor.css" <<'TPL'
/* {{TITLE}} — editor-only styles */

.{{CSS_BASE}}__editor {
	padding: 1rem;
	border: 1px dashed #c3c4c7;
	border-radius: 4px;
	background: #f6f7f7;
	color: #50575e;
}
TPL
sub "$BLOCK_DIR/editor.css"

# --- style.css ---
cat > "$BLOCK_DIR/style.css" <<'TPL'
/* {{TITLE}} — front-end styles */

.{{CSS_BASE}} {
	padding: 1.5rem;
	border: 1px solid #e0e0e0;
	border-radius: 4px;
	background: #fff;
}
TPL
sub "$BLOCK_DIR/style.css"

# --- render.php (dynamic only) ---
if [ "$DYNAMIC" -eq 1 ]; then
  cat > "$BLOCK_DIR/render.php" <<'TPL'
<?php
/**
 * Server-side render for the {{TITLE}} block.
 *
 * Invoked by WordPress via the "render" field in block.json. These variables
 * are in scope:
 *   - array    $attributes Block attributes.
 *   - string   $content    Inner block HTML.
 *   - WP_Block $block      Block instance.
 *
 * @package {{PHP_NAMESPACE}}
 */

defined( 'ABSPATH' ) || exit;

$wrapper_attributes = get_block_wrapper_attributes();
?>
<div <?php echo wp_kses_data( $wrapper_attributes ); ?>>
{{RENDER_BODY}}
</div>
TPL
  SNIP="$(gen_render_body)" inject_multiline '{{RENDER_BODY}}' "$BLOCK_DIR/render.php"
  sub "$BLOCK_DIR/render.php"
fi

# --- Plugin main file ---
cat > "$TARGET_DIR/$PLUGIN_SLUG.php" <<'TPL'
<?php
/**
 * Plugin Name:       {{PLUGIN_NAME}}
 * Description:       {{DESCRIPTION}}
 * Version:           {{VERSION}}
 * Requires at least: 6.4
 * Requires PHP:      8.0
 * Author:            {{AUTHOR}}
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       {{TEXT_DOMAIN}}
 *
 * @package {{PHP_NAMESPACE}}
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

/**
 * Register the {{TITLE}} block from its block.json metadata.
 *
 * register_block_type() reads block.json (attributes, scripts, styles and, for
 * dynamic blocks, the render template), so no further wiring is required.
 *
 * @return void
 */
add_action(
	'init',
	static function (): void {
		register_block_type( __DIR__ . '/blocks/{{BLOCK_SLUG}}' );
	}
);
TPL
sub "$TARGET_DIR/$PLUGIN_SLUG.php"

# --- PHPUnit test stub ---
cat > "$TARGET_DIR/tests/${BLOCK_CLASS}Test.php" <<'TPL'
<?php
/**
 * Tests for the {{TITLE}} block.
 *
 * @package {{PHP_NAMESPACE}}\Tests
 */

declare( strict_types=1 );

namespace {{PHP_NAMESPACE}}\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @coversNothing
 */
final class {{BLOCK_CLASS}}Test extends TestCase {

	/**
	 * Load and decode the block's block.json.
	 *
	 * @return array<string, mixed>
	 */
	private function block_json(): array {
		$path = dirname( __DIR__ ) . '/blocks/{{BLOCK_SLUG}}/block.json';
		$this->assertFileExists( $path );
		$data = json_decode( (string) file_get_contents( $path ), true );
		$this->assertIsArray( $data );
		return $data;
	}

	/**
	 * block.json should declare the namespaced block name.
	 *
	 * @return void
	 */
	public function test_block_json_declares_expected_name(): void {
		$this->assertSame( '{{NAMESPACE}}/{{BLOCK_SLUG}}', $this->block_json()['name'] );
	}

	/**
	 * block.json should declare every supported attribute.
	 *
	 * @return void
	 */
	public function test_block_json_declares_supported_attributes(): void {
		$attributes = $this->block_json()['attributes'] ?? array();
{{TEST_ATTR_ASSERTIONS}}
	}{{TEST_RENDER_METHOD}}
}
TPL
SNIP="$(gen_test_attr_assertions)" inject_multiline '{{TEST_ATTR_ASSERTIONS}}' "$TARGET_DIR/tests/${BLOCK_CLASS}Test.php"
SNIP="$(gen_test_render_method)" inject_multiline '{{TEST_RENDER_METHOD}}' "$TARGET_DIR/tests/${BLOCK_CLASS}Test.php"
sub "$TARGET_DIR/tests/${BLOCK_CLASS}Test.php"

# --- Test bootstrap (lightweight WP stubs; no Composer needed) ---
cat > "$TARGET_DIR/tests/bootstrap.php" <<'TPL'
<?php
/**
 * Minimal PHPUnit bootstrap for the {{TITLE}} block.
 *
 * Stubs the handful of WordPress functions the render template touches so the
 * test stub runs without a full WordPress test harness. Replace with the WP
 * PHPUnit suite (or Brain Monkey) as the block grows.
 *
 * @package {{PHP_NAMESPACE}}\Tests
 */

declare( strict_types=1 );

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES );
	}
}

if ( ! function_exists( 'esc_html_e' ) ) {
	function esc_html_e( $text, $domain = 'default' ) {
		echo htmlspecialchars( (string) $text, ENT_QUOTES );
	}
}

if ( ! function_exists( 'esc_attr' ) ) {
	function esc_attr( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES );
	}
}

if ( ! function_exists( 'wp_kses_data' ) ) {
	function wp_kses_data( $data ) {
		return (string) $data;
	}
}

if ( ! function_exists( 'wp_kses_post' ) ) {
	function wp_kses_post( $data ) {
		return (string) $data;
	}
}

if ( ! function_exists( 'get_block_wrapper_attributes' ) ) {
	function get_block_wrapper_attributes( $extra = array() ) {
		return 'class="{{CSS_BASE}}"';
	}
}
TPL
sub "$TARGET_DIR/tests/bootstrap.php"

# --- phpunit.xml.dist ---
cat > "$TARGET_DIR/phpunit.xml.dist" <<'TPL'
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         bootstrap="tests/bootstrap.php"
         colors="true"
         failOnWarning="true"
         failOnRisky="true">
    <testsuites>
        <testsuite name="{{TEXT_DOMAIN}}">
            <directory>tests</directory>
        </testsuite>
    </testsuites>
</phpunit>
TPL
sub "$TARGET_DIR/phpunit.xml.dist"

# --- README ---
cat > "$TARGET_DIR/README.md" <<'TPL'
# {{TITLE}}

Custom Gutenberg block `{{NAMESPACE}}/{{BLOCK_SLUG}}`, scaffolded with
`scripts/scaffold-block.sh`.

## What's inside

```
{{BLOCK_SLUG}}/
├── {{BLOCK_SLUG}}.php              # Plugin header + register_block_type()
├── blocks/{{BLOCK_SLUG}}/
│   ├── block.json                 # Metadata, attributes, supports
│   ├── index.js                   # edit() + save() (no build step)
│   ├── index.asset.php            # Script dependencies + version
│   ├── editor.css                 # Editor-only styles
│   ├── style.css                  # Front-end styles
│   └── render.php                 # Dynamic render (dynamic blocks only)
├── tests/
│   ├── {{BLOCK_CLASS}}Test.php     # PHPUnit stub
│   └── bootstrap.php              # Lightweight WP stubs
├── phpunit.xml.dist
└── README.md
```

No build step is required — `index.js` uses the WordPress runtime globals and
`index.asset.php` declares the package dependencies.

## Smoke test

```bash
# 1. Copy to a WordPress install (root-level → wp-content per CLAUDE.md)
cp -r . /path/to/wordpress/wp-content/plugins/{{BLOCK_SLUG}}

# 2. Activate
wp plugin activate {{BLOCK_SLUG}}

# 3. Confirm registration
wp eval 'var_dump( WP_Block_Type_Registry::get_instance()->is_registered( "{{NAMESPACE}}/{{BLOCK_SLUG}}" ) );'

# 4. Insert the block on a page and view it on the front end.
```

## Tests

```bash
phpunit            # uses phpunit.xml.dist
```
TPL
sub "$TARGET_DIR/README.md"

# --- Done ---
echo ""
printf '\xe2\x9c\x93 Wrote %d files to %s\n' "${#FILES[@]}" "$TARGET_DIR"
printf '\nNext steps:\n'
printf '  # Copy to your WordPress install and activate:\n'
printf '  cp -r %s <wp>/wp-content/plugins/%s\n' "$TARGET_DIR" "$PLUGIN_SLUG"
printf '  wp plugin activate %s\n' "$PLUGIN_SLUG"
printf '  # Run the test stub:\n'
printf '  ( cd %s && phpunit )\n' "$TARGET_DIR"
