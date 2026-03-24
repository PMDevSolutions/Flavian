---
name: canva-to-fse-autonomous-workflow
description: Use when converting Canva HTML/CSS exports to WordPress FSE block themes. Orchestrates autonomous workflow from CSS token extraction through template generation. Keywords: Canva to WordPress, FSE conversion, HTML export, CSS design tokens, autonomous template generation
---

# Canva-to-FSE Autonomous Workflow

## Overview

This skill orchestrates the complete autonomous conversion of Canva HTML/CSS exports into WordPress Full Site Editing (FSE) block themes. It parses static HTML and CSS files exported from Canva, extracts design tokens, and generates standards-compliant FSE templates without requiring any live design tool connection.

**Core Innovation:** Hybrid approach with brief clarification phase (1-2 min) followed by fully autonomous execution using `superpowers:executing-plans`.

**Key Principle:** Design system FIRST -> theme.json foundation SECOND -> templates THIRD -> verification FOURTH. Extract ALL design tokens from CSS wholesale before generating any templates.

## When to Use

Use this skill when:
- Converting Canva designs/exports to WordPress FSE themes
- Building WordPress themes from Canva HTML/CSS export files
- Generating FSE templates from static HTML page exports
- Extracting CSS design tokens to theme.json

**Trigger phrases:**
- "Convert Canva to WordPress"
- "Canva to FSE theme"
- "Import Canva export"
- "Turn Canva export into WordPress theme"
- "Generate FSE theme from Canva"

When NOT to use:
- Classic WordPress themes (non-FSE)
- Plugin development
- Simple CSS changes to existing themes
- Designs in Figma (use `figma-to-fse-autonomous-workflow` skill instead)

## Prerequisites

Before starting, verify:
- [ ] Canva export directory exists with HTML and CSS files
- [ ] Expected structure: `export/` directory with `*.html` pages and `style.css` (or similar CSS file)
- [ ] Image assets exported separately (PNG/JPG/SVG files available)
- [ ] WordPress theme structure exists (`themes/` directory at project root)

**Expected Canva export layout:**
```
export/
├── index.html          # Homepage
├── about.html          # About page (optional)
├── contact.html        # Contact page (optional)
├── style.css           # Main stylesheet (or styles.css, css/style.css)
└── images/             # Exported image assets
    ├── hero-bg.jpg
    ├── logo.png
    └── ...
```

**Critical:** If no HTML/CSS files are found in the provided directory, STOP and inform user before proceeding.

## CRITICAL: File Location Requirements

**This project uses ROOT-LEVEL folders for theme development:**

```
project-root/
└── themes/[theme-name]/     <- ALL theme files go HERE (NOT wp-content/themes/)
```

**PRE-FLIGHT VALIDATION (Run BEFORE any file writes):**

Before creating or modifying ANY theme files, verify:
1. [ ] `themes/` directory exists at project root
2. [ ] NO files being created in `wp-content/themes/` (NEVER use this path)
3. [ ] Theme name slug is valid (lowercase, hyphens only, no spaces)

**Auto-validation script:** `scripts/canva-fse/validate-theme-location.sh` will block incorrect paths.

**Why root-level?**
- Clean development structure (no nested wp-content)
- Easier version control
- Testing copies files to WordPress `wp-content/` separately

**Deployment Note:** During testing, files are copied from `themes/` to WordPress `wp-content/themes/`. See TESTING-GUIDE.md for deployment procedures.

## Fallback Design Tokens (Default Design System)

**CRITICAL:** When Canva CSS extraction is incomplete, returns partial results, or fails entirely, use these professional fallback defaults. This ensures the workflow NEVER blocks on missing design data.

### Fallback Color Palette (13 tokens)

All colors are WCAG AA compliant with appropriate contrast ratios:

