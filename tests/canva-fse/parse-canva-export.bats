#!/usr/bin/env bats
load '../test_helper'

SCRIPT="${PROJECT_ROOT}/scripts/canva-fse/parse-canva-export.sh"

@test "parse-canva-export: extracts hex colors from CSS" {
    local css_file="${TEST_TEMP_DIR}/style.css"
    cat > "$css_file" << 'CSS'
.header { background-color: #1a3f6f; color: #ffffff; }
.accent { color: #e8491d; }
.footer { background: #1d1d1f; color: #fafafa; }
CSS
    run bash "$SCRIPT" --colors "$css_file"
    assert_success
    assert_output --partial '"slug": "color-1"'
    assert_output --partial '"color": "#1a3f6f"'
}

@test "parse-canva-export: extracts font families from CSS" {
    local css_file="${TEST_TEMP_DIR}/style.css"
    cat > "$css_file" << 'CSS'
.heading { font-family: "Playfair Display", serif; }
.body { font-family: "Inter", sans-serif; }
CSS
    run bash "$SCRIPT" --fonts "$css_file"
    assert_success
    assert_output --partial '"fontFamily"'
    assert_output --partial 'Playfair Display'
    assert_output --partial 'Inter'
}

@test "parse-canva-export: extracts font sizes from CSS" {
    local css_file="${TEST_TEMP_DIR}/style.css"
    cat > "$css_file" << 'CSS'
h1 { font-size: 48px; }
h2 { font-size: 32px; }
p { font-size: 16px; }
.small { font-size: 14px; }
CSS
    run bash "$SCRIPT" --font-sizes "$css_file"
    assert_success
    assert_output --partial '"size": "48px"'
    assert_output --partial '"size": "16px"'
}

@test "parse-canva-export: extracts spacing values from CSS" {
    local css_file="${TEST_TEMP_DIR}/style.css"
    cat > "$css_file" << 'CSS'
.section { padding: 64px 32px; margin-bottom: 48px; }
.card { padding: 24px; gap: 16px; }
CSS
    run bash "$SCRIPT" --spacing "$css_file"
    assert_success
    assert_output --partial '"size":'
}

@test "parse-canva-export: generates complete theme.json fragment" {
    local css_file="${TEST_TEMP_DIR}/style.css"
    cat > "$css_file" << 'CSS'
.header { background-color: #1a3f6f; color: #ffffff; font-family: "Inter", sans-serif; }
h1 { font-size: 48px; }
.section { padding: 32px; }
CSS
    run bash "$SCRIPT" --theme-json "$css_file"
    assert_success
    assert_output --partial '"settings"'
    assert_output --partial '"color"'
    assert_output --partial '"typography"'
}

@test "parse-canva-export: deduplicates repeated values" {
    local css_file="${TEST_TEMP_DIR}/style.css"
    cat > "$css_file" << 'CSS'
.a { color: #1a3f6f; }
.b { color: #1a3f6f; }
.c { background: #1a3f6f; }
CSS
    run bash "$SCRIPT" --colors "$css_file"
    assert_success
    local count
    count=$(echo "$output" | grep -c '#1a3f6f')
    [ "$count" -eq 1 ]
}

@test "parse-canva-export: handles rgb() colors" {
    local css_file="${TEST_TEMP_DIR}/style.css"
    cat > "$css_file" << 'CSS'
.header { background-color: rgb(26, 63, 111); }
CSS
    run bash "$SCRIPT" --colors "$css_file"
    assert_success
    assert_output --partial '"color":'
}

@test "parse-canva-export: fails gracefully with missing file" {
    run bash "$SCRIPT" --colors "/nonexistent/style.css"
    assert_failure
    assert_output --partial "not found"
}
