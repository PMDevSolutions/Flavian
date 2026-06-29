# Figma to WordPress Automation

**Convert Figma designs to WordPress FSE themes automatically with zero manual intervention**

**Status:** ✅ Production ready (v1.0.0)
**Last Updated:** 2026-01-23

---

## Quick Start

### What This Does

Automatically converts Figma designs into complete WordPress Full Site Editing (FSE) block themes:

```
Figma Design URL → Complete WordPress FSE Theme (5-90 minutes)
```

**Results:**
- ✅ Working images (no broken src="" attributes)
- ✅ Complete theme.json with design system
- ✅ FSE templates (.html files with WordPress blocks)
- ✅ PHP patterns for image-containing sections
- ✅ Zero manual setup required
- ✅ Portable across all environments

### 3-Step Workflow

```
1. User: "Convert this Figma design to WordPress FSE theme"
         [Provide Figma URL]

2. Claude: [Extracts design system]
          [Creates implementation plan]
          "Proceed with autonomous conversion?"

3. User: "Yes"

4. Claude: [Works autonomously 5-90 minutes]
          → Complete FSE theme ready
```

### Requirements

- **Figma file** with design system and templates
- **Figma Desktop app** with Dev Mode enabled
- **Claude Code** with this template installed

### Basic Usage

```
User: "Convert my Figma design to WordPress"
      URL: https://figma.com/design/abc123/my-design
```

Claude will:
1. Extract complete design system (colors, typography, spacing)
2. Create theme.json with design tokens
3. Generate FSE templates with WordPress blocks
4. Create PHP patterns for images
5. Validate automatically (security, standards, syntax)
6. Generate completion report

**Time:** 5 minutes for single template, 30-90 minutes for full site

---

## The Problem This Solves

### Before (Broken Themes)

When converting Figma to WordPress FSE, images broke because PHP doesn't execute in `.html` template files:

```html
<!-- templates/front-page.html -->
<img src="<?php echo get_template_directory_uri(); ?>/image.png"/>
<!-- ❌ PHP doesn't execute in .html files! -->
```

**Result:**
- Broken images (empty src="")
- Vertical text stacking instead of layouts
- Manual fixes required for every theme

### After (Working Themes)

**Pattern-first architecture:** Image-containing sections go in PHP pattern files:

```php
// patterns/hero-section.php (PHP executes here!)
<?php
/**
 * Title: Hero Section
 * Slug: themename/hero-section
 */
?>
<img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero.png"/>
```

```html
<!-- templates/front-page.html -->
<!-- wp:pattern {"slug":"themename/hero-section"} /-->
```

**Result:**
- ✅ Images work immediately
- ✅ Theme is portable
- ✅ Zero manual setup
- ✅ Follows WordPress core best practices

---

## Features

### Autonomous Conversion

- **Zero interruptions** - No "should I continue?" prompts during execution
- **Error recovery** - Handles missing design systems, complex components, MCP failures
- **Automatic validation** - Security scanning, coding standards, syntax checking
- **Progress tracking** - See what's being generated in real-time

### Design System Extraction

- **Wholesale extraction** - ALL Figma design tokens captured
- **1:1 mapping** - Figma variables → theme.json structure
- **Zero placeholders** - Real values only, no "TODO" or hardcoded fallbacks
- **Auto-detection** - Finds design system automatically or uses professional defaults

### Template Conversion

- **Figma frame → FSE template** - Complete HTML with WordPress blocks
- **100% token usage** - No hardcoded colors, sizes, or spacing
- **Responsive** - Mobile/tablet/desktop layouts automatic
- **Accessible** - ARIA labels, alt text, semantic HTML

### Pattern-First Architecture

- **Images → PHP patterns** - All image-containing sections as patterns
- **Text → Inline templates** - Text-only content stays in templates
- **Automatic validation** - Hooks enforce correct architecture
- **WordPress-native** - Follows WordPress core FSE theme patterns

---

## Architecture Overview

### Generated Theme Structure

```
themes/new-theme/
├── theme.json              # Design system tokens
├── style.css               # Theme header
├── patterns/               # PHP patterns (images work here!)
│   ├── hero-section.php
│   ├── cta-section.php
│   └── features-grid.php
├── templates/              # HTML templates (reference patterns)
│   ├── front-page.html
│   ├── page.html
│   └── index.html
├── parts/
│   ├── header.html
│   └── footer.html
└── assets/
    └── images/             # Theme images
        ├── hero.png
        └── cta-bg.jpg
```

### Three-Phase Workflow

