#!/usr/bin/env bats
# Tests for scripts/figma-fse/batch-convert-templates.sh
# Validates batch conversion process and tracks multi-template progress

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/batch-convert-templates.sh"

# Helper: run with CLI args
run_batch() {
    run bash -c "echo '' | bash '${SCRIPT}' '$1' '$2' '$3' 2>&1"
}

# --- Missing theme directory ---

@test "batch-convert: reports error for missing theme directory" {
    run bash -c "echo '' | bash '${SCRIPT}' '/nonexistent/theme' 2>&1"
    assert_success  # exits 0 even on error
    assert_output --partial "Theme directory not found"
}

@test "batch-convert: reports error when no directory specified" {
    run bash -c "echo '' | bash '${SCRIPT}' 2>&1"
    assert_success
    assert_output --partial "No theme directory specified"
}

# --- Valid theme directory ---

@test "batch-convert: validates templates in valid theme" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "2" "0"
    assert_success
    assert_output --partial "Batch Conversion Validation"
}

@test "batch-convert: counts actual template files" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "2" "0"
    assert_success
    assert_output --partial "Templates found:"
}

@test "batch-convert: shows progress statistics" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "4" "2"
    assert_success
    assert_output --partial "Progress Statistics"
    assert_output --partial "Total templates expected: 4"
    assert_output --partial "Templates completed: 2"
}

@test "batch-convert: shows progress percentage" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "4" "2"
    assert_success
    assert_output --partial "Progress: 50%"
}

# --- Checkpoint recommendations ---

@test "batch-convert: recommends checkpoint every 3 templates" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "6" "3"
    assert_success
    assert_output --partial "Checkpoint recommended"
}

@test "batch-convert: does not recommend checkpoint at non-interval" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "6" "2"
    assert_success
    refute_output --partial "Checkpoint recommended"
}

# --- Template validation ---

@test "batch-convert: marks valid templates as valid" {
    # Create a temp theme with only non-self-closing block templates
    local temp_theme="${TEST_TEMP_DIR}/valid-theme"
    mkdir -p "${temp_theme}/templates"
    cp "${FIXTURES_DIR}/themes/test-theme/theme.json" "$temp_theme/"
    cp "${FIXTURES_DIR}/themes/test-theme/templates/single.html" "${temp_theme}/templates/"
    run_batch "$temp_theme" "1" "0"
    assert_success
    assert_output --partial "single.html: Valid"
}

@test "batch-convert: detects hardcoded colors in invalid templates" {
    run_batch "${FIXTURES_DIR}/themes/test-theme-invalid" "3" "0"
    assert_success
    assert_output --partial "hardcoded colors found"
}

# --- Theme.json detection ---

@test "batch-convert: detects theme.json presence" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "2" "0"
    assert_success
    assert_output --partial "theme.json found"
}

@test "batch-convert: reports design token counts from theme.json" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "2" "0"
    assert_success
    assert_output --partial "Colors: 8"
}

# --- Completion status ---

@test "batch-convert: shows remaining templates count" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "5" "2"
    assert_success
    assert_output --partial "3 templates remaining"
}

@test "batch-convert: shows completion message when all done" {
    run_batch "${FIXTURES_DIR}/themes/test-theme" "2" "2"
    assert_success
    assert_output --partial "All templates complete"
}

# --- Summary ---

@test "batch-convert: shows batch conversion summary" {
    # Use a temp theme with only balanced-block templates
    local temp_theme="${TEST_TEMP_DIR}/valid-theme"
    mkdir -p "${temp_theme}/templates"
    cp "${FIXTURES_DIR}/themes/test-theme/theme.json" "$temp_theme/"
    cp "${FIXTURES_DIR}/themes/test-theme/templates/single.html" "${temp_theme}/templates/"
    run_batch "$temp_theme" "1" "0"
    assert_success
    assert_output --partial "Batch Conversion Summary"
    assert_output --partial "All templates valid"
}
