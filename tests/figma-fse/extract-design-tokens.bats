#!/usr/bin/env bats
# Tests for scripts/figma-fse/extract-design-tokens.sh
# Validates Figma design token extraction and theme.json analysis

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/extract-design-tokens.sh"

# Helper: run the script with a simulated hook JSON input
# The script reads stdin and writes to stderr, so redirect stderr to stdout
run_extract() {
    local file_path="$1"
    run bash -c "echo '{\"tool_input\":{\"file_path\":\"${file_path}\"}}' | bash '${SCRIPT}' 2>&1"
}

# --- Skipping non-theme.json files ---

@test "extract-design-tokens: skips non-theme.json files" {
    run bash -c "echo '{\"tool_input\":{\"file_path\":\"some/file.html\"}}' | bash '${SCRIPT}' 2>&1"
    assert_success
    refute_output --partial "Validating"
}

@test "extract-design-tokens: skips when file does not exist" {
    run bash -c "echo '{\"tool_input\":{\"file_path\":\"/nonexistent/theme.json\"}}' | bash '${SCRIPT}' 2>&1"
    assert_success
    refute_output --partial "Design Token Summary"
}

# --- Valid comprehensive theme.json ---

@test "extract-design-tokens: reports token counts for comprehensive theme" {
    run_extract "${FIXTURES_DIR}/themes/test-theme/theme.json"
    assert_success
    assert_output --partial "Colors: 8"
    assert_output --partial "Font Sizes: 6"
    assert_output --partial "Spacing Tokens: 7"
}

@test "extract-design-tokens: passes comprehensive design system check" {
    run_extract "${FIXTURES_DIR}/themes/test-theme/theme.json"
    assert_success
    assert_output --partial "Comprehensive design system detected"
}

@test "extract-design-tokens: detects schema version 2" {
    run_extract "${FIXTURES_DIR}/themes/test-theme/theme.json"
    assert_success
    refute_output --partial "Consider upgrading to version 2"
}

# --- Minimal theme.json with warnings ---

@test "extract-design-tokens: warns about insufficient colors" {
    run_extract "${FIXTURES_DIR}/minimal-theme.json"
    assert_success
    assert_output --partial "Only 3 colors defined"
}

@test "extract-design-tokens: warns about insufficient font sizes" {
    run_extract "${FIXTURES_DIR}/minimal-theme.json"
    assert_success
    assert_output --partial "Only 2 font sizes defined"
}

@test "extract-design-tokens: warns about insufficient spacing tokens" {
    run_extract "${FIXTURES_DIR}/minimal-theme.json"
    assert_success
    assert_output --partial "Only 2 spacing tokens defined"
}

# --- Invalid theme.json ---

@test "extract-design-tokens: handles invalid JSON gracefully" {
    run_extract "${FIXTURES_DIR}/invalid-theme.json"
    assert_success
    assert_output --partial "Invalid JSON syntax"
}

# --- Missing sections ---

@test "extract-design-tokens: warns about missing spacing section" {
    run_extract "${FIXTURES_DIR}/themes/test-theme-invalid/theme.json"
    assert_success
    assert_output --partial "Missing design system sections"
    assert_output --partial "settings.spacing"
}

# --- Hardcoded colors in styles ---

@test "extract-design-tokens: detects hardcoded hex colors in styles section" {
    run_extract "${FIXTURES_DIR}/themes/test-theme-invalid/theme.json"
    assert_success
    assert_output --partial "Found hardcoded hex colors in styles section"
}

# --- Schema version warning ---

@test "extract-design-tokens: warns about outdated schema version" {
    run_extract "${FIXTURES_DIR}/themes/test-theme-invalid/theme.json"
    assert_success
    assert_output --partial "Using theme.json schema version 1"
    assert_output --partial "Consider upgrading to version 2"
}

# --- Always exits 0 ---

@test "extract-design-tokens: always exits 0 even with issues" {
    run_extract "${FIXTURES_DIR}/invalid-theme.json"
    assert_success
}
