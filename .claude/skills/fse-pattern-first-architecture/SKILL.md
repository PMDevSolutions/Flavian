---
name: fse-pattern-first-architecture
description: Enforces pattern-first architecture for WordPress FSE themes - use PHP patterns for images, not inline HTML. Auto-triggered when creating FSE templates with images.
---

# FSE Pattern-First Architecture

**Trigger Keywords:** "create FSE theme", "Figma to WordPress", "block theme", "FSE template", "WordPress template with images"

**Auto-trigger:** When agent creates `.html` template files with `wp:image` or `wp:cover` blocks

---

## The Iron Law

```
NO PHP CODE IN .html TEMPLATE FILES
NO EMPTY IMAGE src ATTRIBUTES
IMAGES → PHP PATTERNS (.php files in patterns/)
TEMPLATES → PATTERN REFERENCES
```

PHP code does NOT execute in WordPress .html templates. Empty image sources break completely.

---

## Pattern-First Architecture

### Structure

```
themes/mytheme/
├── patterns/                    ← PHP files (code executes)
│   ├── hero-section.php        ← Full hero with images
│   ├── cta-with-image.php      ← CTA section
│   └── features-grid.php       ← Grid with icons/images
├── templates/                   ← HTML files (static markup)
│   ├── front-page.html         ← References patterns
│   ├── page.html               ← References patterns
│   └── index.html              ← References patterns
└── assets/
    └── images/                  ← Theme images
        ├── hero.png
        └── cta-bg.jpg
```

### Decision Tree

```
Does section contain images/icons/media?
  YES → Create PHP pattern file
  NO  → Inline in template HTML

Is section reusable across pages?
  YES → Create PHP pattern file
  NO  → Inline in template HTML (unless has images)

Does section need dynamic paths?
  YES → Create PHP pattern file
  NO  → Inline in template HTML
```

---

## Pattern File Template

```php
<?php
/**
 * Title: Hero Section
 * Slug: themename/hero-section
 * Categories: banner, featured
 * Description: Homepage hero with heading, text, button, and background image
 *
 * @package ThemeName
 */

?>
<!-- wp:cover {"url":"","dimRatio":0,"overlayColor":"white","minHeight":800,"minHeightUnit":"px"} -->
<div class="wp-block-cover" style="min-height:800px">
    <span aria-hidden="true" class="wp-block-cover__background has-white-background-color"></span>
    <img class="wp-block-cover__image-background" alt="Hero Background" src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero-bg.jpg" data-object-fit="cover"/>

    <div class="wp-block-cover__inner-container">
        <!-- wp:columns {"verticalAlignment":"center"} -->
        <div class="wp-block-columns are-vertically-aligned-center">
            <!-- wp:column {"verticalAlignment":"center","width":"50%"} -->
            <div class="wp-block-column is-vertically-aligned-center" style="flex-basis:50%">
                <!-- wp:heading {"level":1,"fontSize":"5-x-large"} -->
                <h1 class="wp-block-heading has-5-x-large-font-size">Your Compelling Headline</h1>
                <!-- /wp:heading -->

                <!-- wp:paragraph {"fontSize":"medium"} -->
                <p class="has-medium-font-size">Description text goes here</p>
                <!-- /wp:paragraph -->

                <!-- wp:buttons -->
                <div class="wp-block-buttons">
                    <!-- wp:button {"backgroundColor":"primary"} -->
                    <div class="wp-block-button">
                        <a class="wp-block-button__link has-primary-background-color" href="#cta">Get Started</a>
                    </div>
                    <!-- /wp:button -->
                </div>
                <!-- /wp:buttons -->
            </div>
            <!-- /wp:column -->

            <!-- wp:column {"verticalAlignment":"center","width":"50%"} -->
            <div class="wp-block-column is-vertically-aligned-center" style="flex-basis:50%">
                <!-- wp:image {"aspectRatio":"1","scale":"cover","sizeSlug":"large"} -->
                <figure class="wp-block-image size-large">
                    <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero-image.png" alt="Hero Image" style="aspect-ratio:1;object-fit:cover"/>
                </figure>
                <!-- /wp:image -->
            </div>
            <!-- /wp:column -->
        </div>
        <!-- /wp:columns -->
    </div>
</div>
<!-- /wp:cover -->
```

