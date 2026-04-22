#!/usr/bin/env bats
# Tests for the rgb_to_hex() helper in scripts/canva-fse/parse-canva-export.sh
# Unit tests — no Docker, no fixtures, no filesystem.

load '../test_helper'

SCRIPT="${PROJECT_ROOT}/scripts/canva-fse/parse-canva-export.sh"

# The source script has a top-level `case` that exits 1 on no args, so plain
# `source` is not safe here. Extract just rgb_to_hex and eval it.
eval "$(sed -n '/^rgb_to_hex() {/,/^}/p' "$SCRIPT")"

@test "rgb_to_hex: pure red" {
    result=$(rgb_to_hex "rgb(255, 0, 0)")
    [ "$result" = "#ff0000" ]
}

@test "rgb_to_hex: pure green" {
    result=$(rgb_to_hex "rgb(0, 255, 0)")
    [ "$result" = "#00ff00" ]
}

@test "rgb_to_hex: pure blue" {
    result=$(rgb_to_hex "rgb(0, 0, 255)")
    [ "$result" = "#0000ff" ]
}

@test "rgb_to_hex: black with no spaces" {
    result=$(rgb_to_hex "rgb(0,0,0)")
    [ "$result" = "#000000" ]
}

@test "rgb_to_hex: white" {
    result=$(rgb_to_hex "rgb(255, 255, 255)")
    [ "$result" = "#ffffff" ]
}

@test "rgb_to_hex: mid-gray" {
    result=$(rgb_to_hex "rgb(128, 128, 128)")
    [ "$result" = "#808080" ]
}
