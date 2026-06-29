---
name: figma-to-fse-autonomous-workflow
description: Use when converting Figma designs to WordPress FSE block themes. Orchestrates autonomous workflow from design token extraction through pixel-perfect template generation. Keywords: Figma to WordPress, FSE conversion, design tokens, autonomous template generation, pixel-perfect FSE
---

# Figma-to-FSE Autonomous Workflow

## Overview

This skill orchestrates the complete autonomous conversion of Figma designs into WordPress Full Site Editing (FSE) block themes. It bridges Figma design systems with WordPress theme.json, enabling single-prompt conversion of 1-15 templates without "should I continue?" interruptions.

**Core Innovation:** Hybrid approach with brief clarification phase (1-2 min) followed by fully autonomous execution using `superpowers:executing-plans`.

**Key Principle:** Design system FIRST → theme.json foundation SECOND → templates THIRD → verification FOURTH. Extract ALL design tokens wholesale before generating any templates.

## When to Use

Use this skill when:
- Converting Figma designs to WordPress FSE themes
- Building WordPress themes from design mockups
- Generating pixel-perfect FSE templates from Figma
- Extracting Figma design systems to theme.json
- Autonomously creating multiple FSE templates

**Trigger phrases:**
- "Turn Figma designs into FSE templates"
- "Convert Figma to WordPress"
- "Generate FSE theme from Figma"
- "Pixel-perfect FSE conversion"
- "Figma to theme.json"
- "Extract Figma design system"

When NOT to use:
- Classic WordPress themes (non-FSE)
- Plugin development
- Simple CSS changes to existing themes
- Designs not in Figma

## Prerequisites

Before starting, verify:
- [ ] Figma MCP configured (`.mcp.json` has figma-desktop or figma server)
- [ ] Figma file URL or desktop app open with Dev Mode enabled
- [ ] WordPress theme structure exists (`themes/` directory)
- [ ] User has provided Figma file access

**Critical:** If Figma MCP not accessible, STOP and inform user before proceeding.

## ⚠️ CRITICAL: File Location Requirements

**This project uses ROOT-LEVEL folders for theme development:**

```
project-root/
└── themes/[theme-name]/     ← ALL theme files go HERE (NOT wp-content/themes/)
```

**PRE-FLIGHT VALIDATION (Run BEFORE any file writes):**

Before creating or modifying ANY theme files, verify:
1. [ ] `themes/` directory exists at project root
2. [ ] NO files being created in `wp-content/themes/` (NEVER use this path)
3. [ ] Theme name slug is valid (lowercase, hyphens only, no spaces)

**Auto-validation:** the registered PreToolUse hook `.claude/hooks/validate-theme-location.sh` blocks incorrect paths (a copy also lives at `scripts/figma-fse/validate-theme-location.sh`).

**Why root-level?**
- Clean development structure (no nested wp-content)
- Easier version control
- Testing copies files to WordPress `wp-content/` separately

**Deployment Note:** During testing, files are copied from `themes/` to WordPress `wp-content/themes/`. See TESTING-GUIDE.md for deployment procedures.

## Fallback Design Tokens (Default Design System)

**CRITICAL:** When Figma design system is unavailable, incomplete, or cannot be extracted, use these professional fallback defaults. This ensures the workflow NEVER blocks on missing design systems.

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
  "black": "#0c0c0c",             // Near black (softer than pure black)
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
1. Figma file has NO design system page/frame
2. Auto-detection fails to find design system
3. `get_variable_defs` returns empty or incomplete results
4. User cannot provide design system location
5. Design system extraction errors occur

**Merge strategy (when partial design system exists):**
- Figma tokens take precedence
- Fallback tokens fill gaps
- Never leave theme.json with missing values

**Example merge:**
```javascript
// Figma has 5 colors, fallback has 13
// Result: 5 Figma colors + 8 additional fallback colors = 13 total
```

## The Workflow

### Phase 1: Discovery & Planning (1-2 minutes, Interactive)

**Step 1.1: Create theme.json Foundation FIRST**

⚠️ **CRITICAL:** Create theme.json IMMEDIATELY, before any template discovery. This step NEVER blocks the workflow.

**Auto-detection workflow:**