---

## Template Reference Pattern

```html
<!-- templates/front-page.html -->

<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"tagName":"main","layout":{"type":"default"}} -->
<main class="wp-block-group">

    <!-- Hero Section -->
    <!-- wp:pattern {"slug":"themename/hero-section"} /-->

    <!-- Text-only section (inline is fine) -->
    <!-- wp:group {"backgroundColor":"white"} -->
    <div class="wp-block-group has-white-background-color">
        <!-- wp:heading {"textAlign":"center"} -->
        <h2 class="wp-block-heading has-text-align-center">About Us</h2>
        <!-- /wp:heading -->

        <!-- wp:paragraph {"align":"center"} -->
        <p class="has-text-align-center">We are a company that does things.</p>
        <!-- /wp:paragraph -->
    </div>
    <!-- /wp:group -->

    <!-- CTA with image (use pattern) -->
    <!-- wp:pattern {"slug":"themename/cta-section"} /-->

</main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

---

## Implementation Checklist

When creating an FSE theme with images:

### Phase 1: Analyze Figma Design

- [ ] Identify all sections with images/media
- [ ] List reusable components
- [ ] Note which sections are text-only

### Phase 2: Create Pattern Files

For each image-containing section:

- [ ] Create `patterns/[section-name].php`
- [ ] Add PHP header comment block
- [ ] Generate WordPress block markup
- [ ] Use `get_template_directory_uri()` for image paths
- [ ] Save images to `assets/images/`
- [ ] Set proper alt text for accessibility

### Phase 3: Create Template Files

For each Figma screen/page:

- [ ] Create `templates/[template-name].html`
- [ ] Reference patterns with `<!-- wp:pattern {"slug":"..."} /-->`
- [ ] Inline text-only sections
- [ ] Ensure NO PHP code in .html files
- [ ] Ensure NO empty image src attributes

### Phase 4: Validation

- [ ] Run: `scripts/figma-fse/validate-pattern-architecture.sh`
- [ ] Check: No PHP in templates/*.html
- [ ] Check: All patterns/*.php files exist
- [ ] Check: Images exist in assets/images/
- [ ] Test: WordPress loads theme without errors

---

## Common Patterns

### Hero Pattern
- Full-width cover block
- Background image with overlay
- Content: heading + text + buttons
- Optional: Second column with image

### CTA Pattern
- Two-column layout
- Content column: heading + text + button
- Image column: relevant visual
- Background color from theme.json

### Features Grid Pattern
- Three-column layout
- Each column: icon/image + heading + text
- Repeatable pattern structure

### Testimonial Pattern
- Quote block
- Avatar image
- Name + title
- Background styling

---

## Benefits

1. **✅ Zero Manual Setup** - Images work immediately
2. **✅ Portable** - Works on any domain (localhost → production)
3. **✅ WordPress Native** - Follows core theme patterns
4. **✅ Reusable** - Insert patterns anywhere
5. **✅ Template Generator Ready** - Automated conversion works

---

## Red Flags - STOP

If you catch yourself:
- "Put PHP in the template file"
- "Leave src empty for now"
- "Hardcode localhost URL"
- "We'll upload images later"
- "Inline everything in the template"

**STOP. You're violating pattern-first architecture.**

---

## Related Skills

- `fse-block-theme-development` - theme.json and FSE basics
- `block-pattern-creation` - Pattern registration details
- `wordpress-security-hardening` - Escaping output in patterns

---

## Validation Script

This skill is enforced by:
```bash
scripts/figma-fse/validate-pattern-architecture.sh
```

Run manually, or invoked by the `figma-fse-converter` agent during conversion. It is not registered as an automatic PostToolUse hook in `.claude/settings.json`.

---

**Last Updated:** 2026-01-23
**Status:** ✅ Production Ready
**Enforcement:** Manual / agent-run via `validate-pattern-architecture.sh`
