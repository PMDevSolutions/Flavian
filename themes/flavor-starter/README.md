# Flavor Starter

A minimal FSE (Full Site Editing) block theme demonstrating the output of a Figma-to-WordPress conversion.

## Purpose

This theme serves as an **example** of what the Figma-to-WordPress conversion workflow produces. It demonstrates:

- Complete design system defined in `theme.json`
- Pattern-first architecture for image handling
- WordPress block markup best practices
- Proper escaping and internationalization

## Quick Start

1. Copy the `flavor-starter` folder to your WordPress `wp-content/themes/` directory
2. Replace placeholder images in `assets/images/` with actual images
3. Activate the theme in WordPress admin
4. Customize via Appearance > Editor (Site Editor)

## Design System

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | #2563EB | Buttons, links, accents |
| `secondary` | #1E40AF | Hover states |
| `background` | #FFFFFF | Page background |
| `text` | #1F2937 | Body text |
| `accent` | #F59E0B | Highlights, badges |
| `muted` | #9CA3AF | Subtle text, borders |

### Typography

| Token | Font Stack |
|-------|-----------|
| `heading` | "Inter", sans-serif |
| `body` | system-ui, sans-serif |

Font sizes: `small`, `medium`, `large`, `x-large`, `xx-large`, `xxx-large`

### Spacing Scale

| Token | Size |
|-------|------|
| `20` | 0.5rem (8px) |
| `30` | 0.75rem (12px) |
| `40` | 1rem (16px) |
| `50` | 1.5rem (24px) |
| `60` | 2rem (32px) |
| `70` | 3rem (48px) |

### Layout

- Content width: 768px
- Wide width: 1280px

## File Structure

```
flavor-starter/
├── style.css           # Theme metadata
├── theme.json          # Design system configuration
├── functions.php       # Theme setup and pattern registration
├── validate-theme.sh   # Validation script
├── templates/
│   ├── index.html      # Main fallback template
│   ├── front-page.html # Homepage
│   ├── single.html     # Single posts
│   ├── page.html       # Pages
│   └── 404.html        # Error page
├── parts/
│   ├── header.html     # Site header
│   └── footer.html     # Site footer
├── patterns/
│   ├── hero-section.php    # Hero with background image
│   └── about-section.php   # Two-column about section
└── assets/
    └── images/
        ├── hero-background.svg  # Hero placeholder
        └── about-image.svg      # About section placeholder
```

## Pattern-First Architecture

**Why patterns are PHP files:**

HTML template files cannot execute PHP. This means images with dynamic paths (using `get_theme_file_uri()`) must be in PHP pattern files.

**Correct approach:**
```php
// patterns/hero-section.php
$image_url = esc_url( get_theme_file_uri( 'assets/images/hero.jpg' ) );
```

**Incorrect approach:**
```html
<!-- templates/front-page.html -->
<!-- Images here would have empty src or hardcoded URLs -->
```

Templates reference patterns:
```html
<!-- wp:pattern {"slug":"flavor-starter/hero-section"} /-->
```

This ensures images always work regardless of installation path.

## Customization

### Changing Colors

Edit `theme.json` > `settings.color.palette`:

```json
{
  "slug": "primary",
  "name": "Primary",
  "color": "#YOUR_HEX_COLOR"
}
```

### Changing Fonts

Edit `theme.json` > `settings.typography.fontFamilies`:

```json
{
  "slug": "heading",
  "name": "Heading",
  "fontFamily": "\"Your Font\", sans-serif"
}
```

### Adding New Patterns

1. Create `patterns/your-pattern.php`
2. Add required header:
   ```php
   <?php
   /**
    * Title: Your Pattern
    * Slug: flavor-starter/your-pattern
    * Categories: featured
    */
   ?>
   ```
3. Add WordPress block markup

### Replacing Placeholder Images

1. Add your images to `assets/images/`
2. Update pattern files if using different filenames
3. SVG placeholders auto-fallback: patterns check for JPG first

## Validation

Run the validation script to check theme compliance:

```bash
cd themes/flavor-starter
chmod +x validate-theme.sh
./validate-theme.sh
```

The script checks:
- Required files exist
- `style.css` has proper headers
- `theme.json` is valid JSON with required tokens
- Templates reference parts correctly
- Patterns have proper PHP headers
- Escaping functions are used

## WordPress Standards

This theme follows WordPress FSE best practices:

### Design Tokens
- 100% `theme.json` token usage
- No hardcoded color values
- No hardcoded spacing values
- Fluid typography via `clamp()`

### Block Markup
- Valid JSON in block comments
- HTML classes match block attributes
- Opening/closing comments match
- Semantic heading hierarchy

### Security
- `esc_html__()` for translatable text
- `esc_url()` for URLs
- `esc_attr__()` for attributes
- `get_theme_file_uri()` for asset paths

### Accessibility
- One h1 per page maximum
- No skipped heading levels
- Descriptive alt text on images
- Proper color contrast

## How Figma Designs Map to This Theme

| Figma Element | WordPress Implementation |
|---------------|-------------------------|
| Color styles | `theme.json` color palette |
| Text styles | `theme.json` font sizes + families |
| Spacing tokens | `theme.json` spacing scale |
| Components | Block patterns (PHP files) |
| Page layouts | Templates (HTML files) |
| Repeated sections | Template parts |

## Requirements

- WordPress 6.4 or higher
- PHP 8.0 or higher

## License

GPL-2.0-or-later

## Credits

Generated by Claude Code as an example of Figma-to-WordPress conversion output.
