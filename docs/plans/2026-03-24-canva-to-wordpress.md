# Canva-to-WordPress Conversion Support — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable conversion of Canva HTML/CSS exports into WordPress FSE block themes, reusing the existing Figma pipeline's validation infrastructure.

**Architecture:** Canva exports static HTML/CSS (no API/MCP). A new `scripts/canva-fse/` directory contains a parser script (`parse-canva-export.sh`) that extracts design tokens (colors, fonts, spacing) from exported CSS and maps HTML elements to WordPress blocks. All downstream validation scripts (`validate-template.sh`, `validate-pattern-architecture.sh`, etc.) are shared with the Figma pipeline via symlinks. A new agent (`canva-fse-converter`) orchestrates the workflow using Claude's vision capabilities to interpret Canva screenshots when HTML structure is ambiguous.

**Tech Stack:** Bash scripts, BATS tests, WordPress FSE blocks, CSS parsing with grep/sed/awk

---

## Context: How Canva Differs from Figma

| Aspect | Figma Pipeline | Canva Pipeline |
|--------|---------------|----------------|
| **Input** | Live MCP connection to Figma | Static HTML/CSS export files |
| **Design tokens** | `get_variable_defs` API | Parse CSS for colors, fonts, sizes |
| **Layout** | `get_design_context` structured data | HTML structure + CSS analysis |
| **Images** | `get_screenshot` for reference | User-exported images in assets/ |
| **Validation** | Same scripts | Same scripts (shared) |

**Key insight:** The Canva pipeline's input is *already* HTML/CSS, so conversion is simpler in some ways — we parse existing markup rather than generating from scratch. The challenge is that Canva's export HTML is div-soup with inline styles, not semantic markup.

---

## Task 1: Create Canva CSS Design Token Parser

**Files:**
- Create: `scripts/canva-fse/parse-canva-export.sh`

**Step 1: Write the failing test**

Create `tests/canva-fse/parse-canva-export.bats`:

```bash
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
    # Should only appear once despite 3 usages
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
```

**Step 2: Run test to verify it fails**

```bash
./tests/libs/bats-core/bin/bats tests/canva-fse/parse-canva-export.bats
```

Expected: FAIL — script doesn't exist yet.

**Step 3: Write minimal implementation**

Create `scripts/canva-fse/parse-canva-export.sh`:

```bash
#!/bin/bash
# Canva Export CSS Parser
# Extracts design tokens (colors, fonts, spacing) from Canva HTML/CSS exports
# Outputs theme.json-compatible JSON fragments

set -e

MODE="${1:---help}"
CSS_FILE="${2:-}"

if [[ "$MODE" == "--help" ]] || [[ -z "$CSS_FILE" ]]; then
    echo "Usage: parse-canva-export.sh [--colors|--fonts|--font-sizes|--spacing|--theme-json] <css-file>"
    echo ""
    echo "Extracts design tokens from Canva CSS exports for WordPress theme.json"
    exit 0
fi

if [[ ! -f "$CSS_FILE" ]]; then
    echo "Error: CSS file not found: $CSS_FILE" >&2
    exit 1
fi

CSS_CONTENT=$(cat "$CSS_FILE")

# --- Extract unique hex colors ---
extract_colors() {
    local colors
    # Extract hex colors
    colors=$(grep -oE '#[0-9A-Fa-f]{6}' "$CSS_FILE" | sort -u)

    # Extract rgb() colors and convert to hex
    local rgb_colors
    rgb_colors=$(grep -oE 'rgb\([0-9]+,\s*[0-9]+,\s*[0-9]+\)' "$CSS_FILE" | sort -u)

    local index=1
    echo '['
    local first=true

    while IFS= read -r color; do
        [[ -z "$color" ]] && continue
        if [[ "$first" == "true" ]]; then first=false; else echo ','; fi

        # Generate semantic slug
        local slug="color-${index}"
        local name="Color ${index}"
        case "$color" in
            "#ffffff"|"#FFFFFF") slug="white"; name="White" ;;
            "#000000") slug="black"; name="Black" ;;
        esac

        printf '  { "slug": "%s", "color": "%s", "name": "%s" }' "$slug" "$color" "$name"
        index=$((index + 1))
    done <<< "$colors"

    # Handle rgb() colors
    while IFS= read -r rgb; do
        [[ -z "$rgb" ]] && continue
        # Extract r,g,b values
        local r g b hex
        r=$(echo "$rgb" | grep -oE '[0-9]+' | sed -n '1p')
        g=$(echo "$rgb" | grep -oE '[0-9]+' | sed -n '2p')
        b=$(echo "$rgb" | grep -oE '[0-9]+' | sed -n '3p')
        hex=$(printf '#%02x%02x%02x' "$r" "$g" "$b")

        if [[ "$first" == "true" ]]; then first=false; else echo ','; fi
        printf '  { "slug": "color-%s", "color": "%s", "name": "Color %s" }' "$index" "$hex" "$index"
        index=$((index + 1))
    done <<< "$rgb_colors"

    echo ''
    echo ']'
}

# --- Extract font families ---
extract_fonts() {
    local fonts
    fonts=$(grep -oE 'font-family:\s*[^;]+' "$CSS_FILE" | sed 's/font-family:\s*//' | sort -u)

    local index=1
    echo '['
    local first=true

    while IFS= read -r font_stack; do
        [[ -z "$font_stack" ]] && continue
        if [[ "$first" == "true" ]]; then first=false; else echo ','; fi

        # Extract primary font name
        local primary_font
        primary_font=$(echo "$font_stack" | cut -d',' -f1 | tr -d '"' | tr -d "'" | xargs)

        local slug
        slug=$(echo "$primary_font" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

        printf '  { "slug": "%s", "fontFamily": "%s", "name": "%s" }' \
            "$slug" "$font_stack" "$primary_font"
        index=$((index + 1))
    done <<< "$fonts"

    echo ''
    echo ']'
}

# --- Extract font sizes ---
extract_font_sizes() {
    local sizes
    sizes=$(grep -oE 'font-size:\s*[0-9]+px' "$CSS_FILE" | grep -oE '[0-9]+px' | sort -un)

    echo '['
    local first=true

    while IFS= read -r size; do
        [[ -z "$size" ]] && continue
        if [[ "$first" == "true" ]]; then first=false; else echo ','; fi

        local px=${size%px}
        local slug name
        if [[ $px -le 14 ]]; then slug="small"; name="Small"
        elif [[ $px -le 16 ]]; then slug="base"; name="Base"
        elif [[ $px -le 18 ]]; then slug="medium"; name="Medium"
        elif [[ $px -le 20 ]]; then slug="large"; name="Large"
        elif [[ $px -le 24 ]]; then slug="x-large"; name="Extra Large"
        elif [[ $px -le 32 ]]; then slug="2x-large"; name="2X Large"
        elif [[ $px -le 40 ]]; then slug="3x-large"; name="3X Large"
        elif [[ $px -le 56 ]]; then slug="4x-large"; name="4X Large"
        else slug="5x-large"; name="5X Large"
        fi

        printf '  { "slug": "%s", "size": "%s", "name": "%s" }' "$slug" "$size" "$name"
    done <<< "$sizes"

    echo ''
    echo ']'
}

# --- Extract spacing values ---
extract_spacing() {
    local values
    values=$(grep -oE '(padding|margin|gap):\s*[^;]+' "$CSS_FILE" | \
        grep -oE '[0-9]+px' | sort -un)

    echo '['
    local first=true

    while IFS= read -r size; do
        [[ -z "$size" ]] && continue
        if [[ "$first" == "true" ]]; then first=false; else echo ','; fi

        local px=${size%px}
        local slug
        if [[ $px -le 4 ]]; then slug="20"
        elif [[ $px -le 8 ]]; then slug="30"
        elif [[ $px -le 16 ]]; then slug="40"
        elif [[ $px -le 24 ]]; then slug="50"
        elif [[ $px -le 32 ]]; then slug="60"
        elif [[ $px -le 48 ]]; then slug="70"
        elif [[ $px -le 64 ]]; then slug="80"
        elif [[ $px -le 80 ]]; then slug="90"
        else slug="100"
        fi

        printf '  { "slug": "%s", "size": "%s", "name": "%s" }' "$slug" "$size" "$size"
    done <<< "$values"

    echo ''
    echo ']'
}

# --- Generate complete theme.json settings fragment ---
generate_theme_json() {
    echo '{'
    echo '  "settings": {'

    echo '    "color": {'
    echo '      "palette": '
    extract_colors | sed 's/^/      /'
    echo '    },'

    echo '    "typography": {'
    echo '      "fontFamilies": '
    extract_fonts | sed 's/^/      /'
    echo '      ,'
    echo '      "fontSizes": '
    extract_font_sizes | sed 's/^/      /'
    echo '    },'

    echo '    "spacing": {'
    echo '      "spacingSizes": '
    extract_spacing | sed 's/^/      /'
    echo '    }'

    echo '  }'
    echo '}'
}

# --- Dispatch ---
case "$MODE" in
    --colors) extract_colors ;;
    --fonts) extract_fonts ;;
    --font-sizes) extract_font_sizes ;;
    --spacing) extract_spacing ;;
    --theme-json) generate_theme_json ;;
    *) echo "Unknown mode: $MODE" >&2; exit 1 ;;
esac
```