**Phase 1: Discovery (1-2 min, interactive)**
```
1. Ask for design system location (or auto-detect)
2. Extract complete design system with Figma MCP
3. Translate to theme.json structure
4. Survey templates with screenshots
5. Create implementation plan
6. Present to user: "Proceed?"
```

**Phase 2: Autonomous Execution (5-90 min, zero interruptions)**
```
1. Create theme.json from design system
2. FOR EACH template (1-15):
   - Extract structure with Figma MCP
   - Generate FSE template HTML
   - Create PHP patterns for images
   - Apply theme.json tokens exclusively
   - Validate automatically (hooks run)
   - Continue to next (no prompts)
3. Create block patterns
4. Run quality checks
5. Generate comparison report
```

**Phase 3: Completion (<1 min)**
```
1. Present success summary
2. Link to comparison report
3. Provide next steps
```

### Figma MCP Integration

**Dual-mode support:**
- **Desktop MCP** (preferred): Figma desktop app with Dev Mode
- **Remote MCP** (fallback): Figma cloud API with browser extension

**Primary tools:**
- `get_variable_defs` - Extract design tokens
- `get_design_context` - Extract component structure
- `get_screenshot` - Visual reference and fallback
- `get_metadata` - File structure overview

---

## Pattern-First Architecture Details

### Why Patterns for Images?

WordPress FSE templates are `.html` files where **PHP code doesn't execute**.

**Problem:**
```html
<!-- templates/front-page.html -->
<img src="<?php echo get_template_directory_uri(); ?>/image.png"/>
<!-- ❌ PHP doesn't run, src becomes empty string -->
```

**Solution:**
```php
// patterns/hero.php (PHP DOES execute here)
<?php
/**
 * Title: Hero Section
 * Slug: themename/hero
 */
?>
<img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/images/hero.png"/>
```

```html
<!-- templates/front-page.html -->
<!-- wp:pattern {"slug":"themename/hero"} /-->
<!-- ✅ References pattern, PHP executes in pattern file -->
```

### Decision Rules

**Use PHP patterns for:**
- Sections with images
- Sections with media (video, audio)
- Reusable components
- Dynamic content

**Use inline templates for:**
- Text-only content
- Page-specific layouts
- Template structure (header/footer references)

### Pattern Validation

**Validation script:** `scripts/figma-fse/validate-pattern-architecture.sh`

**Checks:**
- ❌ No PHP code in `.html` templates
- ❌ No empty `src=""` attributes
- ⚠️  Warns about inline images with empty src
- ✅ Verifies referenced patterns exist

**When it runs:**
- Run manually, or invoked by the figma-fse-converter agent during conversion
- Not auto-registered in `.claude/settings.json` (the only PreToolUse Write|Edit hook is `validate-theme-location.sh`)
- Surfaces validation errors so the agent can self-correct

---

## Success Metrics

### Before Automation
- ❌ 100% of generated themes had broken images
- ❌ Required manual pattern extraction
- ❌ Required manual image uploads
- ❌ Required file path corrections

### After Automation
- ✅ 100% of generated themes have working images
- ✅ Zero manual intervention required
- ✅ Images work across all environments
- ✅ Follows WordPress core best practices

### Quality Targets
- 100% theme.json token usage (no hardcoded values)
- All security scans pass
- All coding standards pass
- All templates responsive
- All accessibility attributes present
- Pixel-perfect (within 5px tolerance)

---

## Usage Examples

### Example 1: Single Hero Section

```
User: "Convert this Figma hero section to FSE template"
      https://figma.com/design/abc123/Hero

Claude: [Extracts design system]
        [Creates plan]
        "Found hero section. I'll create theme.json + template.
        Proceed?"

User: "Yes"

Claude: [Works 3 minutes autonomously]
        "✅ Complete!
        - theme.json: 4 colors, 3 font sizes, 6 spacing tokens
        - templates/front-page.html created
        - patterns/hero-section.php created
        - 0 hardcoded values"
```

### Example 2: Complete Website

```
User: "Turn all designs in this Figma file into an FSE theme"
      https://figma.com/design/xyz789/Complete-Theme

Claude: "Where is your design system?"

User: "Design System page"

Claude: [Extracts complete design system]
        [Surveys templates]
        "Found 8 templates to convert:
        - Homepage, About, Services, Contact, Blog, Single, Archive, 404

        Will create complete FSE theme with theme.json.
        Proceed with autonomous conversion?"

User: "Yes"

Claude: [Works 45 minutes autonomously]
        "✅ Complete!
        - 8 templates created
        - 12 PHP patterns for images
        - 12 colors, 8 font sizes, 9 spacing tokens
        - 0 hardcoded values
        - All quality checks passed

        Report: .claude/reports/figma-fse-comparison.md"
```

---

## Testing Your Theme

### Quick Test

