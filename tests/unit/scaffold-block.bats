#!/usr/bin/env bats
# Structural tests for scripts/scaffold-block.sh — the Gutenberg custom block
# scaffolder (v2.0.0 milestone). These exercise the generator's output without
# Docker or a WordPress install; the full activate/render path lives in
# scripts/smoke-block.sh.

load '../test_helper'

SCRIPT="${PROJECT_ROOT}/scripts/scaffold-block.sh"

# Scaffold into the per-test temp dir. Usage: scaffold <name> [extra args...]
scaffold() {
    local name="$1"; shift
    bash "$SCRIPT" "$name" --dest "$TEST_TEMP_DIR" "$@"
}

# --- Generator sanity ---

@test "scaffold-block.sh exists and is executable-ish (parses)" {
    [ -f "$SCRIPT" ]
    run bash -n "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "no positional block name → usage error (exit 2)" {
    run bash "$SCRIPT"
    [ "$status" -eq 2 ]
}

@test "invalid block name is rejected" {
    run scaffold "Bad_Name"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Invalid block name"* ]]
}

@test "invalid attribute type is rejected" {
    run scaffold "thing" --attributes "x:notatype"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Invalid attribute type"* ]]
}

@test "--dry-run writes nothing" {
    run scaffold "ghost" --attributes "a:string" --dry-run
    [ "$status" -eq 0 ]
    [ ! -d "${TEST_TEMP_DIR}/ghost" ]
    [[ "$output" == *"Dry run"* ]]
}

# --- Dynamic block ---

@test "dynamic: generates the full file set including render.php" {
    run scaffold "pricing-table" --namespace acme \
        --attributes "heading:string:Plans,count:number:3,featured:boolean" --dynamic
    [ "$status" -eq 0 ]
    local b="${TEST_TEMP_DIR}/pricing-table"
    [ -f "${b}/pricing-table.php" ]
    [ -f "${b}/blocks/pricing-table/block.json" ]
    [ -f "${b}/blocks/pricing-table/index.js" ]
    [ -f "${b}/blocks/pricing-table/index.asset.php" ]
    [ -f "${b}/blocks/pricing-table/editor.css" ]
    [ -f "${b}/blocks/pricing-table/style.css" ]
    [ -f "${b}/blocks/pricing-table/render.php" ]
    [ -f "${b}/tests/PricingTableTest.php" ]
    [ -f "${b}/tests/bootstrap.php" ]
    [ -f "${b}/phpunit.xml.dist" ]
    [ -f "${b}/README.md" ]
}

@test "dynamic: block.json is valid JSON with namespaced name and attributes" {
    scaffold "pricing-table" --namespace acme \
        --attributes "heading:string:Plans,count:number:3,featured:boolean" --dynamic
    local json="${TEST_TEMP_DIR}/pricing-table/blocks/pricing-table/block.json"
    run node -e "
        const d = JSON.parse(require('fs').readFileSync('${json}','utf8'));
        if (d.name !== 'acme/pricing-table') { console.error('bad name', d.name); process.exit(1); }
        for (const k of ['heading','count','featured']) {
            if (!d.attributes || !(k in d.attributes)) { console.error('missing attr', k); process.exit(1); }
        }
        if (d.render !== 'file:./render.php') { console.error('missing render field'); process.exit(1); }
        if (d.attributes.count.type !== 'number') { console.error('bad type'); process.exit(1); }
        if (d.attributes.heading.default !== 'Plans') { console.error('bad default'); process.exit(1); }
        console.log('ok');
    "
    [ "$status" -eq 0 ]
    [[ "$output" == *"ok"* ]]
}

@test "dynamic: index.js parses and save() returns null" {
    scaffold "pricing-table" --namespace acme --attributes "heading:string" --dynamic
    local js="${TEST_TEMP_DIR}/pricing-table/blocks/pricing-table/index.js"
    run node --check "$js"
    [ "$status" -eq 0 ]
    grep -q "registerBlockType( 'acme/pricing-table'" "$js"
    grep -Eq "save:[[:space:]]*function[[:space:]]*\(\)" "$js"
}

@test "dynamic: render.php references attributes and plugin registers the block dir" {
    scaffold "pricing-table" --namespace acme --attributes "heading:string" --dynamic
    local b="${TEST_TEMP_DIR}/pricing-table"
    grep -q "get_block_wrapper_attributes" "${b}/blocks/pricing-table/render.php"
    grep -q "\$attributes\['heading'\]" "${b}/blocks/pricing-table/render.php"
    grep -q "register_block_type( __DIR__ . '/blocks/pricing-table' )" "${b}/pricing-table.php"
}

@test "dynamic: PHPUnit stub declares a render test" {
    scaffold "pricing-table" --namespace acme --attributes "heading:string" --dynamic
    grep -q "function test_render_emits_wrapper_markup" \
        "${TEST_TEMP_DIR}/pricing-table/tests/PricingTableTest.php"
}

# --- Static block ---

@test "static: omits render.php and serializes attributes in save()" {
    run scaffold "callout" --namespace flavian --attributes "message:string:Hi,dismissible:boolean"
    [ "$status" -eq 0 ]
    local b="${TEST_TEMP_DIR}/callout"
    [ ! -f "${b}/blocks/callout/render.php" ]
    # block.json must not declare a render field
    run node -e "
        const d = JSON.parse(require('fs').readFileSync('${b}/blocks/callout/block.json','utf8'));
        process.exit(d.render === undefined ? 0 : 1);
    "
    [ "$status" -eq 0 ]
    # save() must emit markup, not null
    grep -q "useBlockProps.save()" "${b}/blocks/callout/index.js"
    grep -q "wp-block-flavian-callout__message" "${b}/blocks/callout/index.js"
}

@test "no attributes: still valid, empty attributes object" {
    run scaffold "plain"
    [ "$status" -eq 0 ]
    run node -e "
        const d = JSON.parse(require('fs').readFileSync('${TEST_TEMP_DIR}/plain/blocks/plain/block.json','utf8'));
        process.exit(typeof d.attributes === 'object' ? 0 : 1);
    "
    [ "$status" -eq 0 ]
}

@test "--force overwrites an existing block, without it errors" {
    scaffold "dup" --attributes "a:string"
    run scaffold "dup" --attributes "a:string"
    [ "$status" -eq 1 ]
    [[ "$output" == *"already exists"* ]]
    run scaffold "dup" --attributes "a:string" --force
    [ "$status" -eq 0 ]
}