```javascript
const FALLBACK_COLORS = {
  // Primary palette (Professional blue-gray)
  "primary": "#34495e",           // Main brand color
  "primary-dark": "#293a4b",      // Darker variant
  "primary-darker": "#141d25",    // Darkest variant
  "primary-light": "#707f8e",     // Lighter variant
  "primary-lightest": "#eaecee",  // Lightest variant

  // Accent palette (Teal)
  "accent": "#16a085",            // Accent color
  "accent-dark": "#11806a",       // Darker accent
  "accent-darker": "#084035",     // Darkest accent
  "accent-lightest": "#e7f5f2",   // Lightest accent

  // Neutrals
  "white": "#ffffff",             // Pure white
  "black": "#0c0c0c",            // Near black (softer than pure black)
  "background": "#fdfdfd",        // Off-white background
  "gray": "#5e6060"               // Mid-tone gray
};
```

### Fallback Typography (2 families, 9 sizes)

**Font families:**
- Primary: `"Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"`
- Heading: `"Questrial", "Georgia", "serif"`

**Font sizes** (9-point scale):

```javascript
const FALLBACK_FONT_SIZES = [
  { slug: "small", size: "14px", name: "Small" },          // Body small
  { slug: "base", size: "16px", name: "Base" },            // Body text
  { slug: "medium", size: "18px", name: "Medium" },        // Large body
  { slug: "large", size: "20px", name: "Large" },          // Subheading
  { slug: "x-large", size: "24px", name: "Extra Large" },  // H4
  { slug: "2x-large", size: "32px", name: "2X Large" },    // H3
  { slug: "3x-large", size: "40px", name: "3X Large" },    // H2
  { slug: "4x-large", size: "56px", name: "4X Large" },    // H1
  { slug: "5x-large", size: "72px", name: "5X Large" }     // Hero heading
];
```

### Fallback Spacing (10 tokens)

**Based on 4px base unit:**

```javascript
const FALLBACK_SPACING = [
  { slug: "20", size: "4px", name: "1" },      // xs: 4px
  { slug: "30", size: "8px", name: "2" },      // sm: 8px
  { slug: "40", size: "16px", name: "3" },     // base: 16px
  { slug: "50", size: "24px", name: "4" },     // md: 24px
  { slug: "60", size: "32px", name: "5" },     // lg: 32px
  { slug: "70", size: "40px", name: "6" },     // xl: 40px
  { slug: "80", size: "48px", name: "7" },     // 2xl: 48px
  { slug: "90", size: "64px", name: "8" },     // 3xl: 64px
  { slug: "100", size: "80px", name: "9" },    // 4xl: 80px
  { slug: "110", size: "112px", name: "10" }   // 5xl: 112px
];
```

### Fallback Layout Settings

```javascript
const FALLBACK_LAYOUT = {
  contentSize: "768px",    // Standard content width
  wideSize: "1280px"       // Wide content width
};
```

### When to Use Fallback Tokens

**Use fallback tokens when:**
1. Canva CSS has NO custom properties or design variables
2. CSS parsing fails or returns incomplete results
3. Inline styles dominate with no consistent design system
4. Export contains only minimal or reset stylesheets
5. Token extraction errors occur

**Merge strategy (when partial CSS tokens exist):**
- Canva-extracted tokens take precedence
- Fallback tokens fill gaps
- Never leave theme.json with missing values

**Example merge:**
```javascript
// Canva CSS has 5 colors, fallback has 13
// Result: 5 Canva colors + 8 additional fallback colors = 13 total
```

## The Workflow

### Phase 1: Import & Parse (1-2 minutes, Interactive)

**Step 1.1: Gather Export Location**

Ask user for the Canva export directory path. Verify:
1. Directory exists and contains HTML files
2. At least one CSS file is present (check `style.css`, `styles.css`, `css/style.css`, or inline `<style>` blocks)
3. Note any image assets directory

**Step 1.2: Create theme.json Foundation FIRST**

**CRITICAL:** Create theme.json IMMEDIATELY, before any template conversion. This step NEVER blocks the workflow.

**CSS extraction workflow:**

