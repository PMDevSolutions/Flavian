# Gutenberg Custom Block Scaffolding

Generate a complete, **activatable** custom Gutenberg block with one command.
The generator emits a self-contained block plugin under `plugins/<block-name>/`
that works the moment it's activated — **no build step required**.

> Milestone: **v2.0.0 — Gutenberg custom block scaffolding.**

- Slash command: `/scaffold-block`
- Script: `scripts/scaffold-block.sh`
- pnpm: `pnpm run scaffold:block`
- Smoke test: `scripts/smoke-block.sh` (`pnpm run smoke:block`)

---

## Quick start

```bash
# Static block (markup serialized by save())
bash scripts/scaffold-block.sh hero-card \
  --namespace flavian \
  --attributes "heading:string:Welcome,subheading:string,centered:boolean:true"

# Dynamic block (server-rendered via render.php)
bash scripts/scaffold-block.sh latest-events \
  --namespace flavian \
  --attributes "count:number:3,showImage:boolean:true" \
  --dynamic

# Preview only — write nothing
bash scripts/scaffold-block.sh hero-card --attributes "heading:string" --dry-run
```

Via pnpm (note the `--` so pnpm forwards the flags):

```bash
pnpm run scaffold:block hero-card -- --namespace flavian --attributes "heading:string"
```

---

## Inputs

| Input | Flag | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Block name | *(positional)* | ✅ | — | kebab-case slug, e.g. `pricing-table`. Becomes the plugin dir + block slug. |
| Namespace | `--namespace` | — | `flavian` | block.json `name` is `<namespace>/<block-name>`. |
| Attributes | `--attributes` | — | *(none)* | Comma-separated `name:type[:default]`. See below. |
| Render mode | `--dynamic` / `--static` | — | `--static` | `--dynamic` adds `render.php` and a `"render"` field in block.json. |
| Title | `--title` | — | title-cased name | Human-readable block title. |
| Description | `--description` | — | placeholder | block.json + plugin header description. |
| Category | `--category` | — | `widgets` | Block inserter category. |
| Icon | `--icon` | — | `block-default` | Dashicon name. |
| Keywords | `--keywords` | — | block name | Comma-separated inserter keywords. |
| Text domain | `--text-domain` | — | block slug | i18n text domain. |
| Author | `--author` | — | `git config user.name` | Plugin header author. |
| PHP namespace | `--php-namespace` | — | `<Namespace>\Blocks\<Class>` | `@package` tag + test namespace. |
| Version | `--version` | — | `0.1.0` | block.json + asset version. |
| Destination | `--dest` | — | `plugins` | Parent dir for the generated plugin. |
| — | `--force` | — | — | Overwrite an existing target directory. |
| — | `--dry-run` | — | — | Print the plan/files, write nothing. |

### Attribute spec

`--attributes "name:type[:default]"`, comma-separated. Supported types and how
each is wired into the generated code:

| Type | block.json default | Editor control (index.js) | Static `save()` | Dynamic `render.php` |
|------|--------------------|---------------------------|-----------------|----------------------|
| `string` | `""` | `TextControl` | `<p>` with value | escaped `<p>` |
| `number` | `0` | numeric `TextControl` | `<p>` with value | escaped `<p>` |
| `boolean` | `false` | `ToggleControl` | conditional `<p>` | `if ( ! empty(...) )` block |
| `array` | `[]` | *(edit in code)* | *(skipped)* | placeholder comment |
| `object` | `{}` | *(edit in code)* | *(skipped)* | placeholder comment |

Defaults are optional. Examples: `heading:string`, `count:number:3`,
`featured:boolean:true`, `items:array`.

> Attribute **names** should be valid identifiers (camelCase recommended), since
> they become JavaScript object keys and PHP array keys.

---

## Outputs

```
plugins/<block-name>/
├── <block-name>.php                  # Plugin header + register_block_type()
├── blocks/<block-name>/
│   ├── block.json                    # Metadata, attributes, supports
│   ├── index.js                      # edit() + save() — runtime globals, no build
│   ├── index.asset.php               # Script dependencies + version
│   ├── editor.css                    # Editor-only styles
│   ├── style.css                     # Front-end styles
│   └── render.php                    # Dynamic render callback (--dynamic only)
├── tests/
│   ├── <BlockClass>Test.php          # PHPUnit stub
│   └── bootstrap.php                 # Lightweight WP function stubs
├── phpunit.xml.dist
└── README.md
```

### Why no build step?

`index.js` references the WordPress runtime globals (`wp.blocks`, `wp.element`,
`wp.blockEditor`, `wp.components`, `wp.i18n`) directly, and `index.asset.php`
declares those packages as dependencies so WordPress enqueues them in the right
order. This mirrors the reference plugin's `featured-event` block and means the
output is activatable immediately — no `npm install`, no webpack. If you later
want JSX/ESM, swap in `@wordpress/scripts` and point `editorScript` at the
build output.

### Static vs dynamic

- **Static** (default): `save()` serializes attribute values into the post
  content. Attributes without a `source` persist in the block delimiter comment,
  so they round-trip even when not present in the saved markup.
- **Dynamic** (`--dynamic`): `save()` returns `null` and WordPress renders the
  block on every request via `render.php` (declared through the `"render"` field
  in block.json). Use this when output depends on server state (recent posts,
  the current user, options).

---

## Smoke test

`scripts/smoke-block.sh` runs the full acceptance path against the project's
Docker WordPress stack: **scaffold → validate assets → activate → assert the
block is registered → render it on a throwaway page**.

```bash
# Start the stack (if not already running)
docker compose up -d wordpress db

# Run the smoke test (defaults: block "smoke-callout", namespace "flavian")
bash scripts/smoke-block.sh
# or: pnpm run smoke:block

# Inspect the artifacts instead of cleaning them up
bash scripts/smoke-block.sh my-block --namespace acme --keep
```

Expected tail:

```
─── Smoke summary: 8 passed, 0 failed ───
```

The script cleans up after itself (deactivates the plugin, deletes the test
page, removes `plugins/<block>/`) unless you pass `--keep`.

---

## Manual verification

```bash
# 1. Scaffold
bash scripts/scaffold-block.sh pricing-table --namespace acme \
  --attributes "heading:string:Our Plans,count:number:3,featured:boolean" --dynamic

# 2. Run the generated PHPUnit stub (needs phpunit on PATH or in the container)
( cd plugins/pricing-table && phpunit )

# 3. Activate and confirm registration
wp plugin activate pricing-table
wp eval 'var_dump( WP_Block_Type_Registry::get_instance()->is_registered( "acme/pricing-table" ) );'

# 4. Insert the block in the editor (search "Pricing Table") and view the page.
```

---

## Related

- `scripts/scaffold-plugin.sh` — scaffold a full plugin (CPT, taxonomy, settings
  page, and a block) when you need more than a single block.
- `.claude/templates/plugin/` — reference plugin templates, including the
  `featured-event` dynamic block this generator's conventions follow.
- `tests/unit/scaffold-block.bats` — structural tests for the generator output.
- CLAUDE.md → *File Location Requirements* — why blocks live under root-level
  `plugins/`, not `wp-content/plugins/`.
