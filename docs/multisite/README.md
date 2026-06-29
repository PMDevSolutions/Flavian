# WordPress Multisite

The repo ships an opt-in multisite installer that converts the local WordPress install into a **subdirectory** network in one command. Subdomain mode is intentionally out of scope for the MVP — see [Why subdomain mode isn't shipped](#why-subdomain-mode-isnt-shipped).

## What's in the box

| Piece | Path | Purpose |
|---|---|---|
| Installer script | `scripts/wordpress-install/setup-multisite.sh` | Runs `wp core multisite-convert`, writes the network constants via `wp config set`, replaces `.htaccess`, optionally creates a sample second site, and promotes user 1 to super admin. |
| Compose profile | `docker-compose.yml` → `multisite-installer` | Wraps the installer in a one-shot container. Run with `docker compose --profile multisite up multisite-installer`. |
| Mu-plugin | `mu-plugins/flavian-multisite.php` | Cached site list, network admin dashboard widget, per-site notice for super admins, `[flavian_network_sites]` shortcode. Gated on `is_multisite()`. |
| Agent | `.claude/agents/wp-environment-manager.md` § 8 | Multisite operations: install, site CRUD, super admin mgmt, network-wide activation, code patterns. |

## Five-minute setup

```bash
# 1. Bring up WordPress (if not already running)
docker compose up -d

# 2. Install WordPress (first run only — the installer below needs it)
./wordpress-local.sh install

# 3. Convert to multisite (subdirectory mode + sample second site)
docker compose --profile multisite up multisite-installer

# 4. Visit the network admin
open http://localhost:8080/wp-admin/network/
```

That's it. The installer is idempotent — re-running detects an existing network and bails out cleanly.

## Customising the installer

Environment variables read by the compose profile:

| Variable | Default | Effect |
|---|---|---|
| `MS_NETWORK_TITLE` | `Flavian Network` | Title shown on the network admin. |
| `MS_CREATE_SECOND_SITE` | `true` | Create the sample sub-site. |
| `MS_SECOND_SITE_SLUG` | `site2` | Slug for the sample sub-site → `/site2/`. |
| `MS_SECOND_SITE_TITLE` | `Site Two` | Title for the sample sub-site. |

Or call the script directly with flags:

```bash
./scripts/wordpress-install/setup-multisite.sh \
  --network-title "Acme Holdings" \
  --second-site-slug press \
  --second-site-title "Acme Press"
```

## Day-to-day site operations

```bash
# List sites
docker compose exec wordpress wp site list --allow-root

# Create another site
docker compose exec wordpress wp site create \
  --slug=marketing --title=Marketing --email=admin@localhost --allow-root

# Run wp-cli against a specific site
docker compose exec wordpress wp post list --url=http://localhost:8080/site2/ --allow-root

# Network-wide plugin activation (otherwise sub-sites can't see the plugin)
docker compose exec wordpress wp plugin activate woocommerce --network --allow-root

# Make a theme available to every sub-site (each site still has to switch to it)
docker compose exec wordpress wp theme enable flavian-shop --network --allow-root

# Super admins
docker compose exec wordpress wp super-admin add <login> --allow-root
```

## The mu-plugin

`mu-plugins/flavian-multisite.php` is a no-op on single-site installs (early `return` on `is_multisite()`). When multisite is active, it adds:

- `Flavian\Multisite\get_network_sites_cached()` — `get_sites()` wrapped in a 5-minute transient. Invalidated on `wp_initialize_site`, `wp_update_site`, `wp_delete_site`.
- A **Network sites** dashboard widget on the network admin.
- A dashboard notice on per-site admin screens linking back to the network admin (super admins only).
- A `[flavian_network_sites]` shortcode for embedding a cross-site nav. `exclude_current="false"` to include the current site.

## Why subdomain mode isn't shipped

Subdomain mode (e.g. `site2.localhost`) needs the request to actually arrive at WordPress with the right `Host` header. Locally that means one of:

- `*.localhost` resolution. Modern Chrome handles `*.localhost` natively, but Safari and curl don't by default.
- A `/etc/hosts` entry per sub-site (`127.0.0.1 site2.localhost`). Easy but unmaintainable as you create more sites.
- `dnsmasq` configured to wildcard-resolve `.localhost`.

The script has no `--subdomain` flag — passing one is rejected as an unknown argument (the installer exits 2 with "Unknown argument"), rather than silently producing a broken setup. If you need subdomain mode, set up wildcard DNS first, then in `wp-config.php`:

```php
define( 'SUBDOMAIN_INSTALL', true );  // was false
define( 'DOMAIN_CURRENT_SITE', 'localhost' );
```

…and run `wp rewrite flush --hard`. The repo's mu-plugin doesn't care which mode you're in.

## Troubleshooting

See the **Error Recovery** section of `.claude/agents/wp-environment-manager.md` for the canonical list. The three issues that cover ~90% of failures:

1. **`/wp-admin/network/` returns "not allowed"** → user 1 isn't a super admin yet. `wp super-admin add <login>`.
2. **Sub-site URLs return 404** → the multisite `.htaccess` rewrite block is missing. Re-run the installer (it's idempotent) or run it with `--skip-htaccess` and edit the file by hand.
3. **Plugin works on main site, missing on sub-sites** → wasn't network-activated. Re-run `wp plugin activate <slug> --network`.
