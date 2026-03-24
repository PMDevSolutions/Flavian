#!/usr/bin/env bats
# Tests for scripts/figma-fse/validate-pattern-architecture.sh
# Ensures templates use patterns for images, not inline PHP or empty src

load '../test_helper'

SCRIPT="${SCRIPTS_DIR}/validate-pattern-architecture.sh"

# --- Skipping non-template files ---

@test "validate-pattern-architecture: skips non-template files" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme/theme.json"
    assert_success
}

@test "validate-pattern-architecture: skips pattern PHP files" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme/patterns/hero.php"
    assert_success
}

# --- Valid templates ---

@test "validate-pattern-architecture: passes valid template without images" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme/templates/index.html"
    assert_success
    assert_output --partial "Pattern architecture validation passed"
}

# --- PHP in HTML template ---

@test "validate-pattern-architecture: rejects PHP code in HTML template" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme-invalid/templates/with-php.html"
    assert_failure
    assert_output --partial "PHP code found in HTML template"
}

@test "validate-pattern-architecture: shows line numbers for PHP violations" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme-invalid/templates/with-php.html"
    assert_failure
    assert_output --partial "<?php"
}

# --- Empty image src ---

@test "validate-pattern-architecture: rejects empty image src attributes" {
    # Create a template with empty src but no PHP (since PHP check runs first and exits)
    local temp_template="${TEST_TEMP_DIR}/templates/test.html"
    mkdir -p "${TEST_TEMP_DIR}/templates"
    cat > "$temp_template" << 'EOF'
<!-- wp:group {"tagName":"main"} -->
<main class="wp-block-group">
	<!-- wp:image -->
	<figure class="wp-block-image">
		<img src="" alt="Empty" />
	</figure>
	<!-- /wp:image -->
</main>
<!-- /wp:group -->
EOF
    run bash "$SCRIPT" "$temp_template"
    assert_failure
    assert_output --partial "Empty image src attributes found"
}

# --- Pattern references validated ---

@test "validate-pattern-architecture: validates referenced patterns exist" {
    run bash "$SCRIPT" "${FIXTURES_DIR}/themes/test-theme/templates/front-page.html"
    assert_success
    assert_output --partial "All referenced patterns exist"
}

@test "validate-pattern-architecture: fails when referenced pattern is missing" {
    local temp_template="${TEST_TEMP_DIR}/templates/test.html"
    mkdir -p "${TEST_TEMP_DIR}/templates"
    cat > "$temp_template" << 'EOF'
<!-- wp:template-part {"slug":"header","area":"header"} /-->
<!-- wp:pattern {"slug":"mytheme/nonexistent"} /-->
<!-- wp:template-part {"slug":"footer","area":"footer"} /-->
EOF
    run bash "$SCRIPT" "$temp_template"
    assert_failure
    assert_output --partial "Referenced pattern not found"
}

# --- Inline image warning (non-blocking) ---

@test "validate-pattern-architecture: warns about inline images with empty alt/style" {
    local temp_template="${TEST_TEMP_DIR}/templates/test.html"
    mkdir -p "${TEST_TEMP_DIR}/templates"
    cat > "$temp_template" << 'EOF'
<!-- wp:group {"tagName":"main"} -->
<main class="wp-block-group">
	<img alt="" style="width:100%" />
</main>
<!-- /wp:group -->
EOF
    run bash "$SCRIPT" "$temp_template"
    assert_success
    assert_output --partial "WARNING"
    assert_output --partial "inline images"
}