**Step 4: Run test to verify it passes**

```bash
./tests/libs/bats-core/bin/bats tests/canva-fse/parse-canva-export.bats
```

Expected: All 8 tests PASS.

**Step 5: Commit**

```bash
git add scripts/canva-fse/parse-canva-export.sh tests/canva-fse/parse-canva-export.bats
git commit -m "feat: add Canva CSS export parser with design token extraction"
```

---

## Task 2: Create Canva HTML-to-Block Converter

**Files:**
- Create: `scripts/canva-fse/convert-html-to-blocks.sh`
- Create: `tests/canva-fse/convert-html-to-blocks.bats`

**Step 1: Write the failing test**

Create `tests/canva-fse/convert-html-to-blocks.bats`:

```bash
#!/usr/bin/env bats
load '../test_helper'

SCRIPT="${PROJECT_ROOT}/scripts/canva-fse/convert-html-to-blocks.sh"

@test "convert-html-to-blocks: converts heading elements" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<h1 style="font-size:48px">Hello World</h1>' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:heading {"level":1}'
    assert_output --partial '</h1>'
    assert_output --partial '<!-- /wp:heading -->'
}

@test "convert-html-to-blocks: converts paragraph elements" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<p style="font-size:16px">Body text here.</p>' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:paragraph'
    assert_output --partial 'Body text here.'
    assert_output --partial '<!-- /wp:paragraph -->'
}

@test "convert-html-to-blocks: converts img elements to pattern references" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<img src="hero.png" alt="Hero image" />' > "$html"
    run bash "$SCRIPT" "$html" --theme-slug "my-theme"
    assert_success
    # Images should become pattern references, not inline
    assert_output --partial '<!-- wp:pattern'
}

@test "convert-html-to-blocks: wraps sections in wp:group" {
    local html="${TEST_TEMP_DIR}/page.html"
    cat > "$html" << 'HTML'
<div class="section">
  <h2>Section Title</h2>
  <p>Section content.</p>
</div>
HTML
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:group'
    assert_output --partial '<!-- /wp:group -->'
}

@test "convert-html-to-blocks: converts button/link elements" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<a href="#" class="button" style="background:#1a3f6f">Click Me</a>' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    assert_output --partial '<!-- wp:button'
    assert_output --partial 'Click Me'
}

@test "convert-html-to-blocks: uses theme.json token slugs not hardcoded values" {
    local html="${TEST_TEMP_DIR}/page.html"
    echo '<h1 style="color:#1a3f6f;font-size:48px">Title</h1>' > "$html"
    run bash "$SCRIPT" "$html"
    assert_success
    # Should NOT contain hardcoded hex
    refute_output --partial '"#1a3f6f"'
}

@test "convert-html-to-blocks: fails gracefully with missing file" {
    run bash "$SCRIPT" "/nonexistent/page.html"
    assert_failure
    assert_output --partial "not found"
}
```

