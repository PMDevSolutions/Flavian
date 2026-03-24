#!/usr/bin/env bats
# Tests for scripts/figma-fse/validate-theme-location.sh
# Validates theme files are created in themes/ NOT wp-content/themes/

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/validate-theme-location.sh"

# --- No input ---

@test "validate-theme-location: allows operation when no tool input" {
    CLAUDE_TOOL_INPUT="" run bash "$SCRIPT"
    assert_success
}

# --- Valid root-level paths ---

@test "validate-theme-location: allows themes/ path" {
    CLAUDE_TOOL_INPUT='{"file_path":"themes/my-theme/style.css"}' run bash "$SCRIPT"
    assert_success
}

@test "validate-theme-location: allows plugins/ path" {
    CLAUDE_TOOL_INPUT='{"file_path":"plugins/my-plugin/plugin.php"}' run bash "$SCRIPT"
    assert_success
}

@test "validate-theme-location: allows mu-plugins/ path" {
    CLAUDE_TOOL_INPUT='{"file_path":"mu-plugins/custom.php"}' run bash "$SCRIPT"
    assert_success
}

@test "validate-theme-location: allows unrelated paths" {
    CLAUDE_TOOL_INPUT='{"file_path":"src/components/App.js"}' run bash "$SCRIPT"
    assert_success
}

# --- Invalid wp-content paths ---

@test "validate-theme-location: blocks wp-content/themes/ path" {
    CLAUDE_TOOL_INPUT='{"file_path":"wp-content/themes/my-theme/style.css"}' run bash "$SCRIPT"
    assert_failure
    assert_output --partial "Invalid file location detected"
}

@test "validate-theme-location: blocks wp-content/plugins/ path" {
    CLAUDE_TOOL_INPUT='{"file_path":"wp-content/plugins/my-plugin/plugin.php"}' run bash "$SCRIPT"
    assert_failure
    assert_output --partial "Invalid file location detected"
}

@test "validate-theme-location: blocks wp-content/mu-plugins/ path" {
    CLAUDE_TOOL_INPUT='{"file_path":"wp-content/mu-plugins/custom.php"}' run bash "$SCRIPT"
    assert_failure
    assert_output --partial "Invalid file location detected"
}

# --- Path correction suggestions ---

@test "validate-theme-location: suggests corrected themes path" {
    CLAUDE_TOOL_INPUT='{"file_path":"wp-content/themes/my-theme/style.css"}' run bash "$SCRIPT"
    assert_failure
    assert_output --partial "themes/my-theme/style.css"
}

@test "validate-theme-location: suggests corrected plugins path" {
    CLAUDE_TOOL_INPUT='{"file_path":"wp-content/plugins/my-plugin/plugin.php"}' run bash "$SCRIPT"
    assert_failure
    assert_output --partial "plugins/my-plugin/plugin.php"
}

# --- Alternate JSON keys ---

@test "validate-theme-location: handles 'path' key in JSON input" {
    CLAUDE_TOOL_INPUT='{"path":"wp-content/themes/my-theme/index.html"}' run bash "$SCRIPT"
    assert_failure
    assert_output --partial "Invalid file location detected"
}

# --- No file path in input ---

@test "validate-theme-location: allows operation when no file path in JSON" {
    CLAUDE_TOOL_INPUT='{"some_other_key":"value"}' run bash "$SCRIPT"
    assert_success
}