```javascript
async function createThemeJsonFoundation(exportDir, themeName) {
  console.log("Step 1.2: Creating theme.json foundation...");

  // 1. Parse CSS files for design tokens (non-blocking)
  const cssTokens = await parseCssForTokens(exportDir);

  let tokens;

  if (cssTokens && cssTokens.colors.length > 0) {
    // CSS tokens found - use them
    console.log(`Found ${cssTokens.colors.length} colors, ${cssTokens.fontSizes.length} font sizes`);
    tokens = cssTokens;
  } else {
    // No usable tokens - use fallback defaults
    console.log("No CSS design tokens found, using professional fallback tokens");
    tokens = FALLBACK_DESIGN_TOKENS;
  }

  // 2. Merge extracted tokens with fallbacks (extracted takes precedence)
  const mergedTokens = mergeCssWithDefaults(tokens, FALLBACK_DESIGN_TOKENS);

  // 3. Generate theme.json immediately
  const themeJson = generateThemeJson(mergedTokens, themeName);

  // 4. Write to file (root-level themes/ folder)
  await writeFile(`themes/${themeName}/theme.json`, themeJson);
  console.log(`theme.json created at themes/${themeName}/theme.json`);

  return { themeJson, tokens: mergedTokens };
}
```

Run: `./scripts/canva-fse/parse-canva-export.sh --theme-json export/style.css`

**CSS parsing targets:**
- CSS custom properties (`--color-primary`, `--font-size-lg`, etc.)
- Repeated hex colors, RGB/HSL values across rules
- Font-family declarations
- Font-size values
- Margin/padding patterns (for spacing tokens)
- Max-width values (for layout dimensions)
- If CSS is minimal: scan inline `<style>` blocks and `style=""` attributes in HTML

**Merge strategy:**
- Canva CSS tokens override fallback tokens (by slug)
- Fill gaps with fallback tokens
- Ensure minimum viable theme.json (13+ colors, 9+ sizes, 10+ spacing)

**Result:** theme.json exists with complete design system BEFORE template work begins.

**Step 1.3: Survey Exported HTML Pages**

Scan the export directory for HTML files:
1. List all `*.html` files
2. Open each file and identify its page type (homepage, about, services, contact, etc.)
3. Note structural patterns (shared headers, footers, navigation)
4. Identify image references and their paths

**Step 1.4: Create Conversion Plan**

Map HTML structures to WordPress blocks using the element mapping table (see below). Use `superpowers:writing-plans` to create a detailed plan:

```
Plan structure:
1. theme.json already created (Phase 1.2)
2. Create theme directory structure (style.css, templates/, parts/, patterns/)
3. Extract shared components (header, footer, navigation)
4. For each HTML page (1-N):
   - Parse HTML structure into block hierarchy
   - Convert elements to WordPress blocks
   - Replace hardcoded colors/sizes with theme.json token slugs
   - Create PHP patterns for image-containing sections
   - Generate FSE template
5. Run automated verification
6. Generate comparison report
```

**Step 1.5: Present Plan to User**

Show:
- Complete design token mapping (colors, typography, spacing extracted from CSS)
- List of HTML pages to convert
- Element-to-block mapping strategy
- Confirmation prompt: "Proceed with autonomous conversion?"

### Phase 2: Autonomous Conversion (5-30 minutes, Zero Interruptions)

**Critical:** Once user approves, use `superpowers:executing-plans` to execute the plan WITHOUT any "should I continue?" prompts.

**Step 2.1: Trigger Autonomous Execution**

```
User: "Yes, proceed"
-> Invoke: Skill(superpowers:executing-plans)
-> Pass: Implementation plan from Phase 1
-> Mode: Autonomous (no checkpoint prompts)
```

**Step 2.2: Verify theme.json Foundation**

theme.json already created in Phase 1.2 - verify it exists:
- Check file exists: `themes/<theme-name>/theme.json`
- Verify completeness (13+ colors, 9+ font sizes, 10+ spacing tokens)
- Validate JSON syntax
- Confirm NO placeholder values

