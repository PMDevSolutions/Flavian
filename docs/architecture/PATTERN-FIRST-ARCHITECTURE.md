# Pattern-First FSE Architecture (UPDATE FOR figma-fse-converter)

## CRITICAL: This should be added to figma-fse-converter agent at line 377 (after Component Mapping Strategy)

---

### 6.5 Pattern-First Image Architecture (REQUIRED)

**CRITICAL: WordPress FSE templates (.html files) do NOT execute PHP code.**

**The Problem:**
- Templates with inline `<img>` tags need dynamic image URLs
- PHP code like `<?php echo esc_url(get_template_directory_uri()); ?>` does NOT work in .html templates
- Empty `src=""` attributes break images completely

**The Solution: PHP Patterns + Template References**

**Architecture:**
```
themes/[theme-name]/
├── patterns/                    ← PHP files (code executes here)
│   ├── hero-section.php        ← Full section with images
│   ├── cta-section.php         ← Another section with images
│   └── features-grid.php       ← Grid with images
└── templates/                   ← HTML files (static markup only)
    ├── front-page.html         ← References patterns
    └── page.html               ← References patterns
```

**Implementation Rules:**

1. **Identify Image-Containing Sections:**
   - During template generation, detect sections with `wp:image` or `wp:cover` blocks
   - Any section with images becomes a PATTERN, not inline template code

2. **Create PHP Pattern Files:**
   ```php
   <?php
   /**
    * Title: Hero Section
    * Slug: themename/hero-section
    * Categories: banner
    * Description: Hero with heading, text, CTA, and image
    */
   ?>
   <!-- wp:cover {"url":"","dimRatio":0...} -->
   ...
     <!-- wp:image {"id":0} -->
     <figure class="wp-block-image">
       <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero.png" alt="..."/>
     </figure>
     <!-- /wp:image -->
   ...
   <!-- /wp:cover -->
   ```

3. **Templates Reference Patterns:**
   ```html
   <!-- templates/front-page.html -->
   <!-- wp:template-part {"slug":"header"} /-->

   <!-- Hero Section -->
   <!-- wp:pattern {"slug":"themename/hero-section"} /-->

   <!-- CTA Section -->
   <!-- wp:pattern {"slug":"themename/cta-section"} /-->

   <!-- wp:template-part {"slug":"footer"} /-->
   ```

**Pattern Naming Convention:**
- File: `patterns/[section-name].php`
- Slug: `themename/[section-name]`
- Title: Human-readable "Section Name"
- Categories: `banner`, `call-to-action`, `text`, `featured`, `gallery`

**When to Create Patterns vs. Inline:**

| Condition | Action | Example |
|-----------|--------|---------|
| Section contains images | CREATE PATTERN | Hero, CTA with image, gallery |
| Section is text-only | INLINE in template | Headings, paragraphs, buttons |
| Section is reusable | CREATE PATTERN | Team member card, testimonial |
| Section is page-specific | INLINE in template | 404 error message |

**Pattern Header Template:**
```php
<?php
/**
 * Title: [Human Readable Title]
 * Slug: [theme-slug]/[pattern-slug]
 * Categories: [banner|call-to-action|text|featured|gallery]
 * Description: [Brief description of pattern]
 *
 * @package [ThemeName]
 */
?>
[WordPress block markup here]
```

**Image Path Strategy:**
- Use `get_template_directory_uri()` for theme images
- Images stored in `themes/[theme-name]/assets/images/`
- Use descriptive filenames or Figma asset hashes
- Provide `alt` text from Figma or generate descriptive placeholder

**Pattern Benefits:**
- ✅ Images work immediately (no manual uploads)
- ✅ Portable across environments (localhost, staging, production)
- ✅ Reusable across multiple pages
- ✅ Follows WordPress core FSE theme patterns
- ✅ Template generator can produce working themes automatically

**NEVER:**
- ❌ Put PHP code in .html template files (won't execute)
- ❌ Create inline images with empty `src=""` attributes
- ❌ Hardcode absolute URLs like `http://localhost:8080/wp-content/...`
- ❌ Reference wp-content paths (use `get_template_directory_uri()`)

**Execution Workflow:**

During template generation for each Figma screen:

1. **Analyze sections** → Identify which have images
2. **Image sections** → Extract to separate PHP pattern files
3. **Text sections** → Keep inline in template HTML
4. **Template file** → Reference patterns with `wp:pattern` blocks
5. **Save pattern files** to `patterns/[section-name].php`
6. **Save template file** to `templates/[template-name].html`

**Example Conversion:**

**Before (Broken):**
```html
<!-- templates/front-page.html -->
<main>
  <!-- wp:cover -->
    <!-- wp:image -->
    <img src="" alt=""/> <!-- BROKEN: Empty src -->
    <!-- /wp:image -->
  <!-- /wp:cover -->
</main>
```

**After (Working):**
```php
// patterns/hero-section.php
<?php
/**
 * Title: Hero Section
 * Slug: mytheme/hero-section
 * Categories: banner
 */
?>
<!-- wp:cover -->
  <!-- wp:image -->
  <img src="<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/hero.png" alt="Hero"/>
  <!-- /wp:image -->
<!-- /wp:cover -->
```

```html
<!-- templates/front-page.html -->
<main>
  <!-- wp:pattern {"slug":"mytheme/hero-section"} /-->
</main>
```

**This is the ONLY way to make template-generated themes work without manual WordPress admin uploads.**
