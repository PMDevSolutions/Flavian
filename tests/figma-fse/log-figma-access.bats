#!/usr/bin/env bats
# Tests for scripts/figma-fse/log-figma-access.sh
# Validates Figma MCP access logging

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/log-figma-access.sh"

setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
    # Override log directory by running from temp dir
    export ORIGINAL_DIR="$(pwd)"
}

teardown() {
    cd "$ORIGINAL_DIR"
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

# --- Logging with valid tool input ---

@test "log-figma-access: creates log file" {
    cd "$TEST_TEMP_DIR"
    echo '{"tool":"get_design_context","tool_input":{"nodeId":"123:456","fileKey":"abc123"}}' | bash "$SCRIPT" 2>/dev/null
    assert [ -f ".claude/logs/figma-access.log" ]
}

@test "log-figma-access: logs tool name" {
    cd "$TEST_TEMP_DIR"
    echo '{"tool":"get_design_context","tool_input":{"nodeId":"123:456","fileKey":"abc123"}}' | bash "$SCRIPT" 2>/dev/null
    run cat ".claude/logs/figma-access.log"
    assert_output --partial "Tool: get_design_context"
}

@test "log-figma-access: logs node ID" {
    cd "$TEST_TEMP_DIR"
    echo '{"tool":"get_design_context","tool_input":{"nodeId":"123:456","fileKey":"abc123"}}' | bash "$SCRIPT" 2>/dev/null
    run cat ".claude/logs/figma-access.log"
    assert_output --partial "Node: 123:456"
}

@test "log-figma-access: logs file key" {
    cd "$TEST_TEMP_DIR"
    echo '{"tool":"get_design_context","tool_input":{"nodeId":"123:456","fileKey":"abc123"}}' | bash "$SCRIPT" 2>/dev/null
    run cat ".claude/logs/figma-access.log"
    assert_output --partial "File: abc123"
}

@test "log-figma-access: includes timestamp" {
    cd "$TEST_TEMP_DIR"
    echo '{"tool":"get_screenshot","tool_input":{"nodeId":"1:2","fileKey":"xyz"}}' | bash "$SCRIPT" 2>/dev/null
    run cat ".claude/logs/figma-access.log"
    # Timestamp format: [YYYY-MM-DD HH:MM:SS]
    assert_output --regexp '\[[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\]'
}

# --- Handles missing fields ---

@test "log-figma-access: handles missing tool name" {
    cd "$TEST_TEMP_DIR"
    echo '{"tool_input":{"nodeId":"1:2"}}' | bash "$SCRIPT" 2>/dev/null
    run cat ".claude/logs/figma-access.log"
    assert_output --partial "Tool: unknown"
}

@test "log-figma-access: handles missing node ID" {
    cd "$TEST_TEMP_DIR"
    echo '{"tool":"get_metadata","tool_input":{"fileKey":"abc"}}' | bash "$SCRIPT" 2>/dev/null
    run cat ".claude/logs/figma-access.log"
    assert_output --partial "Node: none"
}

# --- Always exits 0 ---

@test "log-figma-access: always exits 0" {
    cd "$TEST_TEMP_DIR"
    run bash -c "echo '{}' | bash '${SCRIPT}' 2>&1"
    assert_success
}

# --- Multiple entries ---

@test "log-figma-access: appends multiple log entries" {
    cd "$TEST_TEMP_DIR"
    echo '{"tool":"get_design_context","tool_input":{"nodeId":"1:1","fileKey":"aaa"}}' | bash "$SCRIPT" 2>/dev/null
    echo '{"tool":"get_screenshot","tool_input":{"nodeId":"2:2","fileKey":"bbb"}}' | bash "$SCRIPT" 2>/dev/null
    run wc -l < ".claude/logs/figma-access.log"
    # Should have 2 lines
    [[ "$(cat .claude/logs/figma-access.log | wc -l)" -eq 2 ]]
}