**Step 2.3: Create Theme Structure**

```
themes/<theme-name>/
├── style.css          # Theme header
├── functions.php      # Asset enqueuing, pattern registration
├── theme.json         # Design system (from Phase 1)
├── templates/
│   ├── index.html     # Fallback (required)
│   └── [other templates as identified]
├── parts/
│   ├── header.html
│   └── footer.html
└── patterns/          # PHP patterns for image sections
```

**Step 2.4: Convert Each HTML Page**

For EACH exported HTML page:

1. Run: `./scripts/canva-fse/convert-html-to-blocks.sh export/page.html`
2. Refine block markup:
   - Fix nesting (ensure valid block parent/child relationships)
   - Add semantic HTML attributes (aria labels, roles)
   - Replace inline styles with block attributes
3. Replace hardcoded values with theme.json token slugs:
   - Hex colors -> `var:preset|color|{slug}`
   - Pixel font sizes -> `var:preset|font-size|{slug}`
   - Spacing values -> `var:preset|spacing|{slug}`
4. Create PHP patterns for image-containing sections (pattern-first architecture)
5. Write template to `themes/{theme-name}/templates/{page}.html`
6. Validation hooks run automatically after each write

**Step 2.5: Generate Supporting Files**

After all pages are converted:

7. Create `style.css` with WordPress theme header:
   ```css
   /*
   Theme Name: {Theme Name}
   Description: FSE block theme converted from Canva export
   Requires at least: 6.0
   Tested up to: 6.7
   Requires PHP: 7.4
   Version: 1.0.0
   License: GNU General Public License v2 or later
   Text Domain: {theme-slug}
   */
   ```

8. Create `functions.php` with asset enqueuing and pattern registration

9. Generate comparison report:
   Run: `./scripts/canva-fse/generate-comparison-report.sh`

### Phase 3: Completion (<1 minute)

1. Present summary:
   - Number of templates converted
   - Number of design tokens extracted from CSS
   - Number of PHP patterns created
   - Any issues or warnings encountered
2. Link to comparison report
3. Provide WordPress activation instructions:
   ```
   1. Copy themes/{theme-name}/ to your WordPress wp-content/themes/ directory
   2. In WordPress admin: Appearance -> Themes -> Activate "{Theme Name}"
   3. Visit your site to verify the theme
   ```

## Pattern-First Architecture

**CRITICAL RULES:**

- Images MUST go in `patterns/*.php` files (PHP executes there)
- Templates reference patterns: `<!-- wp:pattern {"slug":"theme/pattern-name"} /-->`
- NEVER put PHP code in `.html` template files
- NEVER use empty `src=""` attributes

**Example pattern** (`patterns/hero-image.php`):

```php
<?php
/**
 * Title: Hero Image
 * Slug: theme-name/hero-image
 * Categories: featured
 */
?>
<!-- wp:cover {"url":"<?php echo esc_url( get_theme_file_uri( 'assets/images/hero-bg.jpg' ) ); ?>","dimRatio":50} -->
<div class="wp-block-cover">
  <span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span>
  <img class="wp-block-cover__image-background" alt="Hero background" src="<?php echo esc_url( get_theme_file_uri( 'assets/images/hero-bg.jpg' ) ); ?>" data-object-fit="cover"/>
  <div class="wp-block-cover__inner-container">
    <!-- wp:heading {"level":1,"style":{"color":{"text":"var:preset|color|white)"}}} -->
    <h1 class="wp-block-heading has-white-color has-text-color">Welcome</h1>
    <!-- /wp:heading -->
  </div>
</div>
<!-- /wp:cover -->
```

**Example template referencing the pattern** (`templates/front-page.html`):

```html
<!-- wp:template-part {"slug":"header","area":"header"} /-->
<!-- wp:pattern {"slug":"theme-name/hero-image"} /-->
<!-- wp:template-part {"slug":"footer","area":"footer"} /-->
```

