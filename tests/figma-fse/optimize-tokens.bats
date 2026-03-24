#!/usr/bin/env bats
# Tests for scripts/figma-fse/optimize-tokens.sh
# Analyzes templates for hardcoded values and suggests theme.json tokens

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/optimize-tokens.sh"

# --- Missing templates directory ---

@test "optimize-tokens: fails when templates directory missing" {
    run bash "$SCRIPT" "/nonexistent/theme"
    assert_failure
    assert_output --partial "No templates directory found"
}

# --- Valid theme with no hardcoded values ---

@test "optimize-tokens: reports zero hardcoded values for clean theme" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme"
    assert_success
    assert_output --partial "Total hardcoded values found: 0"
    assert_output --partial "EXCELLENT"
}

@test "optimize-tokens: shows spacing analysis section" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme"
    assert_success
    assert_output --partial "Spacing Analysis"
}

@test "optimize-tokens: shows font size analysis section" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme"
    assert_success
    assert_output --partial "Font Size Analysis"
}

@test "optimize-tokens: shows color analysis section" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme"
    assert_success
    assert_output --partial "Color Analysis"
}

# --- Invalid theme with hardcoded values ---

@test "optimize-tokens: detects hardcoded colors in invalid theme" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme-invalid"
    assert_success
    assert_output --partial "Color Analysis"
    assert_output --partial "#0066CC"
}

@test "optimize-tokens: detects hardcoded pixel sizes in invalid theme" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme-invalid"
    assert_success
    assert_output --partial "Font Size Analysis"
}

@test "optimize-tokens: reports GOOD for few hardcoded values" {
    # The invalid theme has only 3 hardcoded values (<=10), which triggers GOOD
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme-invalid"
    assert_success
    assert_output --partial "GOOD"
}

@test "optimize-tokens: reports NEEDS WORK for many hardcoded values" {
    # Create a theme with >10 hardcoded values (script threshold is >10)
    # Need lots of hex colors and fontSize values to hit the threshold
    local temp_theme="${TEST_TEMP_DIR}/heavy-hardcode"
    mkdir -p "${temp_theme}/templates"
    cat > "${temp_theme}/templates/index.html" << 'TMPL'
<!-- wp:heading {"style":{"typography":{"fontSize":"48px"},"color":{"text":"#FF0000"}}} -->
<h1>Title</h1>
<!-- /wp:heading -->
<!-- wp:heading {"style":{"typography":{"fontSize":"36px"},"color":{"text":"#00FF00"}}} -->
<h2>Sub</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"style":{"typography":{"fontSize":"16px"},"color":{"text":"#0000FF"}}} -->
<p>Text</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"style":{"typography":{"fontSize":"14px"},"color":{"text":"#AABBCC"}}} -->
<p>More</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"style":{"typography":{"fontSize":"18px"},"color":{"text":"#DDEEFF"}}} -->
<p>Even more</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"style":{"typography":{"fontSize":"20px"},"color":{"text":"#112233"}}} -->
<p>Last</p>
<!-- /wp:paragraph -->
TMPL
    run bash "$SCRIPT" "$temp_theme"
    assert_success
    assert_output --partial "NEEDS WORK"
}

# --- Theme.json token coverage ---

@test "optimize-tokens: reports current theme.json token coverage" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme"
    assert_success
    assert_output --partial "Current theme.json Token Coverage"
    assert_output --partial "Colors: 8 tokens"
}

@test "optimize-tokens: warns about missing theme.json" {
    local temp_theme="${TEST_TEMP_DIR}/no-json-theme"
    mkdir -p "${temp_theme}/templates"
    cat > "${temp_theme}/templates/index.html" << 'EOF'
<!-- wp:paragraph -->
<p>Simple template</p>
<!-- /wp:paragraph -->
EOF
    run bash "$SCRIPT" "$temp_theme"
    assert_success
    assert_output --partial "theme.json Not Found"
}

# --- Summary section ---

@test "optimize-tokens: includes summary section" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme"
    assert_success
    assert_output --partial "Summary"
    assert_output --partial "Spacing:"
    assert_output --partial "Font sizes:"
    assert_output --partial "Colors:"
}