```javascript
async function createThemeJsonFoundation(figmaFileKey, themeName) {
  console.log("Step 1.1: Creating theme.json foundation...");

  // 1. Attempt auto-detection of design system (non-blocking)
  const designSystem = await autoDetectDesignSystem(figmaFileKey);

  let tokens;

  if (designSystem) {
    // Design system found - extract tokens
    console.log(`✓ Found design system: ${designSystem.name}`);
    try {
      tokens = await extractFigmaTokens(designSystem.nodeId);
      console.log(`✓ Extracted ${tokens.colors.length} colors, ${tokens.fontSizes.length} font sizes`);
    } catch (error) {
      console.log(`⚠️  Extraction failed, using fallback tokens`);
      tokens = FALLBACK_DESIGN_TOKENS;
    }
  } else {
    // No design system - use fallback defaults
    console.log("ℹ️  No design system found, using professional fallback tokens");
    tokens = FALLBACK_DESIGN_TOKENS;
  }

  // 2. Merge Figma tokens with fallbacks (Figma takes precedence)
  const mergedTokens = mergeFigmaWithDefaults(tokens, FALLBACK_DESIGN_TOKENS);

  // 3. Generate theme.json immediately
  const themeJson = generateThemeJson(mergedTokens, themeName);

  // 4. Write to file (root-level themes/ folder)
  await writeFile(`themes/${themeName}/theme.json`, themeJson);
  console.log(`✓ theme.json created at themes/${themeName}/theme.json`);

  return { themeJson, tokens: mergedTokens };
}
```

**Auto-detection logic (searches common names):**
- Page names: "Design System", "Styles", "Tokens", "Library", "Components"
- Frame names: "design-system", "tokens", "variables"
- If found: Extract with `get_variable_defs`
- If not found: Use fallback tokens (no user prompt needed)

**Merge strategy:**
- Figma colors override fallback colors (by slug)
- Figma font sizes override fallback sizes (by slug)
- Fill gaps with fallback tokens
- Ensure minimum viable theme.json (13+ colors, 9+ sizes, 10+ spacing)

**Result:** theme.json exists with complete design system BEFORE template work begins.

**NEVER ask user "where is your design system?" - auto-detection or fallbacks handle this.**

**Step 1.2: Survey Templates to Convert**

Use Figma MCP `get_image` or `get_code` to:
1. Count total templates in Figma file (6-15 expected)
2. Identify template types (homepage, about, services, contact, etc.)
3. Capture screenshots of each template for reference

**Step 1.3: Create Component Mapping Plan**

Map Figma components → WordPress blocks using this reference:

| Figma Component | WordPress Block | Implementation Notes |
|----------------|-----------------|---------------------|
| Hero sections | Cover block | Full-width background with overlay |
| Card grids | Columns + Group | Responsive column layouts |
| Navigation bars | Navigation block | Header/footer menus |
| Contact forms | Form block | Use core Form block |
| CTA sections | Buttons + Group | Call-to-action with buttons |
| Testimonials | Quote + Group | Customer quotes with attribution |
| Image galleries | Gallery block | Grid or masonry layouts |
| Text sections | Paragraph + Heading | Content blocks |
| Accordions | Details block | Collapsible content |
| Spacers | Spacer block | Vertical spacing (use theme.json tokens) |

**Step 1.4: Generate Implementation Plan**

Use `superpowers:writing-plans` to create detailed plan:

```
Plan structure:
1. ✅ theme.json already created (Phase 1.1)
2. Create theme directory structure (style.css, templates/, parts/)
3. For each template (1-N):
   - Extract component structure from Figma
   - Generate FSE template HTML using WordPress blocks
   - Apply theme.json tokens exclusively (NO hardcoded values)
   - Add responsive layouts
   - Add accessibility attributes
4. Create supporting block patterns (optional)
5. Run automated verification
6. Generate comparison report
```

**Note:** theme.json is already complete from Step 1.1, so plan focuses on templates and structure.

**Step 1.5: Present Plan to User**

Show:
- Complete design token mapping (colors, typography, spacing)
- List of templates to convert
- Component mapping strategy
- Estimated time (avoid specific time estimates, just note it will be autonomous)
- Confirmation prompt: "Proceed with autonomous conversion?"

### Phase 2: Autonomous Execution (No interruptions until complete)

**Critical:** Once user approves, use `superpowers:executing-plans` to execute the plan WITHOUT any "should I continue?" prompts.

**Step 2.1: Trigger Autonomous Execution**

```
User: "Yes, proceed"
→ Invoke: Skill(superpowers:executing-plans)
→ Pass: Implementation plan from Phase 1
→ Mode: Autonomous (no checkpoint prompts)
```

**Step 2.2: Verify theme.json Foundation**

✅ theme.json already created in Phase 1.1 - verify it exists:
- Check file exists: `themes/<theme-name>/theme.json`
- Verify completeness (13+ colors, 9+ font sizes, 10+ spacing tokens)
- Validate JSON syntax
- Confirm NO placeholder values

**Step 2.3: Create Theme Structure**

```
themes/<theme-name>/
├── style.css          # Theme header
├── theme.json         # Design system (from Phase 1)
├── templates/
│   ├── index.html     # Fallback (required)
│   └── [other templates as identified]
├── parts/
│   ├── header.html
│   └── footer.html
└── patterns/          # Generated patterns
```

**Step 2.3.5: MANDATORY Asset Identification & Semantic Mapping**