## Canva Element to WordPress Block Mapping

| Canva/HTML Element | WordPress Block | Implementation Notes |
|---|---|---|
| Heading text (`<h1>`-`<h6>`) | `wp:heading` | Preserve heading level hierarchy |
| Body text (`<p>`) | `wp:paragraph` | Map font styles to theme.json presets |
| Image (`<img>`) | `wp:image` via pattern | Always use pattern-first for images |
| Button/CTA (`<a>`, `<button>`) | `wp:button` | Wrap in `wp:buttons` container |
| Section/container (`<div>`, `<section>`) | `wp:group` | Use layout attributes for alignment |
| Multi-column layout | `wp:columns` + `wp:column` | Map flex/grid to column widths |
| List (`<ul>`, `<ol>`) | `wp:list` | Preserve list type and nesting |
| Divider (`<hr>`) | `wp:separator` | Map border styles to separator style |
| Background image section | `wp:cover` via pattern | Use dimRatio for overlay opacity |
| Navigation bar (`<nav>`) | `wp:navigation` | Extract menu items and links |
| Spacer element | `wp:spacer` | Use theme.json spacing tokens for height |
| Blockquote (`<blockquote>`) | `wp:quote` | Preserve citation if present |
| Video embed | `wp:video` or `wp:embed` | Use embed for YouTube/Vimeo URLs |
| Icon/SVG | `wp:image` via pattern | Inline SVG or image reference |
| Form | `wp:form` or third-party block | Note: core form block is limited |

## Quality Standards

All generated themes MUST meet these criteria:

- **100% theme.json token usage** - Zero hardcoded hex colors or pixel sizes in templates
- **All templates pass** `validate-template.sh`
- **All patterns follow** pattern-first architecture (no PHP in HTML templates)
- **All files in root-level** `themes/` directory (never `wp-content/themes/`)
- **WordPress coding standards** compliance (PHP files pass PHPCS)
- **Security scan clean** - All output escaped, all URLs sanitized
- **Valid block markup** - Proper opening/closing comments, valid nesting
- **Accessibility** - Semantic HTML, alt text on images, proper heading hierarchy

## Error Recovery

| Error Scenario | Recovery Strategy |
|---|---|
| Malformed HTML | Use Claude vision to analyze screenshots of the original Canva design, generate blocks manually |
| Missing CSS / no stylesheet | Use fallback design tokens for the complete theme.json |
| Unsupported Canva elements | Convert to closest WordPress block equivalent, log warning in comparison report |
| Inline styles remaining after conversion | Extract to theme.json tokens during refinement pass |
| Broken image paths | Create pattern with `get_theme_file_uri()` pointing to `assets/images/` |
| Complex CSS grid layouts | Simplify to `wp:columns` with appropriate column counts |
| JavaScript-dependent elements | Convert to static block equivalent, note limitation in report |
| Empty or placeholder content | Use Lorem Ipsum with clear TODO comments for replacement |

## Differences from Figma Pipeline

| Aspect | Canva Pipeline | Figma Pipeline |
|---|---|---|
| **Input** | Static HTML/CSS files | Live Figma MCP connection |
| **Token extraction** | CSS parsing (`parse-canva-export.sh`) | `get_variable_defs` API |
| **Layout analysis** | HTML DOM structure | Structured Figma component data |
| **Image handling** | Pre-exported files in directory | Downloaded via Figma image export |
| **MCP dependency** | None required | Figma MCP server required |
| **Interactivity** | File path prompt only | Figma URL + Dev Mode required |
| **Validation** | Shared infrastructure | Shared infrastructure |
| **Script directory** | `scripts/canva-fse/` | `scripts/figma-fse/` |

**Shared infrastructure:**
- Theme location validation logic
- Template validation scripts
- Pattern-first architecture rules
- Fallback design tokens
- Quality standards and security scans
- WordPress coding standards checks