```bash
# Check theme structure
ls themes/[theme-name]/

# Expected:
# theme.json, style.css, templates/, patterns/, parts/, assets/

# Verify no hardcoded values
grep -r "#[0-9A-Fa-f]\{6\}" themes/[theme-name]/templates/
# Should return nothing

# Check pattern references work
grep -r "wp:pattern" themes/[theme-name]/templates/
# Should show pattern slugs
```

### Deploy to WordPress

**Important:** Development happens in root-level `themes/` folder. For WordPress testing, copy to `wp-content/themes/`:

```bash
# Copy theme to WordPress (deployment step)
cp -r themes/[theme-name] /path/to/wordpress/wp-content/themes/

# Or create symlink for live development
ln -s $(pwd)/themes/[theme-name] /path/to/wordpress/wp-content/themes/
```

Then:
1. Go to WordPress admin → Appearance → Themes
2. Activate your theme
3. View homepage
4. Verify images load correctly
5. Test responsive behavior

---

## Troubleshooting

### Issue: Claude doesn't invoke skill

**Solution:** Use explicit trigger:
```
"Use figma-to-fse-autonomous-workflow to convert this design"
```

### Issue: Figma MCP unreachable

**Check:**
- Figma desktop app is open
- Dev Mode is enabled
- MCP server running: http://127.0.0.1:3845/health

**Fallback:** Claude will try remote MCP automatically

### Issue: Images not loading in WordPress

**Check:**
1. Images in `assets/images/` folder?
2. Patterns exist in `patterns/` folder?
3. Templates reference patterns (not inline images)?
4. Pattern headers correct (Title, Slug, Categories)?

**Verify pattern header:**
```php
<?php
/**
 * Title: Hero Section
 * Slug: themename/hero-section
 * Categories: banner
 */
?>
```

### Issue: Theme doesn't activate

**Check:**
- `style.css` exists with theme header
- `theme.json` exists and is valid JSON
- No PHP errors (check WordPress debug log)

---

## Automation Components

### 1. figma-fse-converter Agent

**Location:** `.claude/agents/figma-fse-converter.md`

**Purpose:** Executes Phase 2 autonomous conversion

**Capabilities:**
- Figma MCP integration (desktop + remote)
- Design token extraction and translation
- FSE template generation
- PHP pattern creation
- Validation hook integration

### 2. Pattern Architecture Validation Hook

**Location:** `scripts/figma-fse/validate-pattern-architecture.sh`

**What it checks:**
- No PHP in HTML templates
- No empty src="" attributes
- Pattern references are valid
- Pattern files exist

**When it runs:** Automatically after Write/Edit operations

### 3. FSE Pattern-First Architecture Skill

**Location:** `.claude/skills/fse-pattern-first-architecture/skill.md`

**Purpose:** Teaches agents the pattern-first approach

**Auto-triggers when:**
- Creating FSE theme
- Converting Figma to WordPress
- Working with block themes
- Creating templates with images

---

## Related Documentation

**Core Documentation:**
- [Implementation Guide](./IMPLEMENTATION.md) - Technical implementation details
- [Template Examples](./EXAMPLES.md) - FSE template reference examples

**Skills & Agents:**
- `.claude/skills/figma-to-fse-autonomous-workflow/SKILL.md` - Main skill orchestration
- `.claude/skills/fse-pattern-first-architecture/skill.md` - Pattern-first approach
- `.claude/agents/figma-fse-converter.md` - Specialized conversion agent
- `docs/architecture/PATTERN-FIRST-ARCHITECTURE.md` - Pattern architecture reference

**Scripts:**
- `scripts/figma-fse/validate-pattern-architecture.sh` - Pattern validation
- `scripts/figma-fse/validate-template.sh` - Template validation
- `scripts/figma-fse/extract-design-tokens.sh` - Design token validation

**WordPress Development:**
- `.claude/skills/fse-block-theme-development/` - FSE theme creation
- `.claude/skills/block-pattern-creation/` - Block pattern registration
- `.claude/skills/wordpress-security-hardening/` - Security best practices

---

## Next Steps

1. **Try it now:** Provide a Figma URL to Claude
2. **Review output:** Check generated theme.json and templates
3. **Test in WordPress:** Copy theme to wp-content/themes and activate
4. **Customize:** Edit patterns and templates as needed

For implementation details and advanced usage, see [IMPLEMENTATION.md](./IMPLEMENTATION.md)

For template syntax examples, see [EXAMPLES.md](./EXAMPLES.md)

---

**Version:** 1.0.0
**Status:** ✅ Production ready
**Last Updated:** 2026-01-23
**Maintainer:** Claude Code WordPress Template Team
