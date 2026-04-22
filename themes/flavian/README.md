# Flavian

A modern WordPress FSE (Full Site Editing) block theme with a curated library of reusable block patterns and starter templates.

- **Version:** 1.0.0
- **Requires WordPress:** 6.0+
- **Tested up to:** 6.7
- **Requires PHP:** 8.0+
- **License:** GPL-2.0-or-later
- **Text Domain:** `flavian`

## Theme Overview

Flavian is a general-purpose block theme designed to give content creators a fast start with conversion-focused layouts. The design philosophy is:

- **Pattern-first.** Every major section (hero, features, pricing, testimonials, CTAs) is shipped as a reusable block pattern so pages can be composed from the editor without writing markup.
- **Token-driven.** All colors, font sizes, spacing, and layout widths are defined in `theme.json` and referenced via CSS custom properties (`var(--wp--preset--…​)`). No hardcoded values in patterns or templates.
- **Editorial typography.** Pairs a utilitarian sans-serif (Inter) for body copy with a classical serif (Playfair Display) for headings, giving marketing pages a confident, publication-like feel.
- **Modern, restrained palette.** A deep navy primary paired with a warm orange secondary and a soft accent, balanced by neutral grays and off-whites.

## Block Patterns

All patterns are registered under the `flavian/*` slug namespace and grouped into custom categories declared in `functions.php`.

### Hero Sections (`flavian-hero`)
- **Hero with Call to Action** (`flavian/hero-cta`) — A full-width hero section with heading, description, and call-to-action button.
- **Hero with Image Split** (`flavian/hero-split`) — A two-column hero section with content on the left and an image on the right.

### Feature Sections (`flavian-features`)
- **Three Column Feature Grid** (`flavian/features-three-column`) — A three-column feature grid with headings and descriptions for showcasing services or benefits.
- **Two Column Features with Images** (`flavian/features-two-column`) — A two-column layout with images and descriptions for highlighting key features.

### Testimonials (`flavian-testimonials`)
- **Testimonial Grid** (`flavian/testimonial-grid`) — A three-column grid of customer testimonials with quotes and attributions.
- **Single Testimonial Quote** (`flavian/testimonial-single`) — A single testimonial with a prominent quote and attribution.

### Calls to Action (`flavian-cta`)
- **CTA Banner** (`flavian/cta-banner`) — A full-width call-to-action banner with heading, description, and button.
- **Boxed CTA** (`flavian/cta-boxed`) — A centered boxed call-to-action section with accent background and dual buttons.

### Pricing (`flavian-pricing`)
- **Simple Pricing Cards** (`flavian/pricing-cards`) — A simple two-card pricing layout for comparing plans.
- **Three Tier Pricing Table** (`flavian/pricing-three-tier`) — A three-tier pricing table with Basic, Pro, and Enterprise plans.

### General (`flavian-general`)
- **FAQ Accordion** (`flavian/faq-accordion`) — A frequently asked questions section with expandable details blocks.
- **Newsletter Signup** (`flavian/newsletter-signup`) — A newsletter signup section with heading, description, and subscribe button.

## Theme.json

`theme.json` is the source of truth for the design system. Patterns and templates reference these tokens via CSS variables — they should never be duplicated as literal values.

### Color Palette

| Slug | Name | Token |
| --- | --- | --- |
| `primary` | Primary | `var(--wp--preset--color--primary)` |
| `secondary` | Secondary | `var(--wp--preset--color--secondary)` |
| `accent` | Accent | `var(--wp--preset--color--accent)` |
| `dark` | Dark | `var(--wp--preset--color--dark)` |
| `light` | Light | `var(--wp--preset--color--light)` |
| `white` | White | `var(--wp--preset--color--white)` |
| `gray` | Gray | `var(--wp--preset--color--gray)` |
| `success` | Success | `var(--wp--preset--color--success)` |

Global styles set the page background to `white` and body text to `dark`; links inherit `primary`.

### Typography

Two font families, both loaded from Google Fonts via `flavian_enqueue_fonts()`:

- **Primary** — `Inter, sans-serif` → `var(--wp--preset--font-family--primary)` (body default)
- **Heading** — `'Playfair Display', serif` → `var(--wp--preset--font-family--heading)`

Font size scale (referenced as `var(--wp--preset--font-size--{slug})`):

| Slug | Size |
| --- | --- |
| `small` | `0.875rem` |
| `base` | `1rem` (body default) |
| `medium` | `1.125rem` |
| `large` | `1.25rem` |
| `x-large` | `1.5rem` |
| `2x-large` | `2rem` |
| `3x-large` | `2.5rem` |

