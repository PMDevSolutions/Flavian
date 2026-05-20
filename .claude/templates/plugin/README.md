# Plugin Template

Source templates consumed by `scripts/scaffold-plugin.sh` to generate new
WordPress plugins under `plugins/`.

## Token substitution

Every `*.tmpl` file is copied to `plugins/<slug>/<path>` with the `.tmpl`
suffix stripped, and the following tokens replaced:

| Token              | Source                                              |
| ------------------ | --------------------------------------------------- |
| `{{PLUGIN_SLUG}}`  | first positional arg, validated `^[a-z][a-z0-9-]*$` |
| `{{PLUGIN_NAME}}`  | `--name`, default = slug title-cased                |
| `{{PLUGIN_DESC}}`  | `--description`, default placeholder                |
| `{{PLUGIN_CLASS}}` | StudlyCase of slug (`flavian-starter` → `FlavianStarter`) |
| `{{PLUGIN_CONST}}` | UPPER_SNAKE of slug (`FLAVIAN_STARTER`)             |
| `{{PLUGIN_NS}}`    | `--namespace`, default `Flavian\Plugins\<PluginClass>` |
| `{{TEXT_DOMAIN}}`  | always equals the slug                              |
| `{{AUTHOR}}`       | `--author`, default = `git config user.name` or `Anonymous` |
| `{{VERSION}}`      | always `0.1.0`                                      |

Path tokens are also substituted — `PLUGIN_SLUG.php.tmpl` becomes
`flavian-starter.php`.

## Adding a new template file

1. Add `<path>.tmpl` here under the appropriate subdirectory.
2. Use the tokens above for any value that depends on the plugin identity.
3. Regenerate `plugins/flavian-starter/` to verify the template renders:
   ```bash
   bash scripts/scaffold-plugin.sh flavian-starter --force
   ```
4. Commit both the new template and the regenerated reference plugin
   in the same PR. CI runs a drift check that diffs the regenerated output
   against the committed copy.

## Conditional features

`--no-cpt`, `--no-taxonomy`, `--no-settings`, and `--no-block` cause the
scaffold script to delete the corresponding files after rendering. The
`Plugin` class uses `class_exists()` guards so omitted features fail silently
at boot time without breaking the rest of the plugin.
