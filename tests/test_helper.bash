#!/usr/bin/env bash
# Common test helper for BATS tests
# Sources bats-support and bats-assert, sets up fixtures path

# Resolve project root from the test file location
TESTS_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
PROJECT_ROOT="$(cd "$TESTS_DIR/.." && pwd)"

# Load BATS helpers using absolute paths
load "${TESTS_DIR}/libs/bats-support/load"
load "${TESTS_DIR}/libs/bats-assert/load"

# Scripts under test
SCRIPTS_DIR="${PROJECT_ROOT}/scripts/figma-fse"

# Fixtures directory
FIXTURES_DIR="${PROJECT_ROOT}/tests/fixtures"

# Create a temporary directory for each test (auto-cleaned by BATS)
setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}
