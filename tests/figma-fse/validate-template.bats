#!/usr/bin/env bats
# Tests for scripts/figma-fse/validate-template.sh
# Validates FSE template files for correct block syntax and token usage

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/validate-template.sh"

# Helper: run the script with a simulated hook JSON input
run_validate() {
    local file_path="$1"
    run bash -c "echo '{\"tool_input\":{\"file_path\":\"${file_path}\"}}' | bash '${SCRIPT}' 2>&1"
}

# --- Skipping non-HTML files ---

@test "validate-template: skips non-HTML files" {
    run bash -c "echo '{\"tool_input\":{\"file_path\":\"theme.json\"}}' | bash '${SCRIPT}' 2>&1"
    assert_success
    refute_output --partial "Validating"
}

@test "validate-template: skips when file does not exist" {
    run bash -c "echo '{\"tool_input\":{\"file_path\":\"/nonexistent/index.html\"}}' | bash '${SCRIPT}' 2>&1"
    assert_success
    refute_output --partial "Validating"
}

# --- Valid template ---

@test "validate-template: passes valid template" {
    # Use page.html which has simple JSON attributes and balanced blocks
    run_validate "${FIXTURES_DIR}/themes/test-theme/templates/page.html"
    assert_success
    assert_output --partial "Template validation passed"
}

@test "validate-template: reports block count for valid template" {
    run_validate "${FIXTURES_DIR}/themes/test-theme/templates/index.html"
    assert_success
    assert_output --partial "Template Statistics"
    assert_output --partial "Blocks used:"
}

@test "validate-template: does not flag valid template for hardcoded colors" {
    run_validate "${FIXTURES_DIR}/themes/test-theme/templates/index.html"
    assert_success
    refute_output --partial "Found hardcoded hex colors"
}

# --- Invalid template: hardcoded hex colors ---

@test "validate-template: detects hardcoded hex colors" {
    run_validate "${FIXTURES_DIR}/themes/test-theme-invalid/templates/index.html"
    assert_success
    assert_output --partial "Found hardcoded hex colors in template"
    assert_output --partial "#0066CC"
}

# --- Invalid template: hardcoded pixel sizes ---

@test "validate-template: detects hardcoded pixel sizes" {
    run_validate "${FIXTURES_DIR}/themes/test-theme-invalid/templates/index.html"
    assert_success
    assert_output --partial "Found hardcoded pixel sizes"
}

# --- Invalid template: no block comments ---

@test "validate-template: warns about missing block comments" {
    run_validate "${FIXTURES_DIR}/themes/test-theme-invalid/templates/no-blocks.html"
    assert_success
    assert_output --partial "No WordPress block comments found"
}

# --- Invalid template: mismatched blocks ---

@test "validate-template: detects mismatched block tags" {
    run_validate "${FIXTURES_DIR}/themes/test-theme-invalid/templates/index.html"
    assert_success
    assert_output --partial "Mismatched block tags"
}

# --- Reports common blocks ---

@test "validate-template: reports common block usage" {
    run_validate "${FIXTURES_DIR}/themes/test-theme/templates/front-page.html"
    assert_success
    assert_output --partial "wp:heading"
    assert_output --partial "wp:paragraph"
}

# --- Always exits 0 ---

@test "validate-template: always exits 0 even with issues" {
    run_validate "${FIXTURES_DIR}/themes/test-theme-invalid/templates/index.html"
    assert_success
}
