#!/bin/bash
# Optimize images in WordPress themes for production
#
# Usage:
#   ./scripts/wordpress/optimize-images.sh <theme-name>
#   ./scripts/wordpress/optimize-images.sh <theme-name> --dry-run
#
# Supports: PNG, JPG/JPEG, WebP, SVG
# Requirements: One of: cwebp, optipng, jpegoptim, or svgo (optional)

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
THEME_NAME="$1"
DRY_RUN=false

if [ "$2" = "--dry-run" ]; then
    DRY_RUN=true
fi

if [ -z "$THEME_NAME" ]; then
    echo "Usage: $0 <theme-name> [--dry-run]"
    echo ""
    echo "Available themes:"
    ls -d "$PROJECT_ROOT/themes"/*/ 2>/dev/null | xargs -I {} basename {} || echo "  (none)"
    exit 1
fi

ASSETS_DIR="$PROJECT_ROOT/themes/$THEME_NAME/assets/images"
if [ ! -d "$ASSETS_DIR" ]; then
    # Try without /images subdir
    ASSETS_DIR="$PROJECT_ROOT/themes/$THEME_NAME/assets"
    if [ ! -d "$ASSETS_DIR" ]; then
        echo "No assets directory found for theme: $THEME_NAME"
        echo "Looked in:"
        echo "  themes/$THEME_NAME/assets/images/"
        echo "  themes/$THEME_NAME/assets/"
        exit 1
    fi
fi

echo "=== Image Optimization ==="
echo "Theme: $THEME_NAME"
echo "Directory: $ASSETS_DIR"
[ "$DRY_RUN" = true ] && echo "Mode: DRY RUN (no changes)"
echo ""

# Check available tools
HAS_CWEBP=false
HAS_OPTIPNG=false
HAS_JPEGOPTIM=false
HAS_SVGO=false

command -v cwebp > /dev/null 2>&1 && HAS_CWEBP=true
command -v optipng > /dev/null 2>&1 && HAS_OPTIPNG=true
command -v jpegoptim > /dev/null 2>&1 && HAS_JPEGOPTIM=true
command -v svgo > /dev/null 2>&1 && HAS_SVGO=true

echo "Available tools:"
echo "  cwebp: $HAS_CWEBP"
echo "  optipng: $HAS_OPTIPNG"
echo "  jpegoptim: $HAS_JPEGOPTIM"
echo "  svgo: $HAS_SVGO"
echo ""

if [ "$HAS_CWEBP" = false ] && [ "$HAS_OPTIPNG" = false ] && [ "$HAS_JPEGOPTIM" = false ]; then
    echo "No image optimization tools found."
    echo ""
    echo "Install one or more:"
    echo "  Windows (scoop): scoop install cwebp optipng jpegoptim"
    echo "  Windows (choco): choco install webp optipng"
    echo "  macOS:           brew install webp optipng jpegoptim svgo"
    echo "  Linux:           apt install webp optipng jpegoptim && npm install -g svgo"
    exit 1
fi

TOTAL_BEFORE=0
TOTAL_AFTER=0
FILES_OPTIMIZED=0

# Calculate size of a file in bytes
file_size() {
    wc -c < "$1" | tr -d ' '
}

# Optimize PNG files
PNG_FILES=$(find "$ASSETS_DIR" -iname "*.png" 2>/dev/null)
if [ -n "$PNG_FILES" ] && [ "$HAS_OPTIPNG" = true ]; then
    echo "--- Optimizing PNG files ---"
    for f in $PNG_FILES; do
        BEFORE=$(file_size "$f")
        TOTAL_BEFORE=$((TOTAL_BEFORE + BEFORE))
        if [ "$DRY_RUN" = false ]; then
            optipng -o2 -quiet "$f" 2>/dev/null
            AFTER=$(file_size "$f")
        else
            AFTER=$BEFORE
        fi
        TOTAL_AFTER=$((TOTAL_AFTER + AFTER))
        SAVED=$((BEFORE - AFTER))
        if [ "$SAVED" -gt 0 ]; then
            echo "  $(basename "$f"): ${BEFORE}B → ${AFTER}B (saved ${SAVED}B)"
            FILES_OPTIMIZED=$((FILES_OPTIMIZED + 1))
        fi
    done
fi

# Optimize JPEG files
JPG_FILES=$(find "$ASSETS_DIR" \( -iname "*.jpg" -o -iname "*.jpeg" \) 2>/dev/null)
if [ -n "$JPG_FILES" ] && [ "$HAS_JPEGOPTIM" = true ]; then
    echo "--- Optimizing JPEG files ---"
    for f in $JPG_FILES; do
        BEFORE=$(file_size "$f")
        TOTAL_BEFORE=$((TOTAL_BEFORE + BEFORE))
        if [ "$DRY_RUN" = false ]; then
            jpegoptim --strip-all --max=85 -q "$f" 2>/dev/null
            AFTER=$(file_size "$f")
        else
            AFTER=$BEFORE
        fi
        TOTAL_AFTER=$((TOTAL_AFTER + AFTER))
        SAVED=$((BEFORE - AFTER))
        if [ "$SAVED" -gt 0 ]; then
            echo "  $(basename "$f"): ${BEFORE}B → ${AFTER}B (saved ${SAVED}B)"
            FILES_OPTIMIZED=$((FILES_OPTIMIZED + 1))
        fi
    done
fi

# Convert PNG/JPG to WebP
NON_WEBP=$(find "$ASSETS_DIR" \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) 2>/dev/null)
if [ -n "$NON_WEBP" ] && [ "$HAS_CWEBP" = true ]; then
    echo "--- Converting to WebP ---"
    for f in $NON_WEBP; do
        WEBP_PATH="${f%.*}.webp"
        if [ ! -f "$WEBP_PATH" ]; then
            if [ "$DRY_RUN" = false ]; then
                cwebp -q 80 "$f" -o "$WEBP_PATH" 2>/dev/null
                echo "  Created: $(basename "$WEBP_PATH")"
            else
                echo "  Would create: $(basename "$WEBP_PATH")"
            fi
        fi
    done
fi

# Optimize SVG files
SVG_FILES=$(find "$ASSETS_DIR" -iname "*.svg" 2>/dev/null)
if [ -n "$SVG_FILES" ] && [ "$HAS_SVGO" = true ]; then
    echo "--- Optimizing SVG files ---"
    for f in $SVG_FILES; do
        BEFORE=$(file_size "$f")
        if [ "$DRY_RUN" = false ]; then
            svgo -q "$f" 2>/dev/null
            AFTER=$(file_size "$f")
            SAVED=$((BEFORE - AFTER))
            if [ "$SAVED" -gt 0 ]; then
                echo "  $(basename "$f"): ${BEFORE}B → ${AFTER}B (saved ${SAVED}B)"
                FILES_OPTIMIZED=$((FILES_OPTIMIZED + 1))
            fi
        fi
    done
fi

echo ""
echo "=== Summary ==="
echo "  Files optimized: $FILES_OPTIMIZED"
if [ "$TOTAL_BEFORE" -gt 0 ]; then
    TOTAL_SAVED=$((TOTAL_BEFORE - TOTAL_AFTER))
    echo "  Total before: ${TOTAL_BEFORE}B"
    echo "  Total after: ${TOTAL_AFTER}B"
    echo "  Saved: ${TOTAL_SAVED}B"
fi