### Spacing Scale

Referenced as `var(--wp--preset--spacing--{slug})` or in block attributes as `var:preset|spacing|{slug}`.

| Slug | Name | Size |
| --- | --- | --- |
| `20` | XS | `0.5rem` |
| `30` | Small | `0.75rem` |
| `40` | Base | `1rem` |
| `50` | Medium | `1.5rem` |
| `60` | Large | `2rem` |
| `70` | XL | `3rem` |
| `80` | 2XL | `4rem` |

### Layout

- Content width: `800px`
- Wide width: `1200px`

## Customization

All visual customization flows through `theme.json`. Avoid editing pattern markup for design changes — update the token, and every pattern updates with it.

### Change a color

Edit the matching entry in `settings.color.palette`:

```json
{ "slug": "primary", "color": "#1a3f6f", "name": "Primary" }
```

Update the `color` value; every block referencing `var(--wp--preset--color--primary)` (or using the `primary` color slug) reflects the change.

### Change a font family

Edit `settings.typography.fontFamilies`:

```json
{ "slug": "heading", "fontFamily": "'Playfair Display', serif", "name": "Heading" }
```

If you switch to a different Google Font, also update the `wp_enqueue_style` URL in `functions.php` (`flavian_enqueue_fonts`) so the new font is loaded.

### Adjust the spacing scale

Edit the entry in `settings.spacing.spacingSizes`. Patterns use slug references like `"padding":{"top":"var:preset|spacing|80"}`, so changing the `size` value cascades through.

### Tweak global styles

The `styles` section sets theme-wide defaults — background, text color, link color, and base typography. For example, to make the site background match the `light` preset instead of `white`:

```json
"styles": {
    "color": {
        "background": "var(--wp--preset--color--light)"
    }
}
```

### Theme customization tips

- Use the Site Editor (**Appearance → Editor**) for most visual changes; it writes user-level overrides without touching `theme.json`.
- For permanent theme-level changes, edit `theme.json` directly.
- Never hardcode hex values or pixel sizes in patterns — always reference a token.

## File Structure

```
themes/flavian/
├── README.md                 # This file
├── style.css                 # Theme metadata header (required by WordPress)
├── index.php                 # Fallback file (FSE themes still need this)
├── functions.php             # Pattern category registration + Google Fonts enqueue
├── theme.json                # Design tokens and global styles (source of truth)
├── screenshot.svg            # Theme preview shown in Appearance → Themes
├── templates/                # FSE block templates
│   ├── index.html            # Default archive / fallback template
│   ├── front-page.html       # Homepage template
│   ├── page.html             # Static page template
│   ├── single.html           # Single post template
│   └── 404.html              # 404 error template
├── parts/                    # Reusable template parts
│   ├── header.html           # Site header
│   └── footer.html           # Site footer
├── patterns/                 # Block patterns (auto-registered by WordPress)
│   ├── hero-cta.php
│   ├── hero-split.php
│   ├── features-three-column.php
│   ├── features-two-column.php
│   ├── testimonial-grid.php
│   ├── testimonial-single.php
│   ├── cta-banner.php
│   ├── cta-boxed.php
│   ├── pricing-cards.php
│   ├── pricing-three-tier.php
│   ├── faq-accordion.php
│   └── newsletter-signup.php
└── assets/
    └── pattern-previews/     # Preview images for patterns (if used)
```

### How the pieces connect

- **`style.css`** declares theme metadata; WordPress reads the header comment to list the theme in the admin.
- **`theme.json`** is read by WordPress and Gutenberg to generate CSS custom properties and populate editor controls (color picker, font size menu, spacing controls).
- **`functions.php`** runs at `init` to register the six custom pattern categories and enqueues the Google Fonts stylesheet.
- **`patterns/*.php`** files are auto-discovered by WordPress (no explicit registration needed) using the header comment block at the top of each file.
- **`templates/` and `parts/`** are HTML block markup files consumed by the Site Editor.

## Contributing a New Pattern

1. Create `patterns/your-pattern.php` with a header comment (`Title`, `Slug`, `Categories`, `Keywords`, `Description`).
2. Use block markup that references only `theme.json` tokens — no hardcoded colors, font sizes, or pixel values.
3. Pick an existing category slug (`flavian-hero`, `flavian-features`, `flavian-testimonials`, `flavian-cta`, `flavian-pricing`, `flavian-general`) or add a new one in `functions.php`.
4. Verify the pattern appears under **Pattern inserter → Flavian** in the editor.
