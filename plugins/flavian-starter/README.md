# Flavian Starter

Starter plugin for Flavian-based projects. Demonstrates CPT, taxonomy, settings, and a server-rendered block.

## Requirements

- WordPress 6.5+
- PHP 8.0+
- Composer (for development and testing)

## Installation

1. Copy this directory into your WordPress site's `wp-content/plugins/` directory.
2. From inside the plugin directory, run `composer install` to generate the autoloader.
3. Activate the plugin via the WordPress admin or with WP-CLI:
   ```bash
   wp plugin activate flavian-starter
   ```

## What this plugin demonstrates

- **Custom post type** — `flavian-starter_event` registered via `src/PostTypes/Event.php`.
- **Custom taxonomy** — `flavian-starter_event_category` attached to the event CPT.
- **Settings page** — `Settings → Flavian Starter` using the WordPress Settings API.
- **Dynamic block** — `flavian-starter/featured-event` server-rendered via `register_block_type` + `block.json` (no build step required).
- **Activation / deactivation hooks** — `flush_rewrite_rules()` on both transitions.
- **PSR-4 autoloading** — `Flavian\Plugins\FlavianStarter` namespace, autoloaded from `src/`.
- **Uninstall cleanup** — `uninstall.php` removes plugin options and CPT entries on hard uninstall.

## Development

```bash
composer install
composer test    # PHPUnit (unit tests, Brain Monkey)
composer lint    # PHPCS with WordPress-Extra ruleset
```

### Adding integration tests

Unit tests run against Brain Monkey mocks — no MySQL or `wp-tests-lib` required.
For full WordPress integration tests, see
[`wordpress-testing-workflows` skill](../../.claude/skills/wordpress-testing-workflows/SKILL.md)
for the canonical setup.

## License

GPL-2.0-or-later.
