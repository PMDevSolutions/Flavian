---
name: visual-qa-verification
description: Use after Figma-to-FSE conversion to verify generated themes match the source design. Covers screenshot comparison, responsive checks, Lighthouse audits, image rendering, and accessibility validation. Keywords: verify theme, visual QA, compare to Figma, check screenshots, responsive test, post-conversion verification, pixel-perfect check
---

# Visual QA Verification

## Overview

After the figma-fse-converter agent generates a WordPress FSE theme, this skill guides verification that the output matches the Figma source design. It covers screenshot comparison, responsive behavior, accessibility, performance, and image rendering.

**Core Principle:** Every converted theme must be visually verified before delivery. The figma-fse-completion hook validates structure and tokens; this skill validates what the user actually sees.

## When to Use

Use this skill when:
- A Figma-to-FSE conversion has just completed
- Verifying a generated theme matches its Figma source
- Running post-conversion visual QA
- Checking responsive behavior of generated templates
- Validating that all images render correctly

**Symptoms that trigger this skill:**
- "verify theme"
- "visual QA"
- "compare to Figma"
- "check screenshots"
- "does it match the design"
- "responsive check"
- "pixel-perfect"

## Verification Checklist

Run these checks in order after conversion completes.

### Step 1: Theme Activation

Deploy the generated theme to a local WordPress instance and activate it.

```bash
# Copy theme to WordPress wp-content
cp -r themes/[theme-name] /path/to/wordpress/wp-content/themes/

# Activate theme
wp theme activate [theme-name]

# Seed demo content if empty
wp plugin install wordpress-importer --activate
wp import content.xml --authors=create
```

### Step 2: Screenshot Comparison

Take screenshots at standard breakpoints and compare against the Figma source.

**Breakpoints to test:**

| Breakpoint | Width | Description |
|------------|-------|-------------|
| Mobile | 375px | iPhone SE / small phones |
| Tablet | 768px | iPad portrait |
| Desktop | 1280px | Standard laptop |
| Wide | 1440px | Design canvas (Figma default) |
| Extra-large | 1920px | Full HD monitors / large displays |

**Using Playwright MCP (Chromium — primary):**

```
1. Navigate to local WordPress URL (mcp__playwright__browser_navigate)
2. Take screenshot at each breakpoint (mcp__playwright__browser_resize, then mcp__playwright__browser_take_screenshot)
3. Compare visually against Figma source (get_screenshot from Figma MCP)
```

**Using Playwright MCP (Firefox & WebKit — cross-browser):**

```
1. Run: ./scripts/cross-browser-test.sh firefox http://localhost:8080
2. Run: ./scripts/cross-browser-test.sh webkit http://localhost:8080
3. Compare Firefox/WebKit screenshots against Chromium baseline
4. Flag any browser-specific rendering differences
```

Or use the Playwright MCP tools directly (`browser_navigate`, `browser_resize`, `browser_take_screenshot`) for interactive testing.

**Setup (one-time):** `./scripts/setup-playwright.sh`

**What to compare:**
- Layout structure (columns, rows, spacing)
- Typography (font sizes, weights, line heights)
- Color accuracy (background, text, borders)
- Component alignment (centered, left, right)
- Whitespace and padding
- Cross-browser rendering consistency (Chromium vs Firefox vs WebKit)

### Step 3: Image Rendering

Verify all images load correctly. This catches pattern-first architecture issues.

```bash
# Check for broken image references in templates
grep -r 'src=""' themes/[theme-name]/templates/ && echo "FAIL: Empty src found" || echo "PASS"

# Check pattern files use get_theme_file_uri()
grep -r 'get_theme_file_uri' themes/[theme-name]/patterns/ | wc -l

# Check no hardcoded image URLs in HTML templates
grep -r 'src="http' themes/[theme-name]/templates/ && echo "WARN: Hardcoded URLs" || echo "PASS"
```

**In browser:** Open DevTools Network tab, filter by "img", reload page. Any 404s indicate broken image references.

### Step 4: Responsive Behavior

Test that layouts respond correctly at each breakpoint.

**Check for:**
- Navigation collapses to mobile menu
- Multi-column layouts stack on mobile
- Images scale proportionally (no overflow)
- Text remains readable at all sizes
- Touch targets are at least 44x44px on mobile
- No horizontal scrollbar on any breakpoint

**Common failures after conversion:**
- Fixed widths that should be fluid (`max-width` not `width`)
- Columns that don't stack (missing responsive block settings)
- Images overflowing containers (missing `max-width: 100%`)