⚠️ **CRITICAL:** After downloading Figma assets (images with hash filenames), you MUST view every image file to identify what it depicts BEFORE any template or pattern generation begins. Subagents cannot guess image content from hash filenames.

**Procedure:**

1. **View every downloaded image** using the Read tool (which renders images visually):
   ```
   For each PNG/JPG in themes/{theme-name}/assets/images/:
     Read the file → describe what it shows
   For each SVG in themes/{theme-name}/assets/images/:
     Read the file → identify what icon/logo it is
   ```

2. **Create semantic mapping file** at `.claude/figma-data/asset-semantic-mapping.json`:
   ```json
   {
     "images": {
       "abc123def456.png": {
         "description": "Group photo of lodge members in regalia with flags",
         "semantic_name": "hero-group-photo",
         "suggested_usage": ["hero section", "about page header"]
       },
       "789xyz000111.png": {
         "description": "Masonic square and compass symbol on black background",
         "semantic_name": "masonic-symbol",
         "suggested_usage": ["what-is-masonry section", "decorative"]
       }
     },
     "icons": {
       "aaa111bbb222.svg": {
         "description": "Facebook social media icon",
         "semantic_name": "icon-facebook"
       }
     }
   }
   ```

3. **Provide the semantic mapping to ALL subagents** implementing templates/patterns. Include the full mapping in every subagent prompt so they reference images by verified content, not guessed associations.

**Why this is mandatory:**
- Hash filenames (e.g., `1dc507e8bed...png`) reveal nothing about image content
- Subagents will assign wrong images to wrong sections if they guess
- A lodge seal assigned as a hero photo, or a dinner photo used for a scholarship section, produces obviously wrong results that undermine user trust
- This step takes 2-3 minutes but prevents hours of debugging

**NEVER skip this step. NEVER let subagents guess image assignments.**

**Step 2.4: Convert Templates (Autonomous Loop for 6-15 Templates) + Phase 3 Attribute Validation**

**Phase 2 + 3 Multi-Template Processing:**

Initialize template queue with priority ordering:
```
Priority 1: Template parts (header, footer) - Required by other templates
Priority 2: index.html - Required fallback
Priority 3: Main templates (front-page, page, single, archive, etc.)
Priority 4: Special templates (404, search, etc.)
```

**For EACH template in queue (template X of N):**

1. **Pre-Processing**:
   - Log: "Processing template {X} of {N}: {template-name}"
   - Track: templates_completed[], templates_remaining[]
   - Check context: If approaching 80% context limit → trigger checkpoint (see Context Management)

2. **Extract Structure with Error Recovery**:
   ```
   Try:
     structure = get_code(template_node_id)
     Log: "✓ Structure extracted via get_code"
   Catch annotation error:
     Log: "⚠ get_code failed (annotations detected), falling back to image analysis"
     image = get_image(template_node_id)
     structure = analyze_image_for_blocks(image)
     Log: "✓ Structure extracted via visual analysis"
   Catch connection error:
     Log: "❌ Figma MCP connection failed"
     Try remote MCP fallback
     If both fail: STOP (blocker)
   Continue: (don't stop for non-blocker errors)
   ```

3. **Extract Figma Component Attributes (Phase 3)**:
   ```
   For each component in template:
     a. Extract design properties from Figma:
        - Layout: padding, margin, gap, width, height
        - Typography: font-size, font-weight, line-height, letter-spacing
        - Visual: border-radius, border-width, opacity, box-shadow
        - Colors: fill, stroke, background (exact hex values)

     b. Match to theme.json tokens:
        - Exact match (padding: 24px → spacing-50: 24px): Use token slug
        - Close match (padding: 26px → spacing-50: 24px): Use closest token, log 2px discrepancy
        - No match:
          - If used 3+ times: Add new token to theme.json
          - If used 1-2 times: Use inline style

     c. Track comparison data:
        - Component name
        - Property name
        - Figma value
        - Template value (token or inline)
        - Match type (exact/close/new token/inline)
        - Recommendation (if mismatch)
   ```

4. **Generate FSE Template**:
   - Use WordPress block markup (HTML comments)
   - Apply matched theme.json tokens from attribute extraction
   - Use inline styles only when no suitable token exists
   - Structure: `<!-- wp:block-name {"attributes"} -->content<!-- /wp:block-name -->`
   - Use block mapping from Phase 1
   - Reference existing parts: `<!-- wp:template-part {"slug":"header"} /-->`
   - Log all attribute matches/mismatches

5. **Implement Responsiveness**:
   - Use theme.json breakpoints
   - Apply appropriate block alignment (wide, full)
   - Test mental model: mobile → tablet → desktop
   - Stack columns for mobile views

6. **Add Accessibility**:
   - ARIA labels where needed
   - Semantic HTML structure (header, main, footer, nav, article, aside)
   - Alt text for images (extract from Figma or use placeholder)
   - Keyboard navigation support
   - Heading hierarchy (h1 → h2 → h3, no skipping levels)

