---
paths:
  - "themes/**"
  - "plugins/**"
  - "mu-plugins/**"
---

# WordPress standards (loaded when theme, plugin or mu-plugin files are in play)

## Root-level layout

This project develops in root-level folders, not under `wp-content/`:

```
project-root/
├── themes/          ← theme files go HERE (NOT wp-content/themes/)
├── plugins/         ← plugin files go HERE (NOT wp-content/plugins/)
├── mu-plugins/      ← must-use plugins go HERE (NOT wp-content/mu-plugins/)
└── .claude/         ← Claude Code configuration
```

Testing and deployment copy these folders into a WordPress install's `wp-content/`. Never create files under `wp-content/themes/` or `wp-content/plugins/` during development; the `validate-theme-location.sh` hook denies the write and names the root-level path.

## Theme structure (FSE)

```
themes/theme-name/
├── style.css                   # Theme header and main styles
├── functions.php               # Theme functions and hooks
├── theme.json                  # FSE configuration (required for a block theme)
├── templates/                  # Block templates: index.html, front-page.html, single.html, page.html, 404.html
├── parts/                      # Template parts: header.html, footer.html, sidebar.html
├── patterns/                   # Block patterns (PHP, one file per pattern)
├── assets/css|js|images/
└── inc/                        # PHP includes
```

A classic theme uses `index.php`, `header.php`, `footer.php`, `single.php`, `page.php`, `archive.php` and `template-parts/` instead of `templates/` and `parts/`.

## Plugin structure

```
plugins/plugin-name/
├── plugin-name.php            # Main file with the plugin header
├── includes/                  # PHP includes
├── admin/                     # Admin-side functionality
├── public/                    # Public-facing functionality
├── assets/css|js|images/
└── languages/                 # Translation files
```

`bash scripts/scaffold-block.sh <name>` (or `/scaffold-block`) generates an activatable block plugin with `block.json`, `index.js`, `index.asset.php`, styles, an optional `render.php`, a PHPUnit stub and `phpunit.xml.dist`.

## Design tokens

- `theme.json` presets are the single source of truth. Templates, parts and patterns reference them: `var(--wp--preset--color--<slug>)`, `var(--wp--preset--spacing--<n>)`, `var(--wp--preset--font-size--<slug>)`, `var(--wp--preset--font-family--<slug>)`, or the matching block attributes (`"textColor"`, `"fontSize"`, `"style":{"spacing":{...}}` with `var:preset|spacing|40`).
- No hex colours, pixel padding, margin or gap, pixel font sizes or font families in `style` attributes or block JSON. A value with no preset gets a preset added to `theme.json` when it recurs, an inline style only when it appears once or twice. The `theme-token-auditor` checks every write; the `pre-commit-token-guard.sh` hook asks on commit.
- Images belong in PHP patterns (`<?php echo esc_url( get_theme_file_uri( 'assets/images/hero.jpg' ) ); ?>`), never in HTML templates with an empty `src` (`fse-pattern-first-architecture`).

## PHP

- WordPress PHP Coding Standards (`./scripts/wordpress/check-coding-standards.sh <path>`; set up with `./scripts/wordpress/setup-phpcs.sh`). Use WordPress functions and APIs where one exists.
- Escape output: `esc_html()`, `esc_url()`, `esc_attr()`, `wp_kses_post()`. Sanitize input: `sanitize_text_field()`, `sanitize_email()`, `absint()`, and so on.
- Nonces on every form submission and AJAX request; `current_user_can()` before anything privileged.
- Database: `$wpdb->prepare()` for every custom query; prefer `WP_Query`, `get_posts()`, `get_pages()`, `get_terms()`, `get_option()` / `update_option()`, `get_theme_mod()`.
- Hooks: `add_action()`, `add_filter()`, `do_action()`, `apply_filters()`, named with the theme or plugin prefix and documented where custom.
- JavaScript and CSS: `wp_enqueue_script()` / `wp_enqueue_style()` (register first for conditional loading), `wp_localize_script()` for AJAX data. No inline `<script>` or `<style>` in templates.
- Keep WordPress, themes and plugins current; never trust input, always escape output.

## Testing and checks

- PHPUnit per theme or plugin (`composer require --dev phpunit/phpunit`, `vendor/bin/phpunit`); `wordpress-testing-workflows` has the patterns (`WP_UnitTestCase`, custom post types, meta boxes, AJAX, REST).
- `./scripts/wordpress/security-scan.sh <path>`, `./scripts/wordpress/check-performance.sh <path>`, `./scripts/validate-theme.sh <theme>`; `/lint all` runs the set.
- Debugging in `wp-config.php`: `WP_DEBUG`, `WP_DEBUG_LOG` true, `WP_DEBUG_DISPLAY` false, `SCRIPT_DEBUG` true.
- Local stack: `docker compose up -d wordpress db` (LOCAL-DEVELOPMENT.md). `wp db reset`, `docker compose down -v` and remote deploys stop for a human (`deploy-guard.sh`).
