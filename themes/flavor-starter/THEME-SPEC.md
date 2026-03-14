# Flavor Starter Theme Specification

This document defines the requirements for the Flavor Starter FSE theme, demonstrating what a Figma-to-WordPress conversion produces.

## Theme Identity

- **Theme Name:** Flavor Starter
- **Theme Slug:** flavor-starter
- **Version:** 1.0.0
- **Requires WordPress:** 6.4
- **Requires PHP:** 8.0
- **License:** GPL-2.0-or-later

## Required Files for Valid FSE Theme

### Core Files (Required)

| File | Purpose | Status |
|------|---------|--------|
| `style.css` | Theme metadata header | Required |
| `theme.json` | Design system configuration | Required |
| `templates/index.html` | Main fallback template | Required |
| `functions.php` | Theme setup and registration | Required |

### Template Files

| File | Purpose |
|------|---------|
| `templates/index.html` | Main fallback template |
| `templates/front-page.html` | Homepage template |
| `templates/single.html` | Single post template |
| `templates/page.html` | Page template |
| `templates/404.html` | Error page template |

### Template Parts

| File | Area |
|------|------|
| `parts/header.html` | header |
| `parts/footer.html` | footer |

### Block Patterns (PHP Files)

| File | Slug | Categories |
|------|------|------------|
| `patterns/hero-section.php` | flavor-starter/hero-section | banner |
| `patterns/about-section.php` | flavor-starter/about-section | text |

## Design System Tokens

### Colors (6 Total)

| Slug | Name | Hex Value | Usage |
|------|------|-----------|-------|
| `primary` | Primary | #2563EB | Buttons, links, accents |
| `secondary` | Secondary | #1E40AF | Hover states, secondary actions |
| `background` | Background | #FFFFFF | Page background |
| `text` | Text | #1F2937 | Body text |
| `accent` | Accent | #F59E0B | Highlights, badges |
| `muted` | Muted | #9CA3AF | Subtle text, borders |

### Typography

#### Font Families (2 Total)

| Slug | Name | Stack | Usage |
|------|------|-------|-------|
| `heading` | Inter | "Inter", sans-serif | Headings |
| `body` | System | system-ui, sans-serif | Body text |

#### Font Sizes (6 Total)

| Slug | Name | Size | Fluid |
|------|------|------|-------|
| `small` | Small | 0.875rem | No |
| `medium` | Medium | 1rem | No |
| `large` | Large | 1.25rem | clamp(1.125rem, 1.5vw, 1.25rem) |
| `x-large` | Extra Large | 1.5rem | clamp(1.25rem, 2vw, 1.5rem) |
| `xx-large` | 2X Large | 2.25rem | clamp(1.75rem, 3vw, 2.25rem) |
| `xxx-large` | 3X Large | 3rem | clamp(2rem, 4vw, 3rem) |

### Spacing Scale (6 Sizes)

| Slug | Size | Pixels (at 16px base) |
|------|------|----------------------|
| `20` | 0.5rem | 8px |
| `30` | 0.75rem | 12px |
| `40` | 1rem | 16px |
| `50` | 1.5rem | 24px |
| `60` | 2rem | 32px |
| `70` | 3rem | 48px |

### Layout Settings

| Property | Value |
|----------|-------|
| `contentSize` | 768px |
| `wideSize` | 1280px |

## Template Requirements

### index.html
- Header template part
- Main content area with query loop
- Footer template part

### front-page.html
- Header template part
- Hero section pattern
- About section pattern
- Footer template part

### single.html
- Header template part
- Post title, meta, content
- Footer template part

### page.html
- Header template part
- Page title and content
- Footer template part

### 404.html
- Header template part
- Error message with heading and paragraph
- Footer template part

## Pattern Requirements

### hero-section.php
- Full-width cover block
- Heading (h1)
- Paragraph description
- CTA button
- Background image using `get_theme_file_uri()`
- All text wrapped in `esc_html__()`

### about-section.php
- Two-column layout
- Image column with `get_theme_file_uri()`
- Text column with heading and paragraph
- Proper escaping functions

## Validation Criteria

### File Structure
- [ ] All required files exist
- [ ] Directory structure is correct
- [ ] No files in wp-content/ (development only)

### theme.json
- [ ] Valid JSON syntax
- [ ] Version set to 3
- [ ] All 6 colors defined
- [ ] Both font families defined
- [ ] All 6 font sizes defined
- [ ] All 6 spacing values defined
- [ ] Layout contentSize and wideSize defined

### Templates
- [ ] Valid WordPress block syntax
- [ ] Opening/closing comments match
- [ ] HTML classes match JSON attributes
- [ ] References to parts/patterns are valid

### Patterns
- [ ] PHP header comments complete (Title, Slug, Categories)
- [ ] All images use `get_theme_file_uri()`
- [ ] All text uses `esc_html__()`
- [ ] URLs use `esc_url()`
- [ ] Attributes use `esc_attr__()`

### WordPress Standards
- [ ] No hardcoded color values
- [ ] No hardcoded spacing values
- [ ] 100% theme.json token usage
- [ ] Semantic heading hierarchy
- [ ] Accessible alt text on images

## Success Metrics

A valid Flavor Starter theme must:

1. **Activate without errors** in WordPress 6.4+
2. **Pass theme validation** using `validate-theme.sh`
3. **Display correctly** in Site Editor
4. **Show all patterns** in Pattern inserter
5. **Use design tokens** consistently (no hardcoded values)
6. **Handle images** via PHP patterns (not HTML templates)

## File Tree (Expected)

```
themes/flavor-starter/
├── THEME-SPEC.md
├── README.md
├── style.css
├── theme.json
├── functions.php
├── validate-theme.sh
├── templates/
│   ├── index.html
│   ├── front-page.html
│   ├── single.html
│   ├── page.html
│   └── 404.html
├── parts/
│   ├── header.html
│   └── footer.html
├── patterns/
│   ├── hero-section.php
│   └── about-section.php
└── assets/
    └── images/
        ├── hero-background.jpg
        └── about-image.jpg
```