7. **Save Attribute Comparison Data (Phase 3)**:
   ```
   Create `.claude/figma-data/` directory if not exists

   Save per-template data to `.claude/figma-data/{template-name}-attributes.json`:
   {
     "template_name": "front-page.html",
     "total_attributes_checked": 45,
     "matched_attributes": 42,
     "mismatches": [
       {
         "component": "Hero Button",
         "property": "padding",
         "figma_value": "24px",
         "template_value": "16px (spacing-40)",
         "recommendation": "Use spacing-50: 24px or add spacing-45: 24px"
       }
     ],
     "exact_matches": 40,
     "close_matches_used": 2,
     "new_tokens_added": 0
   }

   Aggregate into `.claude/figma-data/attribute-comparison.json` (all templates)
   This data will be read by generate-comparison-report.sh
   ```

8. **Validate & Hook Execution**:
   - Run `.claude/hooks/figma-fse-post-template.sh` (if exists)
   - Check for hardcoded hex colors (should be ZERO)
   - Check for hardcoded pixel sizes (should be ZERO)
   - Verify block syntax (balanced open/close tags)
   - If validation failures: Log to errors.log, continue anyway

9. **Update Progress**:
   - Add template to templates_completed[]
   - Remove from templates_remaining[]
   - Log: "✓ Template {X} of {N} complete: {template-name}"
   - NO "should I continue?" prompt to user

10. **Checkpoint Check**:
    - If (templates_completed.length % 3 == 0): Trigger episodic memory checkpoint
    - Continue to next template without waiting

11. **Continue to Next Template** (NO prompt to user)

**Step 2.5: Create Block Patterns**

Identify repetitive sections that can become patterns:
- Hero variants
- CTA sections
- Testimonial layouts
- Card grids

Register patterns in `patterns/` directory.

**Step 2.6: Run Verification**

Automated checks:
- Security scan: `./scripts/wordpress/security-scan.sh themes/<theme-name>`
- Coding standards: `./scripts/wordpress/check-coding-standards.sh themes/<theme-name>`
- Performance: `./scripts/wordpress/check-performance.sh themes/<theme-name>`

If failures occur: Log them but complete remaining templates.

**Step 2.7: MANDATORY Visual Verification Loop**

⚠️ **CRITICAL:** After all templates and patterns are generated, you MUST render the actual site in a browser and compare screenshots against the Figma designs. Code review alone is NOT sufficient - it cannot catch wrong images, broken layouts, or visual regressions.

**Procedure:**

1. **Start local WordPress environment:**
   ```bash
   ./wordpress-local.sh start
   # Install WP-CLI if needed
   docker-compose exec wordpress bash -c "curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp"
   # Install WordPress if needed
   docker-compose exec wordpress wp core install --url="http://localhost:8080" --title="Site" --admin_user=admin --admin_password=admin --admin_email=admin@example.com --allow-root
   # Activate theme
   docker-compose exec wordpress wp theme activate {theme-name} --allow-root
   # Create pages with correct slugs and template assignments
   # Set front page, set permalinks
   ```

2. **For EACH page template, run the verification loop:**
   ```
   For each page (home, about, contact, etc.):
     a. Navigate browser to page URL (mcp__playwright__browser_navigate)
     b. Take full-page screenshot (mcp__playwright__browser_take_screenshot fullPage=true)
     c. Get Figma screenshot of same page (figma MCP: get_screenshot)
     d. View both screenshots side-by-side (Read tool on screenshot file)
     e. Compare section-by-section:
        - Are the correct images in the correct sections?
        - Do layouts match (columns, grids, alignment)?
        - Are colors/backgrounds correct?
        - Is typography rendering properly?
        - Are full-bleed sections actually full-bleed?
     f. Log differences found
     g. Fix any issues directly in the template/pattern files
     h. Reload and re-verify until the page matches
   ```

3. **Minimum verification checklist per page:**
   - [ ] Hero/header image is the CORRECT image (not just "an image")
   - [ ] Section backgrounds match Figma (dark/light/muted)
   - [ ] Column layouts render side-by-side (not stacked)
   - [ ] Full-bleed images go edge-to-edge (no padding)
   - [ ] Text is readable (correct colors on backgrounds)
   - [ ] Buttons are visible and styled correctly
   - [ ] Footer renders with all elements

4. **Create verification report** at `.claude/reports/visual-verification.md`:
   ```markdown
   # Visual Verification Report
   ## Page: Home (front-page.html)
   - Screenshot: [path]
   - Figma match: 95%
   - Issues found: 2
     - Hero image was lodge seal instead of group photo → FIXED
     - CTA image not full-bleed → FIXED
   - Final status: PASS

   ## Page: About (page-about.html)
   ...
   ```

