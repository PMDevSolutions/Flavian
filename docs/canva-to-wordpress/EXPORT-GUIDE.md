# How to Export from Canva for WordPress Conversion

## Exporting HTML/CSS from Canva

1. Open your design in Canva
2. Click **Share** → **Download**
3. Select **HTML** as the file type (Canva Pro feature)
4. Download the ZIP file
5. Extract to a directory (e.g., `canva-export/`)

## Alternative for Free Canva Users

1. Open browser DevTools (F12) while viewing the design
2. Copy the page HTML and save as `page.html`
3. Copy the CSS styles and save as `style.css`
4. Right-click and save images separately

## Expected Directory Structure

```
canva-export/
├── index.html          # Main page HTML
├── about.html          # Additional pages (if multi-page)
├── style.css           # Stylesheet with design tokens
└── images/
    ├── hero.png
    └── logo.svg
```

## Design Tips for WordPress-Ready Canva Designs

- Use consistent colors (they become `theme.json` tokens)
- Use standard font sizes (14px, 16px, 18px, 24px, 32px, 48px)
- Keep layouts simple — columns, sections, headers
- Use text boxes, not text embedded in images
- Name pages clearly (they become template names)

## Known Limitations

- Canva animations are not converted (WordPress blocks are static)
- Complex overlapping elements may need manual adjustment
- Gradient effects may simplify to solid colors
- Canva's proprietary fonts may not be available in WordPress

## What Maps Well to WordPress

- **Headers, footers, navigation** → Template parts
- **Hero sections** → Cover blocks or Group blocks
- **Card grids** → Columns blocks
- **Image galleries** → Gallery blocks
- **Call-to-action buttons** → Button blocks
- **Text sections** → Paragraph and heading blocks