**Step 2:** Run test — FAIL (script doesn't exist).

**Step 3: Write minimal implementation**

The script reads Canva export HTML, identifies elements (headings, paragraphs, images, sections, buttons), and outputs WordPress block markup. Key rules:
- Replace inline hex colors with theme.json slug references
- Replace inline font-sizes with theme.json size slugs
- Convert `<img>` to pattern references (pattern-first architecture)
- Wrap `<div>` sections in `wp:group` blocks

**Step 4:** Run test — PASS.

**Step 5: Commit**

```bash
git add scripts/canva-fse/convert-html-to-blocks.sh tests/canva-fse/convert-html-to-blocks.bats
git commit -m "feat: add Canva HTML to WordPress block converter"
```

---

## Task 3: Symlink Shared Validation Scripts

**Files:**
- Create: `scripts/canva-fse/validate-template.sh` (symlink)
- Create: `scripts/canva-fse/validate-pattern-architecture.sh` (symlink)
- Create: `scripts/canva-fse/validate-theme-location.sh` (symlink)
- Create: `scripts/canva-fse/generate-comparison-report.sh` (symlink)

**Step 1:** No tests needed — these are symlinks to already-tested scripts.

**Step 2: Create symlinks**

```bash
cd scripts/canva-fse
ln -s ../figma-fse/validate-template.sh validate-template.sh
ln -s ../figma-fse/validate-pattern-architecture.sh validate-pattern-architecture.sh
ln -s ../figma-fse/validate-theme-location.sh validate-theme-location.sh
ln -s ../figma-fse/generate-comparison-report.sh generate-comparison-report.sh
```

**Step 3: Commit**

```bash
git add scripts/canva-fse/
git commit -m "feat: symlink shared validation scripts for Canva pipeline"
```

---

## Task 4: Create Canva FSE Converter Agent

**Files:**
- Create: `.claude/agents/canva-fse-converter.md`

**Step 1:** No automated test — agent definition is declarative YAML+markdown.

**Step 2: Write agent definition**

The agent mirrors `figma-fse-converter.md` but:
- Removes all `mcp__figma*` tools (Canva has no MCP)
- Adds vision capability for analyzing Canva screenshots
- References `scripts/canva-fse/` instead of `scripts/figma-fse/`
- Uses the same PostToolUse validation hooks
- Describes the Canva-specific workflow (import HTML/CSS → parse tokens → convert blocks)

Key agent sections:
1. Primary responsibilities (parse Canva exports, extract tokens, generate theme.json, convert to blocks)
2. Canva element mapping table (Canva → WordPress blocks)
3. Workflow phases (import → parse → convert → validate)
4. Error recovery (malformed HTML, missing CSS, unsupported elements)

**Step 3: Commit**

```bash
git add .claude/agents/canva-fse-converter.md
git commit -m "feat: add Canva FSE converter agent definition"
```

---

## Task 5: Create Canva-to-FSE Workflow Skill

**Files:**
- Create: `.claude/skills/canva-to-fse-autonomous-workflow/SKILL.md`

**Step 1:** No automated test — skill is documentation/instructions.

**Step 2: Write skill**

The skill adapts the Figma workflow's 3-phase approach for Canva:

**Phase 1: Import & Parse (1-2 min, interactive)**
- Ask user for Canva export directory (HTML + CSS + images)
- Run `parse-canva-export.sh --theme-json` to extract tokens
- Merge with fallback tokens (same strategy as Figma)
- Create theme.json
- Survey exported pages, create conversion plan
- Ask user approval

**Phase 2: Autonomous Conversion (5-30 min, zero interruptions)**
- FOR EACH exported HTML page:
  - Run `convert-html-to-blocks.sh` for initial conversion
  - Refine block markup using Claude vision on screenshots
  - Create PHP patterns for image sections
  - Apply theme.json tokens (no hardcoded values)
  - Validation hooks run automatically
- Create style.css with theme header
- Generate comparison report

**Phase 3: Completion (<1 min)**
- Present summary
- Link to report
- Provide next steps

**Trigger phrases:**
- "Convert Canva design to WordPress"
- "Canva to FSE theme"
- "Import Canva export"

**Step 3: Commit**

```bash
git add .claude/skills/canva-to-fse-autonomous-workflow/
git commit -m "feat: add Canva-to-FSE autonomous workflow skill"
```

---

## Task 6: Create User Documentation

**Files:**
- Create: `docs/canva-to-wordpress/README.md`
- Create: `docs/canva-to-wordpress/EXPORT-GUIDE.md`

**Step 1:** No automated test — documentation.

**Step 2: Write documentation**

**README.md** covers:
- What this does (Canva exports → WordPress FSE themes)
- Prerequisites (Canva Pro for HTML export, or free tier with CSS copy)
- Quick start (3 steps)
- How to export from Canva (step-by-step with expected file structure)
- What gets generated (theme.json, templates, patterns)
- Comparison with Figma pipeline
- Troubleshooting

**EXPORT-GUIDE.md** covers:
- How to export HTML/CSS from Canva (with screenshots descriptions)
- Expected directory structure after export
- Which Canva features map well to WordPress
- Known limitations (Canva animations, complex layouts)
- Tips for designing in Canva with WordPress conversion in mind

**Step 3: Commit**

```bash
git add docs/canva-to-wordpress/
git commit -m "docs: add Canva-to-WordPress workflow documentation"
```

---

## Task 7: Update CLAUDE.md with Canva Pipeline References

**Files:**
- Modify: `CLAUDE.md` (add Canva pipeline section alongside Figma)

**Step 1:** No test — configuration file.

**Step 2: Update CLAUDE.md**

Add a "Canva-to-WordPress Automation" subsection near the Figma section:
- Reference `docs/canva-to-wordpress/`
- List the new agent (`canva-fse-converter`)
- List the new skill (`canva-to-fse-autonomous-workflow`)
- Note shared validation scripts

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Canva pipeline references to CLAUDE.md"
```

---

## Task 8: Add Canva Pipeline Tests to CI

**Files:**
- Modify: `.github/workflows/pipeline-tests.yml` (add `tests/canva-fse/` to test run)

**Step 1: Write test to verify CI config**

No separate test — the BATS tests from Tasks 1-2 will run in CI.

**Step 2: Update CI workflow**

Add `scripts/canva-fse/**` to the path filter and add `tests/canva-fse/` to the test run command.

**Step 3: Commit**

```bash
git add .github/workflows/pipeline-tests.yml
git commit -m "ci: add Canva pipeline tests to CI workflow"
```

---

## Task 9: Final Verification

**Step 1:** Run all tests

```bash
./tests/libs/bats-core/bin/bats tests/canva-fse/ tests/figma-fse/
```

Expected: All Canva tests + all Figma tests pass (no regressions).

**Step 2:** Verify file structure

```
scripts/canva-fse/
├── parse-canva-export.sh          # New: CSS token parser
├── convert-html-to-blocks.sh      # New: HTML to block converter
├── validate-template.sh           # Symlink → figma-fse/
├── validate-pattern-architecture.sh # Symlink → figma-fse/
├── validate-theme-location.sh     # Symlink → figma-fse/
└── generate-comparison-report.sh  # Symlink → figma-fse/

.claude/agents/canva-fse-converter.md    # New agent
.claude/skills/canva-to-fse-autonomous-workflow/SKILL.md  # New skill

docs/canva-to-wordpress/
├── README.md                      # User guide
└── EXPORT-GUIDE.md               # Canva export instructions

tests/canva-fse/
├── parse-canva-export.bats        # Token parser tests
└── convert-html-to-blocks.bats    # Block converter tests
```

**Step 3:** Create PR

---

## Acceptance Criteria Mapping

| Criteria | Task(s) |
|----------|---------|
| Canva HTML/CSS exports converted to block templates | Task 1 (parser), Task 2 (converter) |
| Design tokens extracted from Canva designs | Task 1 (parse-canva-export.sh) |
| Documentation for Canva-to-WordPress workflow | Task 6 (docs), Task 5 (skill) |
| Shared validation infrastructure | Task 3 (symlinks) |
| CI integration | Task 8 |