**Iteration rules:**
- If a page has visual issues, fix them and re-verify
- Maximum 3 iteration rounds per page (if still failing after 3, log and move on)
- Do NOT declare the theme complete until at least the homepage passes visual verification
- Image mismatches are ALWAYS fixed (never acceptable)
- Layout issues that affect readability are ALWAYS fixed
- Minor spacing differences (< 8px) can be logged as acceptable

**Why this is mandatory:**
- Code review cannot detect wrong images (hash filenames all look the same in code)
- Layout bugs only manifest when rendered in a real browser
- Full-bleed issues depend on WordPress CSS cascade, not just markup
- This is the difference between "code that looks correct" and "a site that looks correct"

**NEVER skip visual verification. NEVER declare the theme complete based on code review alone.**

**Step 2.8: Generate Comparison Report**

Create `.claude/reports/figma-fse-comparison.md`:
- Templates converted count
- Design tokens used count
- Zero hardcoded values verification
- Quality checks results
- Screenshots comparison (Figma vs rendered)
- Visual verification results (from Step 2.7)
- Issues log

### Phase 3: Completion & Handoff

**Step 3.1: Present Results**

```
✅ Conversion complete!

Your FSE theme is ready at: themes/<theme-name>/

Summary:
- X templates created
- 0 hardcoded values (100% theme.json tokens)
- Fully responsive (mobile/tablet/desktop)
- Accessibility attributes included
- Quality checks: [pass/fail summary]

Next steps:
1. Review theme in WordPress admin
2. Test templates with real content
3. Adjust spacing/colors in theme.json as needed

See detailed report: .claude/reports/figma-fse-comparison.md
```

**NO "should I continue?" during Phase 2-3.** Work autonomously until complete or blocked.

## Figma MCP Integration

### Tool: get_variable_defs

**Purpose:** Extract design tokens from Figma design system

**Usage:**
```
When: Phase 1.2 - Design system extraction
Input: Design system page/frame node ID
Output: JSON of all variables (colors, typography, spacing)
```

**Critical:** Extract COMPLETE system wholesale, not selectively.

### Tool: get_image

**Purpose:** Visual reference and fallback when get_code fails

**Usage:**
```
When:
- Phase 1.4 - Template survey
- Phase 2.4 - Fallback when get_code fails
- Phase 3 - Screenshot comparison

Input: Template/component node ID
Output: PNG screenshot
```

### Tool: get_code

**Purpose:** Extract component structure markup

**Usage:**
```
When: Phase 2.4 - Template conversion
Input: Template/component node ID
Output: HTML/CSS structure

Known issue: Fails if Figma annotations present
Workaround: Fallback to get_image analysis
```

**Error Recovery Pattern:**
```
Try:
  result = get_code(node_id)
Catch error:
  Log: "get_code failed for {node_id}, using visual analysis"
  image = get_image(node_id)
  Analyze image → generate blocks
Continue: (don't stop execution)
```

### Tool: get_code_connect_map

**Purpose:** Link Figma components to existing code components

**Usage:**
```
When: Phase 1.5 - If theme has existing component library
Input: Figma file key
Output: Mapping of Figma nodes to code paths
```

Optional - only if integrating with existing theme.

## Error Recovery (Autonomous)

**Pattern:** Log errors, try alternatives, NEVER stop to ask user.

### Error: Figma MCP Unreachable

```
If: Connection to Figma MCP fails
Then:
  - Try both desktop (port 3845) and remote (mcp.figma.com)
  - Log error to .claude/reports/errors.log
  - If both fail: STOP and inform user (blocker)
```

### Error: get_code Fails (Annotations)

```
If: get_code returns error
Then:
  - Log: "Annotations detected, using image analysis"
  - Fallback: get_image + visual interpretation
  - Continue: Generate template from visual analysis
```

### Error: Design Token Missing

```
If: Template needs token not in theme.json
Then:
  - Add missing token to theme.json
  - Use sensible default value
  - Log: "Added missing token: {name}"
  - Continue: Template generation
```

### Error: Block Mapping Unclear

```
If: Figma component doesn't map cleanly to WordPress block
Then:
  - Use simpler block structure (Group + Paragraph/Heading)
  - Log: "Complex component simplified: {name}"
  - Continue: Template generation
```

### Error: Validation Failure

```
If: Security/coding standards check fails
Then:
  - Log failures to report
  - Continue with remaining templates
  - Report issues at end (don't stop mid-execution)
```

**Only stop execution if:**
- Figma MCP completely unreachable (both servers)
- WordPress theme directory structure missing
- User manually interrupts

## Context Management (Phase 2: Multi-Template Support)

**Problem:** 6-15 templates can exhaust context window (200K tokens)

**Solution:** Episodic memory checkpointing every 3 templates

### Checkpoint Trigger Conditions

Trigger checkpoint when:
1. **Template count divisible by 3** (templates_completed % 3 == 0)
2. **Context approaching 80% limit** (~160K tokens used)
3. **Before switching to complex templates** (e.g., before archive.php with loops)

