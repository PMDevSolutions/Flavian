#!/usr/bin/env bats
load '../test_helper'

SCRIPT="${PROJECT_ROOT}/scripts/canva-fse/convert-html-to-blocks.sh"

@test "convert-html-to-blocks: converts h1 to wp:heading block" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<h1>Hello World</h1>' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:heading {"level":1}'
    assert_output --partial 'Hello World'
    assert_output --partial '<!-- /wp:heading -->'
}

@test "convert-html-to-blocks: converts h2 to wp:heading level 2" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<h2>Subtitle</h2>' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:heading {"level":2}'
    assert_output --partial '<!-- /wp:heading -->'
}

@test "convert-html-to-blocks: converts p to wp:paragraph block" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<p>Body text here.</p>' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:paragraph -->'
    assert_output --partial 'Body text here.'
    assert_output --partial '<!-- /wp:paragraph -->'
}

@test "convert-html-to-blocks: converts img to wp:image block" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<img src="hero.png" alt="Hero image" />' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:image'
    assert_output --partial 'hero.png'
    assert_output --partial '<!-- /wp:image -->'
}

@test "convert-html-to-blocks: wraps div sections in wp:group" {
    local html="${TEST_TEMP_DIR}/page.html"
    cat > "$html" << 'HTML'
<div>
  <h2>Section Title</h2>
  <p>Section content.</p>
</div>
HTML
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:group'
    assert_output --partial '<!-- /wp:group -->'
}

@test "convert-html-to-blocks: converts anchor with button class to wp:button" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<a href="https://example.com" class="button">Click Me</a>' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:button'
    assert_output --partial 'Click Me'
    assert_output --partial '<!-- /wp:button -->'
}

@test "convert-html-to-blocks: converts ul/ol lists to wp:list" {
    local html="${TEST_TEMP_DIR}/page.html"
    cat > "$html" << 'HTML'
<ul>
  <li>Item one</li>
  <li>Item two</li>
</ul>
HTML
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:list -->'
    assert_output --partial 'Item one'
    assert_output --partial '<!-- /wp:list -->'
}

@test "convert-html-to-blocks: fails gracefully with missing file" {
    run bash "$SCRIPT" "/nonexistent/page.html"
    assert_failure
    assert_output --partial "not found"
}

@test "convert-html-to-blocks: handles multiple elements" {
    local html="${TEST_TEMP_DIR}/page.html"
    cat > "$html" << 'HTML'
<h1>Title</h1>
<p>Introduction paragraph.</p>
<h2>Section</h2>
<p>More content.</p>
HTML
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:heading {"level":1}'
    assert_output --partial '<!-- wp:paragraph -->'
    assert_output --partial '<!-- wp:heading {"level":2}'
}
