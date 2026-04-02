#!/usr/bin/env bash
# parse-canva-export.sh - Extract design tokens from Canva CSS exports
# Produces theme.json-compatible JSON fragments for WordPress FSE themes
set -e

# --- Helpers ---

die() {
    echo "Error [parse-canva-export.sh]: $1" >&2
    exit 1
}

validate_file() {
    local file="$1"
    [[ -f "$file" ]] || die "File not found: $file"
}

# Convert an rgb(r, g, b) string to #rrggbb hex
rgb_to_hex() {
    local input="$1"
    # Strip everything except digits and commas
    local stripped
    stripped=$(echo "$input" | tr -d ' ' | sed 's/rgb(//' | sed 's/)//')
    local r g b
    r=$(echo "$stripped" | cut -d',' -f1)
    g=$(echo "$stripped" | cut -d',' -f2)
    b=$(echo "$stripped" | cut -d',' -f3)
    printf '#%02x%02x%02x' "$r" "$g" "$b"
}

# Map a pixel value to a t-shirt size slug for font sizes
fontsize_slug() {
    local px="${1%px}"
    if   (( px <= 12 )); then echo "x-small"
    elif (( px <= 14 )); then echo "small"
    elif (( px <= 16 )); then echo "base"
    elif (( px <= 20 )); then echo "medium"
    elif (( px <= 24 )); then echo "large"
    elif (( px <= 32 )); then echo "x-large"
    elif (( px <= 48 )); then echo "xx-large"
    else echo "huge"
    fi
}

# Map a pixel value to a WordPress spacing scale slug
spacing_slug() {
    local px="${1%px}"
    if   (( px <= 4  )); then echo "20"
    elif (( px <= 8  )); then echo "30"
    elif (( px <= 16 )); then echo "40"
    elif (( px <= 24 )); then echo "50"
    elif (( px <= 32 )); then echo "60"
    elif (( px <= 48 )); then echo "70"
    elif (( px <= 64 )); then echo "80"
    else echo "90"
    fi
}

# --- Extraction functions ---

extract_colors() {
    local file="$1"
    validate_file "$file"

    local idx=0

    # Collect unique hex colors
    local hex_colors
    hex_colors=$(grep -oE '#[0-9A-Fa-f]{6}' "$file" 2>/dev/null | sort -u || true)

    # Collect unique rgb() colors, convert to hex
    local rgb_colors
    rgb_colors=$(grep -oE 'rgb\([0-9]+,[[:space:]]*[0-9]+,[[:space:]]*[0-9]+\)' "$file" 2>/dev/null | sort -u || true)

    local all_hex=""
    if [[ -n "$hex_colors" ]]; then
        all_hex="$hex_colors"
    fi
    if [[ -n "$rgb_colors" ]]; then
        while IFS= read -r rgb_line; do
            [[ -z "$rgb_line" ]] && continue
            local converted
            converted=$(rgb_to_hex "$rgb_line")
            all_hex=$(printf '%s\n%s' "$all_hex" "$converted")
        done <<< "$rgb_colors"
    fi

    # Deduplicate the combined list
    all_hex=$(echo "$all_hex" | grep -v '^$' | sort -u)

    echo "["
    local first=true
    while IFS= read -r color; do
        [[ -z "$color" ]] && continue
        idx=$((idx + 1))
        if $first; then first=false; else echo ","; fi
        printf '  { "slug": "color-%d", "color": "%s", "name": "Color %d" }' "$idx" "$color" "$idx"
    done <<< "$all_hex"
    echo ""
    echo "]"
}

extract_fonts() {
    local file="$1"
    validate_file "$file"

    # Extract quoted font family names (the primary font, not fallbacks)
    local fonts
    fonts=$(grep -oE 'font-family:\s*"[^"]+"' "$file" 2>/dev/null \
        | sed 's/font-family:\s*"//' | sed 's/"//' | sort -u || true)

    echo "["
    local first=true
    local idx=0
    while IFS= read -r font; do
        [[ -z "$font" ]] && continue
        idx=$((idx + 1))
        local slug
        slug=$(echo "$font" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
        if $first; then first=false; else echo ","; fi
        printf '  { "slug": "%s", "fontFamily": "%s", "name": "%s" }' "$slug" "$font" "$font"
    done <<< "$fonts"
    echo ""
    echo "]"
}

extract_font_sizes() {
    local file="$1"
    validate_file "$file"

    local sizes
    sizes=$(grep -oE 'font-size:\s*[0-9]+px' "$file" 2>/dev/null \
        | grep -oE '[0-9]+px' | sort -t'p' -k1 -n -u || true)

    echo "["
    local first=true
    while IFS= read -r size; do
        [[ -z "$size" ]] && continue
        local slug
        slug=$(fontsize_slug "$size")
        if $first; then first=false; else echo ","; fi
        printf '  { "slug": "%s", "size": "%s", "name": "%s" }' "$slug" "$size" "${slug}"
    done <<< "$sizes"
    echo ""
    echo "]"
}

extract_spacing() {
    local file="$1"
    validate_file "$file"

    # Extract numeric px values from padding, margin, and gap properties
    local values
    values=$(grep -oE '(padding|margin|gap)[^;]*;' "$file" 2>/dev/null \
        | grep -oE '[0-9]+px' | sort -t'p' -k1 -n -u || true)

    echo "["
    local first=true
    while IFS= read -r val; do
        [[ -z "$val" ]] && continue
        local slug
        slug=$(spacing_slug "$val")
        if $first; then first=false; else echo ","; fi
        printf '  { "slug": "%s", "size": "%s", "name": "Space %s" }' "$slug" "$val" "$slug"
    done <<< "$values"
    echo ""
    echo "]"
}

generate_theme_json() {
    local file="$1"
    validate_file "$file"

    local colors fonts font_sizes spacing
    colors=$(extract_colors "$file")
    fonts=$(extract_fonts "$file")
    font_sizes=$(extract_font_sizes "$file")
    spacing=$(extract_spacing "$file")

    cat <<THEME
{
  "settings": {
    "color": {
      "palette": $colors
    },
    "typography": {
      "fontFamilies": $fonts,
      "fontSizes": $font_sizes
    },
    "spacing": {
      "spacingSizes": $spacing
    }
  }
}
THEME
}

# --- Main ---

mode="${1:-}"
css_file="${2:-}"

case "$mode" in
    --colors)     extract_colors "$css_file" ;;
    --fonts)      extract_fonts "$css_file" ;;
    --font-sizes) extract_font_sizes "$css_file" ;;
    --spacing)    extract_spacing "$css_file" ;;
    --theme-json) generate_theme_json "$css_file" ;;
    *)
        echo "Usage: $(basename "$0") <--colors|--fonts|--font-sizes|--spacing|--theme-json> <css-file>"
        exit 1
        ;;
esac