### Checkpoint Procedure

**Step 1: Prepare Checkpoint Data**

Create checkpoint object with all critical state:
```json
{
  "checkpoint_id": "figma-fse-{theme-name}-{timestamp}",
  "theme_name": "{theme-name}",
  "total_templates": 12,
  "templates_completed": [
    {"name": "header.html", "status": "complete", "blocks": 8, "issues": []},
    {"name": "footer.html", "status": "complete", "blocks": 5, "issues": []},
    {"name": "index.html", "status": "complete", "blocks": 12, "issues": []}
  ],
  "templates_remaining": [
    {"name": "front-page.html", "priority": 3, "figma_node_id": "123:456"},
    {"name": "page.html", "priority": 3, "figma_node_id": "123:457"},
    {"name": "single.html", "priority": 3, "figma_node_id": "123:458"},
    // ... remaining templates
  ],
  "design_system": {
    "colors": ["primary", "secondary", "white", "black", "..."],
    "font_sizes": ["small", "base", "medium", "large", "xl"],
    "spacing": ["20", "30", "40", "50", "60", "70", "80", "90"],
    "theme_json_path": "themes/{theme-name}/theme.json"
  },
  "component_patterns": {
    "hero_sections": "Cover block with columns",
    "card_grids": "Columns with Group blocks",
    "testimonials": "Quote block in Group"
  },
  "errors_encountered": [
    {"template": "index.html", "error": "get_code failed", "resolution": "used get_image fallback"}
  ],
  "figma_file": {
    "url": "{figma-url}",
    "design_system_location": "Design System page"
  }
}
```

**Step 2: Save to Episodic Memory**

```bash
# Use episodic-memory plugin to save checkpoint
/episodic-memory:save "Figma-to-FSE checkpoint: {theme-name}, completed {X} of {N} templates"

# Include full checkpoint data in the save
```

**Step 3: Log Checkpoint**

```bash
echo "📌 CHECKPOINT: Template {X} of {N} complete" >> .claude/logs/figma-fse-checkpoints.log
echo "State saved to episodic memory: checkpoint_id={checkpoint_id}" >> .claude/logs/figma-fse-checkpoints.log
```

**Step 4: Continue Immediately**

- Do NOT wait for user confirmation
- Do NOT pause execution
- Checkpoint is non-blocking
- Move immediately to next template

### Resumption Procedure (If Session Interrupted)

**If conversion interrupted and user returns:**

**Step 1: Detect Incomplete Conversion**

```
User: "Continue converting my Figma templates"

Claude: Uses episodic-memory:search to find recent checkpoint
Search query: "Figma-to-FSE checkpoint {theme-name}"
```

**Step 2: Load Checkpoint State**

```bash
# Retrieve checkpoint from episodic memory
checkpoint = /episodic-memory:search "Figma-to-FSE checkpoint {theme-name}"

# Extract state
templates_completed = checkpoint.templates_completed
templates_remaining = checkpoint.templates_remaining
design_system = checkpoint.design_system
```

**Step 3: Resume from Checkpoint**

```
Claude: "I found a checkpoint from [timestamp]:
         - Completed: {X} templates (header, footer, index, ...)
         - Remaining: {Y} templates (front-page, page, single, ...)

         Resuming autonomous conversion from template {X+1}..."

[Continue with Step 2.4 loop from checkpoint.templates_remaining[0]]
```

**Step 4: NO Re-Discovery**

- Do NOT re-extract design system (use checkpoint.design_system)
- Do NOT re-survey templates (use checkpoint.templates_remaining)
- Do NOT ask for plan approval again
- Jump directly to Step 2.4 autonomous loop

### Context Window Management

**Monitor context usage:**
```
After each template:
  estimated_tokens = (templates_completed * avg_tokens_per_template)
  if estimated_tokens > 160000:  # 80% of 200K limit
    Trigger checkpoint
    Consider: Summarize previous templates to save context
```

**Context-saving strategies:**
1. Checkpoint every 3 templates (before hitting limit)
2. Summarize completed templates (keep only: name, status, issues)
3. Clear verbose Figma MCP responses from context
4. Keep only essential design token mappings in working memory

### Error Recovery with Checkpoints

**If error occurs during template processing:**
1. Log error to checkpoint.errors_encountered[]
2. Save checkpoint immediately (preserve state before potential failure)
3. Attempt error recovery (get_code → get_image fallback)
4. Continue with next template
5. Final report will include all errors from checkpoint

**Benefits:**
- No lost work if session crashes
- Can pause and resume multi-hour conversions
- Errors logged and tracked across checkpoints
- User can interrupt without losing progress

## Quality Gates

**Checks the agent runs during/after conversion** (invoked manually — these scripts exist but are NOT auto-registered in `.claude/settings.json`):

