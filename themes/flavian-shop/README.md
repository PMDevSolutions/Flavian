# Flavian Shop

A WooCommerce-ready FSE (Full Site Editing) starter theme that ships with the
templates, parts, and block patterns you need to launch a small store. It's a
**scaffold** — copy it, rename it, and customise.

## What's included

```
themes/flavian-shop/
├── style.css
├── theme.json                 # design tokens (colors, type, spacing, layout)
├── functions.php              # WC support flags, pattern category, asset enqueue
├── parts/
│   ├── header.html            # site title + navigation + customer-account + mini-cart
│   └── footer.html            # three-column footer with shop/help links
├── templates/
│   ├── index.html             # blog/post fallback
│   ├── page.html              # generic page
│   ├── 404.html                # not-found page with product search
│   ├── archive-product.html   # /shop with sidebar filters and pagination
│   ├── single-product.html    # PDP with gallery, price, add-to-cart, related
│   ├── taxonomy-product_cat.html  # category pages
│   ├── page-cart.html         # cart page (block-based)
│   ├── page-checkout.html     # checkout page (block-based)
│   ├── page-myaccount.html    # my account
│   └── page-shop.html         # storefront landing (custom template)
└── patterns/
    ├── hero-shop.php
    ├── usp-strip.php
    ├── featured-products.php
    ├── product-grid.php
    ├── category-grid.php
    └── newsletter.php
```

## Activating

From the project root:

```bash
docker compose up -d
docker compose exec wordpress wp theme activate flavian-shop --allow-root
```

If WooCommerce isn't installed yet, run:

```bash
./scripts/wordpress-install/setup-woocommerce.sh
```

That script installs WooCommerce, activates it, imports sample products, and
creates the cart / checkout / my-account pages with the right slugs so the
shipped templates pick them up.

## Customising

1. **Tokens first.** Edit `theme.json` colors, fonts, and spacing scale before
   touching templates. Every template references CSS variables generated from
   `theme.json`, so changes propagate everywhere.
2. **Templates second.** Reorder blocks, swap patterns in or out from
   `page-shop.html`, or add new templates for specific landing pages.
3. **Patterns third.** Extend the included patterns — they live in
   `patterns/` as PHP files (the pattern-first architecture used across this
   project), so they can include `esc_html__()` translations.

## Design tokens (theme.json highlights)

| Token | Purpose |
|---|---|
| `color.primary` / `primary-hover` | call-to-action backgrounds, links |
| `color.surface` | section backgrounds (hero, footer) |
| `color.muted` | secondary text |
| `color.border` | thin separators between header/footer/sections |
| `font-family.sans` / `serif` | body and accent typography |
| `font-size.display` / `x-large` / `large` | fluid heading scale |
| `spacing` (1.5× × 7 steps) | consistent vertical rhythm |

## Tested with

- WordPress 6.5+
- WooCommerce 8.6+
- PHP 7.4+
