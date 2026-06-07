---
allowed-tools: Bash(bash scripts/scaffold-block.sh:*), Bash(pnpm run scaffold:block:*), Bash(node:*), Read, Edit, AskUserQuestion
argument-hint: <block-name> [--namespace ns] [--attributes "name:type[:default],..."] [--dynamic]
description: Scaffold a Gutenberg custom block (block.json, edit/save JS, optional render callback, PHPUnit stub)
---

# Scaffold a Gutenberg Custom Block

Generate a self-contained, activatable custom block plugin under
`plugins/<block-name>/` using `scripts/scaffold-block.sh`. No build step is
required — the generated `index.js` uses the WordPress runtime globals and
`index.asset.php` declares the package dependencies.

## Arguments provided

**$ARGUMENTS**

## Inputs (collect these before generating)

The generator accepts three core inputs from the v2.0.0 milestone. If any are
missing from `$ARGUMENTS` and cannot be sensibly defaulted, ask the user with
`AskUserQuestion`:

1. **Block name** (required, positional) — kebab-case slug, e.g. `pricing-table`.
2. **Namespace** (`--namespace`, default `flavian`) — becomes the block.json
   `name` as `<namespace>/<block-name>`.
3. **Supported attributes** (`--attributes`) — comma-separated
   `name:type[:default]`. Types: `string`, `number`, `boolean`, `array`,
   `object`. Example: `heading:string:Our Plans,count:number:3,featured:boolean`.

Optional: `--dynamic` (server-rendered `render.php`; otherwise a static
`save()`), `--title`, `--description`, `--category`, `--icon`, `--keywords`,
`--text-domain`, `--author`, `--php-namespace`, `--version`, `--dest`,
`--force`, `--dry-run`.

## Steps

1. **Parse `$ARGUMENTS`.** Identify the block name, namespace, and attributes.
   Decide static vs dynamic: choose `--dynamic` when the block's output depends
   on PHP/server data (latest posts, current user, options); otherwise leave it
   static. If the choice is ambiguous, ask.

2. **Preview with `--dry-run`** so the user can confirm the file list:

   ```bash
   bash scripts/scaffold-block.sh <block-name> --namespace <ns> \
     --attributes "<spec>" [--dynamic] --dry-run
   ```

3. **Generate** by re-running without `--dry-run` (or via
   `pnpm run scaffold:block <block-name> -- --namespace <ns> ...`).

4. **Report** the created tree and the generated block name
   `<namespace>/<block-name>`.

5. **Offer the smoke test** (requires the Docker stack running):

   ```bash
   docker compose up -d wordpress db
   bash scripts/smoke-block.sh <block-name> --namespace <ns>
   ```

   This scaffolds, validates assets, activates the plugin, asserts the block is
   registered, and renders it on a throwaway page.

## Outputs

```
plugins/<block-name>/
├── <block-name>.php                  # Plugin header + register_block_type()
├── blocks/<block-name>/
│   ├── block.json                    # Metadata, attributes, supports
│   ├── index.js                      # edit() + save() (no build step)
│   ├── index.asset.php               # Script dependencies + version
│   ├── editor.css / style.css        # Styles
│   └── render.php                    # Dynamic render callback (--dynamic only)
├── tests/<BlockClass>Test.php        # PHPUnit stub
├── tests/bootstrap.php               # Lightweight WP stubs
├── phpunit.xml.dist
└── README.md
```

See `docs/blocks/README.md` for the full reference.