### Post-Template Script
File: `.claude/hooks/figma-fse-post-template.sh`

The agent runs this after each template creation (if present):
- Validate block syntax
- Check for hardcoded hex colors
- Verify theme.json token references
- Scan for security issues

### Completion Script
File: `.claude/hooks/figma-fse-completion.sh`

The agent runs this when all templates complete (if present):
- Generate comparison report
- Run full security scan
- Check coding standards
- Validate accessibility
- Create screenshots

## Component Mapping Reference

### Core WordPress Blocks

**Layout Blocks:**
- `<!-- wp:group -->` - Container for grouped content
- `<!-- wp:columns -->` - Multi-column layouts
- `<!-- wp:column -->` - Single column within columns
- `<!-- wp:spacer -->` - Vertical spacing
- `<!-- wp:separator -->` - Horizontal rule

**Content Blocks:**
- `<!-- wp:heading -->` - Headings (h1-h6)
- `<!-- wp:paragraph -->` - Body text
- `<!-- wp:image -->` - Images
- `<!-- wp:gallery -->` - Image galleries
- `<!-- wp:quote -->` - Blockquotes
- `<!-- wp:list -->` - Ordered/unordered lists

**Interactive Blocks:**
- `<!-- wp:button -->` - Buttons
- `<!-- wp:buttons -->` - Button groups
- `<!-- wp:navigation -->` - Menus
- `<!-- wp:search -->` - Search form

**Media Blocks:**
- `<!-- wp:cover -->` - Background images with overlay
- `<!-- wp:video -->` - Video embeds
- `<!-- wp:audio -->` - Audio players

### Block Attributes (theme.json tokens)

```html
<!-- wp:group {
  "backgroundColor": "primary",
  "textColor": "white",
  "style": {
    "spacing": {
      "padding": {
        "top": "var(--wp--preset--spacing--50)",
        "bottom": "var(--wp--preset--spacing--50)"
      }
    }
  }
} -->
```

**Use tokens, not values:**
- ✅ `"backgroundColor": "primary"` (slug from theme.json)
- ❌ `"backgroundColor": "#0066CC"` (hardcoded hex)
- ✅ `"padding": "var(--wp--preset--spacing--50)"` (token)
- ❌ `"padding": "32px"` (hardcoded size)

## No-Exceptions List

**NEVER do these (zero tolerance):**

0. ❌ **Skip asset identification (Step 2.3.5)**
   - NEVER let subagents guess image content from hash filenames
   - ALWAYS view every downloaded image BEFORE template generation
   - ALWAYS create semantic mapping and provide it to all subagents
   - Hash filenames like `1dc507e8...png` reveal NOTHING about content

0.5. ❌ **Skip visual verification (Step 2.7)**
   - NEVER declare theme complete based on code review alone
   - ALWAYS render pages in a real browser and compare to Figma
   - ALWAYS fix image mismatches (wrong image = always wrong)
   - ALWAYS fix broken layouts visible in screenshots
   - Code that "looks correct" is NOT the same as a site that looks correct

1. ❌ **Skip design system extraction**
   - ALWAYS extract complete design system FIRST
   - NEVER proceed to templates without theme.json foundation

