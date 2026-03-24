#!/usr/bin/env bats
# Tests for scripts/figma-fse/generate-comparison-report.sh
# Validates report generation for Figma-to-FSE conversion

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/generate-comparison-report.sh"

setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
    export ORIGINAL_DIR="$(pwd)"
}

teardown() {
    cd "$ORIGINAL_DIR"
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

# --- Report generation ---

@test "generate-comparison-report: creates report file" {
    cd "$TEST_TEMP_DIR"
    # Create themes directory structure so the script finds it
    mkdir -p themes/test-theme/templates
    cp "${FIXTURES_DIR}/themes/test-theme/theme.json" themes/test-theme/
    cp "${FIXTURES_DIR}/themes/test-theme/templates/index.html" themes/test-theme/templates/
    cp "${FIXTURES_DIR}/themes/test-theme/templates/front-page.html" themes/test-theme/templates/

    run bash "$SCRIPT" 2>&1
    assert_success
    assert [ -f ".claude/reports/figma-fse-comparison.md" ]
}

@test "generate-comparison-report: includes report title" {
    cd "$TEST_TEMP_DIR"
    mkdir -p themes/test-theme/templates
    cp "${FIXTURES_DIR}/themes/test-theme/theme.json" themes/test-theme/
    cp "${FIXTURES_DIR}/themes/test-theme/templates/index.html" themes/test-theme/templates/

    bash "$SCRIPT" 2>/dev/null
    run cat ".claude/reports/figma-fse-comparison.md"
    assert_output --partial "Figma-to-FSE Conversion Report"
}

@test "generate-comparison-report: includes timestamp" {
    cd "$TEST_TEMP_DIR"
    mkdir -p themes/test-theme/templates
    cp "${FIXTURES_DIR}/themes/test-theme/theme.json" themes/test-theme/
    cp "${FIXTURES_DIR}/themes/test-theme/templates/index.html" themes/test-theme/templates/

    bash "$SCRIPT" 2>/dev/null
    run cat ".claude/reports/figma-fse-comparison.md"
    assert_output --partial "Generated:"
    assert_output --regexp '[0-9]{4}-[0-9]{2}-[0-9]{2}'
}

# --- Token counts in report ---

@test "generate-comparison-report: reports design token counts" {
    cd "$TEST_TEMP_DIR"
    mkdir -p themes/test-theme/templates
    cp "${FIXTURES_DIR}/themes/test-theme/theme.json" themes/test-theme/
    cp "${FIXTURES_DIR}/themes/test-theme/templates/index.html" themes/test-theme/templates/

    bash "$SCRIPT" 2>/dev/null
    run cat ".claude/reports/figma-fse-comparison.md"
    assert_output --partial "Colors: 8"
}

# --- Template counting ---

@test "generate-comparison-report: counts templates" {
    cd "$TEST_TEMP_DIR"
    mkdir -p themes/test-theme/templates
    cp "${FIXTURES_DIR}/themes/test-theme/theme.json" themes/test-theme/
    cp "${FIXTURES_DIR}/themes/test-theme/templates/index.html" themes/test-theme/templates/
    cp "${FIXTURES_DIR}/themes/test-theme/templates/front-page.html" themes/test-theme/templates/

    bash "$SCRIPT" 2>/dev/null
    run cat ".claude/reports/figma-fse-comparison.md"
    assert_output --partial "Total Templates"
    assert_output --partial "Template List"
}

# --- Quality checks ---

@test "generate-comparison-report: reports zero hardcoded values for clean theme" {
    cd "$TEST_TEMP_DIR"
    mkdir -p themes/test-theme/templates
    cp "${FIXTURES_DIR}/themes/test-theme/theme.json" themes/test-theme/
    cp "${FIXTURES_DIR}/themes/test-theme/templates/index.html" themes/test-theme/templates/

    bash "$SCRIPT" 2>/dev/null
    run cat ".claude/reports/figma-fse-comparison.md"
    assert_output --partial "Zero hardcoded values"
}

@test "generate-comparison-report: detects hardcoded values in invalid theme" {
    cd "$TEST_TEMP_DIR"
    mkdir -p themes/test-theme-invalid/templates
    cp "${FIXTURES_DIR}/themes/test-theme-invalid/theme.json" themes/test-theme-invalid/
    cp "${FIXTURES_DIR}/themes/test-theme-invalid/templates/index.html" themes/test-theme-invalid/templates/

    bash "$SCRIPT" 2>/dev/null
    run cat ".claude/reports/figma-fse-comparison.md"
    assert_output --partial "Some templates contain hardcoded values"
}

# --- No themes ---

@test "generate-comparison-report: handles no themes gracefully" {
    cd "$TEST_TEMP_DIR"
    run bash "$SCRIPT" 2>&1
    assert_success
    assert [ -f ".claude/reports/figma-fse-comparison.md" ]
}

# --- Always exits 0 ---

@test "generate-comparison-report: always exits 0" {
    cd "$TEST_TEMP_DIR"
    run bash "$SCRIPT" 2>&1
    assert_success
}
