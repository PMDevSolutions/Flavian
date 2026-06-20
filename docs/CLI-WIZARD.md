# Interactive CLI Setup Wizard

`scripts/init.mjs` bootstraps a Flavian project — it scaffolds a theme, writes `.env`,
optionally stages WooCommerce, and creates an initial git commit. Run it once after
cloning the template (or after `composer create-project`).

## Running the wizard

```bash
# From a fresh clone:
pnpm install
pnpm run init                  # interactive
pnpm run init -- --yes         # non-interactive, all defaults
```

Or directly:

```bash
node scripts/init.mjs
```

## Prompts

| Prompt | Default | Notes |
|---|---|---|
| Project / theme slug | directory basename, slugified | Kebab-case, 2–40 chars, starts with a letter |
| Site title | Title-cased slug | Human-readable, used in `.env` and `theme.json` |
| Theme starter | (you pick) | See below |
| WooCommerce support | `no` | Hidden when starter = `flavian-shop` (auto-enabled) |
| Multisite network | `no` | When `yes`, also asks for the mode (subdirectory / subdomain) |
| Local dev port | `8080` | 1024–65535 |
| Admin email | `git config user.email` | Falls back to `admin@example.com` |

### Theme starters

| Value | What you get |
|---|---|
| `blank` | Minimal FSE theme copied from `.claude/templates/theme/` with your slug/title substituted |
| `flavian-shop` | The bundled WooCommerce-ready theme, copied and renamed to your slug |
| `canva` | A **working** FSE theme converted from a Canva HTML/CSS export (requires `--canva-export`). See [Canva starter](#canva-starter) |
| `figma` | No theme generated. Writes `docs/NEXT-STEPS.md` pointing at the `figma-to-fse-autonomous-workflow` skill |
| `indesign` | Placeholder only — the InDesign-to-FSE pipeline is not yet implemented |

## Non-interactive flags

```
--yes                Skip prompts, use defaults / flag values
--name <slug>        Project slug
--theme <starter>    blank | flavian-shop | canva | figma | indesign
--canva              Shorthand for --theme=canva (requires --canva-export)
--canva-export <dir> Canva HTML/CSS export directory (required for the canva starter)
--woo                Enable WooCommerce (auto-true for flavian-shop)
--multisite          Configure a WordPress multisite network
--multisite-mode <m> subdirectory | subdomain (default subdirectory; requires --multisite)
--port <n>           Local dev port (default 8080)
--email <addr>       Admin email
--no-git             Skip git init
--help               Show usage
```

Examples:

```bash
# Smallest possible run — accept all defaults
node scripts/init.mjs --yes

# Build a WooCommerce-ready shop
node scripts/init.mjs --yes --name=acme-shop --theme=flavian-shop

# Stage a Figma-driven project
node scripts/init.mjs --yes --name=marketing-site --theme=figma

# Convert a Canva export into a working theme (no prompts)
pnpm run init -- --yes --canva --canva-export=path/to/export --name=landing

# Configure a multisite network (subdirectory mode)
pnpm run init -- --yes --multisite --name=my-network

# …or subdomain mode
pnpm run init -- --yes --multisite --multisite-mode=subdomain --name=my-network
```

## Canva starter

Unlike `figma` (which only stages a `NEXT-STEPS.md`), the `canva` starter produces a
**working FSE theme** from a Canva HTML/CSS export, so CI and scripted setups can run
it with no prompts:

```bash
pnpm run init -- --yes --canva --canva-export=path/to/export --name=landing
```

`--canva` is shorthand for `--theme=canva`; either form works, and both require
`--canva-export=<dir>`. The export directory must contain at least one `.css` and one
`.html` file (the wizard prefers `style.css` / `index.html` when present). The path is
resolved relative to where you run the wizard.

What the wizard generates in `themes/<slug>/`:

1. A valid blank FSE base scaffold (`theme.json`, `style.css`, `templates/`, `parts/`,
   `functions.php`) with your slug/title substituted.
2. **Design tokens** — `scripts/canva-fse/parse-canva-export.sh` extracts colors,
   font families, font sizes, and spacing from the CSS and merges them into
   `theme.json`. The lightest/darkest extracted colors are wired to the default
   background/text, and the first font family becomes the body font.
3. **Content** — `scripts/canva-fse/convert-html-to-blocks.sh` converts the export's
   HTML to block markup, written to `patterns/canva-content.php` and referenced from
   `templates/front-page.html`. This keeps the theme **pattern-first**: PHP and images
   live in the pattern, never in the `.html` template.
4. Referenced images are copied into `themes/<slug>/assets/`.

This is a **deterministic baseline** — the same pieces the `canva-fse-converter` agent
starts from. For a production-quality pass (layout, semantics, responsiveness), point
Claude Code at your export directory ("Convert this Canva export to a WordPress
theme"), which runs the `canva-to-fse-autonomous-workflow` skill. The generated
`docs/NEXT-STEPS.md` spells this out.

> **Requires `bash`.** The canva path shells out to the `scripts/canva-fse/*.sh`
> helpers (the same scripts the agent and the `canva-e2e` CI job use), so `bash` must
> be on `PATH`. This is the only wizard starter with that requirement.

## Multisite

`--multisite` doesn't convert WordPress on its own — consistent with the rest of the
wizard, it only writes configuration. The conversion runs later, against a booted
container. What the flag adds to `.env`:

| Key | Value | Notes |
|---|---|---|
| `WP_MULTISITE` | `true` | `false` on non-multisite runs |
| `WP_MULTISITE_MODE` | `subdirectory` \| `subdomain` | From `--multisite-mode` (default `subdirectory`) |
| `MS_NETWORK_TITLE` | your site title | e.g. `--name=my-network` → `My Network` |

The existing `MS_SECOND_SITE_*` defaults in `.env.example` (used by the sample
sub-site) are left untouched.

### Building the network

Once the config is written, `./wordpress-local.sh install` is multisite-aware: it
reads `WP_MULTISITE` / `WP_MULTISITE_MODE` from `.env` and runs
`wp core multisite-install` (adding `--subdomains` for subdomain mode) instead of a
single-site install. It also writes the mode-specific multisite `.htaccess` (so
sub-site URLs resolve on the Apache image) and honours `WP_PORT` for the admin URL.

```bash
docker compose up -d            # boot WordPress + db
./wordpress-local.sh install    # builds the network from .env
open http://localhost:8080/wp-admin/network/
```

The `docker compose --profile multisite up multisite-installer` profile is an
alternative path that converts an already-installed single site (subdirectory mode
only — see `docs/multisite/README.md`).

### Subdomain mode caveat

Subdomain multisite (`blog2.localhost`) needs the request to reach WordPress with the
right `Host` header, which means wildcard DNS for `*.localhost` (a per-site
`/etc/hosts` entry, or `dnsmasq`). The wizard writes the config and
`wordpress-local.sh install` passes `--subdomains`, but you must set up local DNS
yourself. See [docs/multisite/README.md](multisite/README.md#why-subdomain-mode-isnt-shipped).

## What gets written

A successful run produces:

```
<project>/
├── .env                  ← from .env.example, with your values
│                            (includes WP_MULTISITE / WP_MULTISITE_MODE when --multisite)
├── themes/<slug>/        ← scaffolded theme (skipped for figma/indesign)
│   ├── patterns/canva-content.php      ← canva starter only (converted content)
│   ├── templates/front-page.html       ← canva starter only (references the pattern)
│   └── assets/                          ← canva starter only (copied export images)
├── docs/NEXT-STEPS.md    ← figma / indesign / canva starters
└── .git/                 ← fresh repo, one commit (unless --no-git)
```

The initial scaffold commit is made with `git commit --no-verify`. The freshly
generated project has no commit hooks installed yet, so the flag is purely
belt-and-braces — it has no effect on the commits *you* make afterward.

## What gets validated

After the apply phase, the wizard runs static checks:

1. `.env` exists and is non-empty
2. `themes/<slug>/theme.json` parses as valid JSON
3. `themes/<slug>/style.css` exists
4. `themes/<slug>/templates/index.html` exists

Steps 2–4 are skipped for `figma` and `indesign` starters since they don't
generate a theme directly. The `canva` starter *does* generate a theme, so all
four checks run against it.

A verification failure leaves the scaffold in place so you can fix and re-run.

## Testing the wizard

```bash
pnpm run test:init
```

Runs all unit tests under `tests/init/unit/` plus integration smoke tests under
`tests/init/integration/`. The CI job (`.github/workflows/init-wizard.yml`)
runs this on every push/PR that touches the wizard code.

## Known limitations

- The InDesign starter is a placeholder; no pipeline ships yet.
- Re-running the wizard against an existing `themes/<slug>/` directory fails
  cleanly — there's no in-place upgrade path.
- Verification is static-only. Docker isn't booted; if Docker is missing or
  misconfigured, you'll find out when you run `docker compose up`.
- `--yes` mode does not invoke `@clack/prompts`, so the wizard can run in
  CI/test environments without it installed. The interactive mode does require
  `pnpm install` to have run first.