2. ❌ **Hardcode design values**
   - NO hex colors in templates (#0066CC)
   - NO pixel sizes (32px) - use tokens
   - NO font names - use theme.json fontFamily slugs

3. ❌ **Ask "should I continue?" during autonomous phase**
   - Once Phase 2 starts, work until complete
   - Log errors, don't stop execution
   - Only stop if completely blocked

4. ❌ **Selectively extract design tokens**
   - Extract ALL colors (not just primary/secondary)
   - Extract ALL typography styles (entire scale)
   - Extract ALL spacing tokens (complete scale)

5. ❌ **Skip error recovery**
   - If get_code fails → use get_image
   - If token missing → add to theme.json
   - If component unclear → use simpler blocks
   - Continue despite errors

6. ❌ **Generate invalid block syntax**
   - ALWAYS use HTML comment format
   - ALWAYS close blocks properly
   - ALWAYS validate attribute JSON

7. ❌ **Skip accessibility**
   - ALWAYS add ARIA labels where needed
   - ALWAYS include alt text for images
   - ALWAYS use semantic HTML structure

8. ❌ **Ignore responsive design**
   - ALWAYS test mental model: mobile → tablet → desktop
   - ALWAYS use theme.json breakpoints
   - ALWAYS apply appropriate block alignments

## Common Mistakes & Rationalization Detection

### Mistake 1: "I'll just extract the main colors"

**Rationalization:**
- "We only need primary and secondary colors"
- "The other colors aren't used much"
- "I'll add more later if needed"

**Reality:**
- Incomplete extraction causes hardcoded values later
- Templates will mix tokens and hardcoded values
- Maintenance nightmare

**Correct:** Extract ENTIRE design system wholesale, every single token.

### Mistake 2: "Let me check with the user before proceeding"

**Rationalization:**
- "This seems like a lot of work"
- "Should I really convert all 12 templates?"
- "Maybe the user wants to review each one"

**Reality:**
- Phase 1 got user approval
- Asking mid-execution defeats autonomous purpose
- User explicitly wanted zero interruptions

**Correct:** Continue autonomously through ALL templates without prompting.

### Mistake 3: "This color looks close enough"

**Rationalization:**
- "The Figma color is #0066CC but theme.json primary is #0066DD"
- "It's only a 1% difference, no one will notice"
- "I'll just use the hardcoded value this once"

**Reality:**
- Design system integrity matters
- Hardcoded values create maintenance debt
- Defeats purpose of design token system

**Correct:** Use theme.json token exclusively OR add exact color to theme.json.

### Mistake 4: "get_code failed, I'll ask the user"

**Rationalization:**
- "The Figma file has annotations"
- "I can't proceed without structure data"
- "Better to stop than guess"

**Reality:**
- Error recovery pattern exists
- get_image fallback is designed for this
- Stopping defeats autonomous workflow

**Correct:** Log error, use get_image analysis, continue.

### Mistake 5: "This component is too complex for FSE"

**Rationalization:**
- "This needs custom JavaScript"
- "FSE blocks can't do this"
- "I should flag this as impossible"

**Reality:**
- Most designs can be approximated with FSE blocks
- Simplification is acceptable
- User can enhance later with custom blocks

**Correct:** Use simpler block structure, log note, continue.

## Integration with Existing Skills

**Delegates to:**
- `fse-block-theme-development` - For theme.json and template syntax
- `block-pattern-creation` - For pattern registration
- `wordpress-security-hardening` - For security validation
- `superpowers:executing-plans` - For autonomous execution

**Triggered by:**
- User requests to convert Figma designs
- Need for autonomous FSE theme generation

**Do NOT duplicate:**
- theme.json syntax (use fse-block-theme-development)
- Pattern registration logic (use block-pattern-creation)
- Security practices (use wordpress-security-hardening)

## Success Criteria

**Phase 1 Complete When:**
- ✅ Design system extracted wholesale (ALL tokens)
- ✅ theme.json foundation created
- ✅ All templates identified and surveyed
- ✅ Component mapping plan created
- ✅ Implementation plan approved by user

**Phase 2 Complete When:**
- ✅ All templates converted (N of N)
- ✅ Zero hardcoded values (100% tokens)
- ✅ Quality checks run (logged results)
- ✅ Comparison report generated
- ✅ No "should I continue?" prompts issued

**Phase 3 Complete When:**
- ✅ User presented with complete theme
- ✅ Next steps provided
- ✅ Report accessible
- ✅ Theme ready for WordPress installation

## Example Usage

```
User: "Turn all Figma designs into FSE templates"
      [provides Figma URL]

Claude: "I'm using the figma-to-fse-autonomous-workflow skill."

        Phase 1: Discovery

        "First, where is your design system in the Figma file?
        (Common locations: 'Design System' page, 'Styles' page)"

User: "It's on the 'Design System' page"

Claude: [Extracts complete design system with get_variable_defs]
        [Translates to theme.json]
        [Surveys templates with get_image]
        [Creates component mapping]
        [Generates implementation plan]

        "✅ Design system extracted:
        - 12 colors
        - 8 font sizes
        - 9 spacing tokens

        Found 8 templates to convert:
        - Homepage
        - About
        - Services
        - Contact
        - Blog
        - Single Post
        - Archive
        - 404

        I'll create a complete FSE theme with pixel-perfect
        templates using theme.json tokens exclusively.

        Proceed with autonomous conversion?"

User: "Yes"

Claude: [Invokes superpowers:executing-plans]
        [45 minutes of uninterrupted work]

        "✅ Conversion complete!

        Your FSE theme is ready at: themes/my-theme/

        - 8 templates created
        - 0 hardcoded values (100% theme.json tokens)
        - Fully responsive
        - Accessibility included
        - Quality checks passed

        See: .claude/reports/figma-fse-comparison.md"
```

## Next Steps After Conversion

**For User:**
1. Install WordPress locally (if not already)
2. Activate theme in WordPress admin
3. Test templates with real content
4. Adjust colors/spacing in theme.json (not templates)
5. Add custom functionality in functions.php (if needed)

**For Claude:**
1. If user requests changes: Update theme.json (design tokens)
2. If templates need fixes: Regenerate using updated tokens
3. If new templates needed: Follow same workflow
4. If patterns needed: Use block-pattern-creation skill

---

**Status:** Phase 3 implementation complete (attribute-level validation, token matching, comparison reporting)
**Version:** 3.0.0
**Last Updated:** 2026-01-21
**Supports:** 1-15 templates with autonomous checkpointing every 3 templates + attribute validation
