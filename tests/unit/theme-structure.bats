#!/usr/bin/env bats
# Validates that every WordPress FSE theme under themes/ has the minimum
# required file structure. A theme missing critical files (theme.json,
# templates/index.html, header/footer parts) silently breaks in WordPress
# — these tests catch the regression at CI time, before deployment.
#
# Required files for a valid FSE block theme:
#   * theme.json          — must exist and be valid JSON
#   * style.css           — must exist and contain a "Theme Name:" header
#   * templates/index.html
#   * parts/header.html
#   * parts/footer.html

load '../test_helper'

THEMES_DIR="${PROJECT_ROOT}/themes"

# Print one absolute theme directory per line (direct subdirectories of themes/).
discover_themes() {
    [[ -d "$THEMES_DIR" ]] || return 0
    local entry
    for entry in "$THEMES_DIR"/*/; do
        [[ -d "$entry" ]] || continue
        printf '%s\n' "${entry%/}"
    done
}

# Assert a relative file path exists in every discovered theme.
# Skips when themes/ contains no theme directories (fixture tests below
# still cover the validation logic so this is not a silent pass).
assert_file_in_every_theme() {
    local relative_path="$1"
    local themes
    themes=$(discover_themes)
    if [[ -z "$themes" ]]; then
        skip "no themes present in themes/"
    fi

    local missing=()
    local theme
    while IFS= read -r theme; do
        [[ -f "$theme/$relative_path" ]] || missing+=("$(basename "$theme")")
    done <<< "$themes"

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Themes missing $relative_path: ${missing[*]}"
        return 1
    fi
}

# --- Discovery sanity ---

@test "themes/ directory exists" {
    [ -d "$THEMES_DIR" ]
}

# --- Per-theme structural checks (loop over every theme in themes/) ---

@test "every theme has theme.json" {
    assert_file_in_every_theme "theme.json"
}

@test "every theme has style.css" {
    assert_file_in_every_theme "style.css"
}

@test "every theme has templates/index.html" {
    assert_file_in_every_theme "templates/index.html"
}

@test "every theme has parts/header.html" {
    assert_file_in_every_theme "parts/header.html"
}

@test "every theme has parts/footer.html" {
    assert_file_in_every_theme "parts/footer.html"
}

@test "every theme.json is valid JSON" {
    local themes
    themes=$(discover_themes)
    [[ -n "$themes" ]] || skip "no themes present in themes/"

    local invalid=()
    local theme
    while IFS= read -r theme; do
        local theme_json="$theme/theme.json"
        [[ -f "$theme_json" ]] || continue
        if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$theme_json" 2>/dev/null; then
            invalid+=("$(basename "$theme")")
        fi
    done <<< "$themes"

    if [[ ${#invalid[@]} -gt 0 ]]; then
        echo "Themes with invalid theme.json: ${invalid[*]}"
        return 1
    fi
}

@test "every style.css declares a Theme Name header" {
    local themes
    themes=$(discover_themes)
    [[ -n "$themes" ]] || skip "no themes present in themes/"

    local missing=()
    local theme
    while IFS= read -r theme; do
        local style_css="$theme/style.css"
        [[ -f "$style_css" ]] || continue
        if ! grep -q "Theme Name:" "$style_css"; then
            missing+=("$(basename "$theme")")
        fi
    done <<< "$themes"

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Themes missing 'Theme Name:' header in style.css: ${missing[*]}"
        return 1
    fi
}

# --- Fixture-based regression tests (always run) ---
# Exercise the validation criteria against known-good and known-bad fixtures
# so the rules stay verified even when themes/ is empty.

@test "fixture: test-theme has every required FSE file" {
    local fixture="${FIXTURES_DIR}/themes/test-theme"
    [ -f "${fixture}/theme.json" ]
    [ -f "${fixture}/style.css" ]
    [ -f "${fixture}/templates/index.html" ]
    [ -f "${fixture}/parts/header.html" ]
    [ -f "${fixture}/parts/footer.html" ]
}

@test "fixture: test-theme theme.json is valid JSON" {
    local fixture="${FIXTURES_DIR}/themes/test-theme"
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "${fixture}/theme.json"
}

@test "fixture: test-theme style.css declares Theme Name header" {
    local fixture="${FIXTURES_DIR}/themes/test-theme"
    grep -q "Theme Name:" "${fixture}/style.css"
}

@test "fixture: test-theme-invalid is missing required header/footer parts" {
    local fixture="${FIXTURES_DIR}/themes/test-theme-invalid"
    [ ! -f "${fixture}/parts/header.html" ]
    [ ! -f "${fixture}/parts/footer.html" ]
}
