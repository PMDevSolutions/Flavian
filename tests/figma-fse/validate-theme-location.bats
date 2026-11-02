#!/usr/bin/env bats
# Tests for scripts/figma-fse/validate-theme-location.sh, the figma-fse-converter
# agent's PreToolUse hook. It is a wrapper around the project-level hook at
# .claude/hooks/validate-theme-location.sh, so this file tests the contract both
# share: the event JSON arrives on stdin, a denial is a JSON permissionDecision
# on stdout, and the exit code is always 0.

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/validate-theme-location.sh"

setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
    mkdir -p "$TEST_TEMP_DIR/themes"
    export CLAUDE_PROJECT_DIR="$TEST_TEMP_DIR"
    cd "$TEST_TEMP_DIR" || exit 1
}

teardown() {
    cd / || true
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

hook() {
    printf '%s' "$1" | bash "$SCRIPT"
}

write_event() {
    printf '{"hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"%s","content":""}}' "$1"
}

# --- No input ---

@test "validate-theme-location: allows operation when stdin is empty" {
    run bash "$SCRIPT" </dev/null
    assert_success
    assert_output ""
}

@test "validate-theme-location: allows operation on malformed JSON" {
    run hook '{not json'
    assert_success
    assert_output ""
}

# --- Valid root-level paths ---

@test "validate-theme-location: allows themes/ path" {
    run hook "$(write_event themes/my-theme/style.css)"
    assert_success
    assert_output ""
}

@test "validate-theme-location: allows plugins/ path" {
    run hook "$(write_event plugins/my-plugin/plugin.php)"
    assert_success
    assert_output ""
}

@test "validate-theme-location: allows mu-plugins/ path" {
    run hook "$(write_event mu-plugins/custom.php)"
    assert_success
    assert_output ""
}

@test "validate-theme-location: allows unrelated paths" {
    run hook "$(write_event src/components/App.js)"
    assert_success
    assert_output ""
}

# --- Invalid wp-content paths ---

@test "validate-theme-location: denies wp-content/themes/ path" {
    run hook "$(write_event wp-content/themes/my-theme/style.css)"
    assert_success
    assert_output --partial '"permissionDecision":"deny"'
    assert_output --partial 'wp-content'
}

@test "validate-theme-location: denies wp-content/plugins/ path" {
    run hook "$(write_event wp-content/plugins/my-plugin/plugin.php)"
    assert_success
    assert_output --partial '"permissionDecision":"deny"'
}

@test "validate-theme-location: denies wp-content/mu-plugins/ path" {
    run hook "$(write_event wp-content/mu-plugins/custom.php)"
    assert_success
    assert_output --partial '"permissionDecision":"deny"'
}

# --- Path correction suggestions ---

@test "validate-theme-location: suggests corrected themes path" {
    run hook "$(write_event wp-content/themes/my-theme/style.css)"
    assert_success
    assert_output --partial 'Write to themes/my-theme/style.css instead'
}

@test "validate-theme-location: suggests corrected plugins path" {
    run hook "$(write_event wp-content/plugins/my-plugin/plugin.php)"
    assert_success
    assert_output --partial 'Write to plugins/my-plugin/plugin.php instead'
}

# --- Alternate JSON keys and tools ---

@test "validate-theme-location: handles 'path' key in JSON input" {
    run hook '{"tool_name":"Write","tool_input":{"path":"wp-content/themes/my-theme/index.html"}}'
    assert_success
    assert_output --partial '"permissionDecision":"deny"'
}

@test "validate-theme-location: handles NotebookEdit notebook_path" {
    run hook '{"tool_name":"NotebookEdit","tool_input":{"notebook_path":"wp-content/plugins/x/notes.ipynb"}}'
    assert_success
    assert_output --partial '"permissionDecision":"deny"'
}

@test "validate-theme-location: ignores tools that do not write files" {
    run hook '{"tool_name":"Bash","tool_input":{"command":"ls wp-content/themes/x"}}'
    assert_success
    assert_output ""
}

# --- No file path in input ---

@test "validate-theme-location: allows operation when no file path in JSON" {
    run hook '{"tool_name":"Write","tool_input":{"some_other_key":"value"}}'
    assert_success
    assert_output ""
}

# --- Scope: only the Flavian layout ---

@test "validate-theme-location: stays silent in a repo that tracks wp-content/" {
    git init -q
    mkdir -p wp-content/themes/site
    touch wp-content/themes/site/style.css
    git add -A
    git -c user.email=t@example.com -c user.name=t -c commit.gpgsign=false commit -q -m init
    run hook "$(write_event wp-content/themes/site/functions.php)"
    assert_success
    assert_output ""
}

@test "validate-theme-location: stays silent when the project has no themes/ directory" {
    rmdir themes
    run hook "$(write_event wp-content/themes/my-theme/style.css)"
    assert_success
    assert_output ""
}