### Step 5: Lighthouse Audit

Run Lighthouse to catch performance and accessibility issues.

**Target scores:**

| Category | Minimum | Target |
|----------|---------|--------|
| Performance | 80 | 90+ |
| Accessibility | 90 | 100 |
| Best Practices | 90 | 100 |
| SEO | 90 | 100 |

**Using the Lighthouse CI CLI:**
```
pnpm lighthouse:run    # runs lhci autorun against lighthouserc.json
```

**Common issues in converted themes:**
- Missing alt text on images (accessibility)
- Large unoptimized images (performance)
- Missing meta description (SEO)
- Low color contrast ratios (accessibility)

### Step 6: Accessibility Checks

Beyond Lighthouse, manually verify:

- **Keyboard navigation:** Tab through the page. Every interactive element must be reachable.
- **Focus indicators:** Visible focus rings on all focusable elements.
- **Heading hierarchy:** h1 > h2 > h3, no skipped levels.
- **Color contrast:** Text meets WCAG AA (4.5:1 for normal text, 3:1 for large text).
- **Skip link:** First focusable element should be "Skip to content".
- **Landmark regions:** header, nav, main, footer present.

```bash
# Check heading hierarchy in templates
for f in themes/[theme-name]/templates/*.html; do
  echo "=== $(basename $f) ==="
  grep -oP 'wp:heading.*?"level":\K[0-9]' "$f" | sort -n
done
```

### Step 7: Design Token Verification

Confirm the theme uses only theme.json tokens, not hardcoded values.

```bash
# Run the completion hook (includes token audit)
bash .claude/hooks/figma-fse-completion.sh themes/[theme-name]
```

**Verify in browser:**
- Change a color in theme.json, refresh — it should update everywhere
- Change a font size in theme.json, refresh — all matching text should update
- Change spacing in theme.json, refresh — all matching spacing should update

## Common Failures

### 1. Fonts Don't Match

**Symptom:** Body text or headings use wrong font family.

**Cause:** Font not loaded, or theme.json `fontFamily` slug doesn't match template references.

**Fix:** Check `theme.json` > `settings.typography.fontFamilies` and verify fonts are either system fonts or properly enqueued via `functions.php`.

### 2. Colors Are Close But Not Exact

**Symptom:** Colors look "off" compared to Figma.

**Cause:** Theme.json color palette uses different hex values than Figma design tokens.

**Fix:** Re-extract color palette from Figma using `get_variable_defs` or `get_design_context`.

### 3. Spacing Feels Wrong

**Symptom:** Elements are too close or too far apart vs. the design.

**Cause:** WordPress spacing scale doesn't match Figma spacing tokens exactly.

**Fix:** Compare `theme.json` > `settings.spacing.spacingSizes` against Figma spacing values. Adjust the scale.

### 4. Images Missing or Broken

**Symptom:** Placeholder boxes or broken image icons.

**Cause:** HTML templates reference images directly instead of using PHP patterns.

**Fix:** Move image references to PHP pattern files using `get_theme_file_uri()`. See the fse-pattern-first-architecture skill.

## Integration with This Template

This skill works with:
- **figma-fse-converter agent** — Generates the theme to verify
- **visual-qa-agent** — Performs visual comparison
- **accessibility-auditor agent** — Runs accessibility checks
- **figma-fse-completion.sh hook** — Structural validation (complements visual QA)
- **Playwright MCP** — Screenshots and responsive testing (Lighthouse via `pnpm lighthouse:run`)
- **figma MCP** — Source design screenshots for comparison

## Verification Report Template

After completing all steps, summarize results:

```markdown
# Visual QA Report: [theme-name]

**Date:** YYYY-MM-DD
**Figma Source:** [URL]
**WordPress URL:** [local URL]

## Results

| Check | Status | Notes |
|-------|--------|-------|
| Desktop match | PASS/FAIL | |
| Tablet match | PASS/FAIL | |
| Mobile match | PASS/FAIL | |
| Images render | PASS/FAIL | |
| Responsive | PASS/FAIL | |
| Lighthouse Perf | XX/100 | |
| Lighthouse A11y | XX/100 | |
| Keyboard nav | PASS/FAIL | |
| Token-only styling | PASS/FAIL | |

## Issues Found
1. ...

## Recommendation
[ ] Ready for delivery
[ ] Needs fixes (see issues above)
```

---

**Skill Version:** 1.0.0
**Last Updated:** 2026-03-06
