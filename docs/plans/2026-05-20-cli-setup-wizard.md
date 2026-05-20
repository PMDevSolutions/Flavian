# Interactive CLI Setup Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an interactive Node CLI wizard (`scripts/init.mjs`) that bootstraps a Flavian project — prompts for project name, theme starter, design source, and WooCommerce support, then writes `.env`, scaffolds the theme, stages WooCommerce, and makes an initial git commit. Includes `--yes` non-interactive mode and static verification.

**Architecture:** Single wizard module under `scripts/init/`, orchestrated by `scripts/init.mjs`. Prompts collect a plain `WizardConfig` object; a separate `apply(config)` pass writes files and shells out to existing scripts. All file-writing logic is pure-function-style around `config + targetDir`, so it's unit-testable in `mkdtemp` dirs. The published `@pmds/create-flavian` package is a thin bootstrap that downloads the latest release and runs `node scripts/init.mjs`; the package itself is **out of scope for this PR** (created/published in a follow-up).

**Tech Stack:** Node ≥20, `@clack/prompts`, `node:test`, `node:fs/promises`, `node:child_process`. Bash scripts already in `scripts/` reused via `execFile`. No new transitive deps.

**Design doc:** `docs/plans/2026-05-20-cli-setup-wizard-design.md`

---

## Conventions used throughout

- **Branch:** `21-create-interactive-cli-setup-wizard` (already checked out).
- **Commits:** Conventional Commits. Reference `#21` in commit bodies where relevant.
- **Test runner:** `node --test tests/init/**/*.test.mjs` (Node built-in; no jest/vitest).
- **Module style:** ESM (`.mjs`), `export function` named exports.
- **Paths in this plan are relative to repo root** `C:\Users\Paul Mulligan\PMDS\Projects\Flavian`.

---

### Task 1: Add @clack/prompts dependency and npm script

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run: `pnpm add -D @clack/prompts@^0.7.0`
Expected: pnpm adds `@clack/prompts` to `devDependencies` in `package.json` and updates `pnpm-lock.yaml`.

**Step 2: Add an `init` npm script**

In `package.json`, inside the `"scripts"` object, add:

```json
"init": "node scripts/init.mjs",
"test:init": "node --test \"tests/init/**/*.test.mjs\""
```

**Step 3: Verify**

Run: `pnpm run init --help`
Expected: Script not found yet (we haven't created it). That's fine — script entry exists, error proves it's wired. Equivalent check: `node -e "console.log(require('./package.json').scripts.init)"` prints `node scripts/init.mjs`.

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @clack/prompts dep and init npm scripts (#21)"
```

---

### Task 2: Create the directory layout

**Files:**
- Create: `scripts/init/` (directory)
- Create: `tests/init/unit/` (directory)
- Create: `tests/init/integration/` (directory)
- Create: `.claude/templates/theme/` (directory)

**Step 1: Create dirs and placeholder `.gitkeep` files**

```bash
mkdir -p scripts/init tests/init/unit tests/init/integration .claude/templates/theme
```

We'll fill them in subsequent tasks. No commit yet — combine with Task 3.

---

### Task 3: Implement and test `validate-name.mjs`

Validates the project/theme slug. Rules: kebab-case, 2–40 chars, must start with a letter, no reserved WordPress slugs.

**Files:**
- Create: `scripts/init/validate-name.mjs`
- Test: `tests/init/unit/validate-name.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/validate-name.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectName } from '../../../scripts/init/validate-name.mjs';

test('accepts valid kebab-case slug', () => {
  assert.equal(validateProjectName('my-shop'), null);
  assert.equal(validateProjectName('shop2'), null);
});

test('rejects empty / too-short names', () => {
  assert.match(validateProjectName(''), /required/i);
  assert.match(validateProjectName('a'), /at least 2/i);
});

test('rejects names longer than 40 chars', () => {
  assert.match(validateProjectName('a'.repeat(41)), /40 characters/i);
});

test('rejects names starting with a digit or dash', () => {
  assert.match(validateProjectName('2cool'), /start with a letter/i);
  assert.match(validateProjectName('-foo'), /start with a letter/i);
});

test('rejects names with uppercase or underscores', () => {
  assert.match(validateProjectName('MyShop'), /lowercase/i);
  assert.match(validateProjectName('my_shop'), /lowercase/i);
});

test('rejects reserved WordPress slugs', () => {
  assert.match(validateProjectName('wp-admin'), /reserved/i);
  assert.match(validateProjectName('wp-content'), /reserved/i);
  assert.match(validateProjectName('akismet'), /reserved/i);
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/validate-name.test.mjs`
Expected: All tests fail with `Cannot find module .../validate-name.mjs`.

**Step 3: Implement**

```js
// scripts/init/validate-name.mjs
const RESERVED = new Set([
  'wp-admin', 'wp-content', 'wp-includes', 'akismet', 'hello',
  'index', 'wordpress', 'admin', 'twentytwentyfive',
]);

/**
 * Returns null if valid, otherwise an error string suitable for display.
 */
export function validateProjectName(value) {
  if (!value || value.trim() === '') return 'Project name is required';
  if (value.length < 2) return 'Must be at least 2 characters';
  if (value.length > 40) return 'Must be at most 40 characters';
  if (!/^[a-z]/.test(value)) return 'Must start with a letter (a-z)';
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    return 'Must be lowercase kebab-case (letters, digits, hyphens)';
  }
  if (RESERVED.has(value)) return `"${value}" is a reserved WordPress slug`;
  return null;
}
```

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/validate-name.test.mjs`
Expected: All 6 tests pass.

**Step 5: Commit**

```bash
git add scripts/init/validate-name.mjs tests/init/unit/validate-name.test.mjs
git commit -m "feat(init): add project name validator (#21)"
```

---

### Task 4: Implement and test `slugify.mjs`

Derives a default slug from a directory basename (for `--yes` defaults).

**Files:**
- Create: `scripts/init/slugify.mjs`
- Test: `tests/init/unit/slugify.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/slugify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, titleCase } from '../../../scripts/init/slugify.mjs';

test('slugify lowercases and dashes', () => {
  assert.equal(slugify('My Shop'), 'my-shop');
  assert.equal(slugify('Hello_World'), 'hello-world');
  assert.equal(slugify('  Spaces  '), 'spaces');
});

test('slugify drops disallowed chars', () => {
  assert.equal(slugify('café!'), 'caf');
  assert.equal(slugify('site/v1.0'), 'site-v1-0');
});

test('slugify collapses multiple dashes', () => {
  assert.equal(slugify('a--b---c'), 'a-b-c');
  assert.equal(slugify('--foo--'), 'foo');
});

test('titleCase splits on hyphens', () => {
  assert.equal(titleCase('my-shop'), 'My Shop');
  assert.equal(titleCase('hello-world-site'), 'Hello World Site');
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/slugify.test.mjs`
Expected: Module-not-found.

**Step 3: Implement**

```js
// scripts/init/slugify.mjs
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function titleCase(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
```

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/slugify.test.mjs`

**Step 5: Commit**

```bash
git add scripts/init/slugify.mjs tests/init/unit/slugify.test.mjs
git commit -m "feat(init): add slugify/titleCase helpers (#21)"
```

---

### Task 5: Implement and test `default-resolver.mjs`

Fills missing CLI flags from sensible defaults so `--yes` mode never blocks.

**Files:**
- Create: `scripts/init/default-resolver.mjs`
- Test: `tests/init/unit/default-resolver.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/default-resolver.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDefaults } from '../../../scripts/init/default-resolver.mjs';

test('all defaults when flags empty', () => {
  const cfg = resolveDefaults({}, { cwdBasename: 'my-site', gitEmail: 'a@b.c' });
  assert.equal(cfg.projectName, 'my-site');
  assert.equal(cfg.siteTitle, 'My Site');
  assert.equal(cfg.themeStarter, 'blank');
  assert.equal(cfg.woocommerce, false);
  assert.equal(cfg.port, 8080);
  assert.equal(cfg.adminEmail, 'a@b.c');
  assert.equal(cfg.initGit, true);
});

test('flag overrides win over defaults', () => {
  const cfg = resolveDefaults(
    { name: 'shop', theme: 'flavian-shop', port: 9000 },
    { cwdBasename: 'ignored', gitEmail: null }
  );
  assert.equal(cfg.projectName, 'shop');
  assert.equal(cfg.themeStarter, 'flavian-shop');
  assert.equal(cfg.port, 9000);
});

test('woocommerce forced true when theme = flavian-shop', () => {
  const cfg = resolveDefaults(
    { theme: 'flavian-shop', woo: false },
    { cwdBasename: 'x', gitEmail: null }
  );
  assert.equal(cfg.woocommerce, true);
});

test('adminEmail falls back to admin@example.com when no git email', () => {
  const cfg = resolveDefaults({}, { cwdBasename: 'x', gitEmail: null });
  assert.equal(cfg.adminEmail, 'admin@example.com');
});

test('noGit flag flips initGit', () => {
  const cfg = resolveDefaults({ noGit: true }, { cwdBasename: 'x', gitEmail: null });
  assert.equal(cfg.initGit, false);
});

test('invalid theme value throws', () => {
  assert.throws(
    () => resolveDefaults({ theme: 'nonsense' }, { cwdBasename: 'x', gitEmail: null }),
    /unknown theme/i
  );
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/default-resolver.test.mjs`

**Step 3: Implement**

```js
// scripts/init/default-resolver.mjs
import { slugify, titleCase } from './slugify.mjs';

const VALID_THEMES = ['blank', 'flavian-shop', 'figma', 'indesign'];

export function resolveDefaults(flags, env) {
  const projectName = flags.name
    ? slugify(flags.name)
    : slugify(env.cwdBasename || 'flavian-site');

  const themeStarter = flags.theme ?? 'blank';
  if (!VALID_THEMES.includes(themeStarter)) {
    throw new Error(`Unknown theme starter: ${themeStarter} (expected one of ${VALID_THEMES.join(', ')})`);
  }

  const woocommerce = themeStarter === 'flavian-shop' ? true : Boolean(flags.woo);

  return {
    projectName,
    siteTitle: flags.title ?? titleCase(projectName),
    themeStarter,
    woocommerce,
    port: Number.isInteger(flags.port) ? flags.port : 8080,
    adminEmail: flags.email ?? env.gitEmail ?? 'admin@example.com',
    initGit: !flags.noGit,
  };
}
```

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/default-resolver.test.mjs`

**Step 5: Commit**

```bash
git add scripts/init/default-resolver.mjs scripts/init/slugify.mjs tests/init/unit/default-resolver.test.mjs
git commit -m "feat(init): add default resolver for non-interactive mode (#21)"
```

---

### Task 6: Implement and test `token-substitute.mjs`

Walks a directory and replaces `{{TOKEN}}` placeholders in text files. Skips binaries by extension.

**Files:**
- Create: `scripts/init/token-substitute.mjs`
- Test: `tests/init/unit/token-substitute.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/token-substitute.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { substituteTokens } from '../../../scripts/init/token-substitute.mjs';

async function setupTmp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'tok-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, content);
  }
  return dir;
}

test('replaces tokens in text files', async (t) => {
  const dir = await setupTmp({
    'style.css': '/* Theme Name: {{THEME_NAME}} */',
    'theme.json': '{"title":"{{SITE_TITLE}}"}',
    'sub/index.html': '<title>{{SITE_TITLE}}</title>',
  });
  t.after(() => rm(dir, { recursive: true, force: true }));

  await substituteTokens(dir, {
    THEME_NAME: 'My Shop',
    SITE_TITLE: 'My Shop',
    THEME_SLUG: 'my-shop',
  });

  assert.equal(await readFile(join(dir, 'style.css'), 'utf8'), '/* Theme Name: My Shop */');
  assert.equal(await readFile(join(dir, 'theme.json'), 'utf8'), '{"title":"My Shop"}');
  assert.equal(await readFile(join(dir, 'sub/index.html'), 'utf8'), '<title>My Shop</title>');
});

test('skips binary file extensions', async (t) => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const dir = await setupTmp({ 'logo.png': png });
  t.after(() => rm(dir, { recursive: true, force: true }));

  await substituteTokens(dir, { THEME_NAME: 'X' });

  const after = await readFile(join(dir, 'logo.png'));
  assert.deepEqual(after, png);
});

test('throws on unknown token (defensive)', async (t) => {
  const dir = await setupTmp({ 'a.txt': 'has {{UNKNOWN}} token' });
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.rejects(
    () => substituteTokens(dir, { THEME_NAME: 'x' }),
    /unknown token.*UNKNOWN/i
  );
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/token-substitute.test.mjs`

**Step 3: Implement**

```js
// scripts/init/token-substitute.mjs
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz',
]);

const TOKEN_RE = /\{\{([A-Z_]+)\}\}/g;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export async function substituteTokens(rootDir, tokens) {
  const files = await walk(rootDir);
  for (const file of files) {
    if (BINARY_EXTS.has(extname(file).toLowerCase())) continue;
    const raw = await readFile(file, 'utf8');
    if (!raw.includes('{{')) continue;
    const replaced = raw.replace(TOKEN_RE, (full, key) => {
      if (!(key in tokens)) {
        throw new Error(`Unknown token {{${key}}} in ${file}`);
      }
      return tokens[key];
    });
    if (replaced !== raw) await writeFile(file, replaced);
  }
}
```

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/token-substitute.test.mjs`
Expected: All 3 tests pass.

**Step 5: Commit**

```bash
git add scripts/init/token-substitute.mjs tests/init/unit/token-substitute.test.mjs
git commit -m "feat(init): add token substitution helper (#21)"
```

---

### Task 7: Create the blank FSE theme template

A minimal, valid FSE theme used by the `blank` starter. Files in `.claude/templates/theme/` use `{{TOKEN}}` placeholders.

**Files:**
- Create: `.claude/templates/theme/style.css`
- Create: `.claude/templates/theme/theme.json`
- Create: `.claude/templates/theme/templates/index.html`
- Create: `.claude/templates/theme/templates/page.html`
- Create: `.claude/templates/theme/templates/single.html`
- Create: `.claude/templates/theme/parts/header.html`
- Create: `.claude/templates/theme/parts/footer.html`
- Create: `.claude/templates/theme/functions.php`

**Step 1: Write `style.css`**

```css
/*
Theme Name: {{THEME_NAME}}
Description: A blank Full Site Editing theme scaffolded by Flavian.
Version: 0.1.0
Requires at least: 6.5
Tested up to: 6.7
Requires PHP: 7.4
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: {{THEME_SLUG}}
*/
```

**Step 2: Write `theme.json`**

```json
{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 3,
  "title": "{{THEME_NAME}}",
  "settings": {
    "appearanceTools": true,
    "color": {
      "palette": [
        { "slug": "primary", "name": "Primary", "color": "#111827" },
        { "slug": "accent", "name": "Accent", "color": "#2563eb" },
        { "slug": "surface", "name": "Surface", "color": "#ffffff" }
      ]
    },
    "typography": {
      "fontFamilies": [
        {
          "slug": "system",
          "name": "System",
          "fontFamily": "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        }
      ]
    },
    "layout": {
      "contentSize": "720px",
      "wideSize": "1200px"
    }
  },
  "styles": {
    "color": { "background": "var(--wp--preset--color--surface)", "text": "var(--wp--preset--color--primary)" },
    "typography": { "fontFamily": "var(--wp--preset--font-family--system)", "lineHeight": "1.6" }
  },
  "templateParts": [
    { "name": "header", "title": "Header", "area": "header" },
    { "name": "footer", "title": "Footer", "area": "footer" }
  ]
}
```

**Step 3: Write `templates/index.html`**

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->
<main class="wp-block-group">
  <!-- wp:query {"queryId":1,"query":{"perPage":10,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","inherit":true}} -->
  <div class="wp-block-query">
    <!-- wp:post-template -->
      <!-- wp:post-title {"isLink":true} /-->
      <!-- wp:post-excerpt /-->
    <!-- /wp:post-template -->
  </div>
  <!-- /wp:query -->
</main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

**Step 4: Write `templates/page.html`**

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->
<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->
<main class="wp-block-group">
  <!-- wp:post-title {"level":1} /-->
  <!-- wp:post-content /-->
</main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

**Step 5: Write `templates/single.html`**

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->
<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->
<main class="wp-block-group">
  <!-- wp:post-title {"level":1} /-->
  <!-- wp:post-date /-->
  <!-- wp:post-content /-->
</main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

**Step 6: Write `parts/header.html`**

```html
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">
  <!-- wp:site-title /-->
  <!-- wp:navigation /-->
</div>
<!-- /wp:group -->
```

**Step 7: Write `parts/footer.html`**

```html
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">
  <!-- wp:paragraph -->
  <p>© {{SITE_TITLE}}</p>
  <!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
```

**Step 8: Write `functions.php`**

```php
<?php
/**
 * {{THEME_NAME}} theme functions.
 *
 * @package {{THEME_SLUG}}
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'after_setup_theme', static function () {
    add_theme_support( 'wp-block-styles' );
    add_theme_support( 'editor-styles' );
    add_theme_support( 'responsive-embeds' );
} );
```

**Step 9: Sanity-check JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude/templates/theme/theme.json','utf8'))"`
Expected: No output (exit 0).

**Step 10: Commit**

```bash
git add .claude/templates/theme
git commit -m "feat(init): add blank FSE theme template for wizard (#21)"
```

---

### Task 8: Implement and test `generators/env.mjs`

Writes `.env` for the scaffolded project from `.env.example`, substituting wizard values.

**Files:**
- Create: `scripts/init/generators/env.mjs`
- Test: `tests/init/unit/env-generator.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/env-generator.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeEnv } from '../../../scripts/init/generators/env.mjs';

test('writes .env with substituted values', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'env-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await writeFile(join(dir, '.env.example'), [
    'WORDPRESS_DB_NAME=wordpress',
    'WP_ADMIN_EMAIL=you@example.com',
    'WC_DEFAULT_THEME=flavian-shop',
  ].join('\n'));

  await writeEnv(dir, {
    projectName: 'my-shop',
    siteTitle: 'My Shop',
    adminEmail: 'admin@my-shop.test',
    port: 9090,
    themeStarter: 'flavian-shop',
  });

  const env = await readFile(join(dir, '.env'), 'utf8');
  assert.match(env, /WORDPRESS_DB_NAME=my-shop/);
  assert.match(env, /WP_ADMIN_EMAIL=admin@my-shop\.test/);
  assert.match(env, /WC_DEFAULT_THEME=my-shop/);
  assert.match(env, /WP_PORT=9090/);
  assert.match(env, /WP_SITE_TITLE=My Shop/);
});

test('throws if .env.example missing', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'env-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.rejects(
    () => writeEnv(dir, { projectName: 'x', siteTitle: 'X', adminEmail: 'a@b.c', port: 8080, themeStarter: 'blank' }),
    /\.env\.example not found/i
  );
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/env-generator.test.mjs`

**Step 3: Implement**

```js
// scripts/init/generators/env.mjs
import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

export async function writeEnv(targetDir, config) {
  const examplePath = join(targetDir, '.env.example');
  try {
    await access(examplePath, constants.R_OK);
  } catch {
    throw new Error(`.env.example not found in ${targetDir}`);
  }

  const lines = (await readFile(examplePath, 'utf8')).split(/\r?\n/);
  const overrides = {
    WORDPRESS_DB_NAME: config.projectName,
    WP_ADMIN_EMAIL: config.adminEmail,
    WP_SITE_TITLE: config.siteTitle,
    WP_PORT: String(config.port),
    WC_DEFAULT_THEME: config.projectName,
  };

  const seen = new Set();
  const out = lines.map(line => {
    const m = /^([A-Z_]+)=/.exec(line);
    if (!m) return line;
    seen.add(m[1]);
    return overrides[m[1]] != null ? `${m[1]}=${overrides[m[1]]}` : line;
  });

  for (const [key, value] of Object.entries(overrides)) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }

  await writeFile(join(targetDir, '.env'), out.join('\n') + '\n');
}
```

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/env-generator.test.mjs`

**Step 5: Commit**

```bash
git add scripts/init/generators/env.mjs tests/init/unit/env-generator.test.mjs
git commit -m "feat(init): add .env generator (#21)"
```

---

### Task 9: Implement and test `generators/theme.mjs`

Materializes the chosen theme starter into `themes/<slug>/`.

**Files:**
- Create: `scripts/init/generators/theme.mjs`
- Test: `tests/init/unit/theme-generator.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/theme-generator.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm, cp } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupTheme } from '../../../scripts/init/generators/theme.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

async function setupTarget() {
  const dir = await mkdtemp(join(tmpdir(), 'theme-'));
  await mkdir(join(dir, '.claude/templates/theme'), { recursive: true });
  await cp(join(REPO_ROOT, '.claude/templates/theme'), join(dir, '.claude/templates/theme'), { recursive: true });
  return dir;
}

test('blank starter writes themes/<slug>/ with substituted tokens', async (t) => {
  const dir = await setupTarget();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await setupTheme(dir, { themeStarter: 'blank', projectName: 'foo-shop', siteTitle: 'Foo Shop' });

  const style = await readFile(join(dir, 'themes/foo-shop/style.css'), 'utf8');
  assert.match(style, /Theme Name: Foo Shop/);
  assert.match(style, /Text Domain: foo-shop/);

  const json = JSON.parse(await readFile(join(dir, 'themes/foo-shop/theme.json'), 'utf8'));
  assert.equal(json.title, 'Foo Shop');
});

test('figma starter writes only a NEXT-STEPS.md, no theme dir', async (t) => {
  const dir = await setupTarget();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await setupTheme(dir, { themeStarter: 'figma', projectName: 'foo', siteTitle: 'Foo' });

  await assert.rejects(() => access(join(dir, 'themes/foo'), constants.F_OK));
  const next = await readFile(join(dir, 'docs/NEXT-STEPS.md'), 'utf8');
  assert.match(next, /figma-to-fse-autonomous-workflow/);
});

test('indesign starter notes the pipeline is not yet implemented', async (t) => {
  const dir = await setupTarget();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await setupTheme(dir, { themeStarter: 'indesign', projectName: 'foo', siteTitle: 'Foo' });

  const next = await readFile(join(dir, 'docs/NEXT-STEPS.md'), 'utf8');
  assert.match(next, /not yet implemented/i);
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/theme-generator.test.mjs`

**Step 3: Implement**

```js
// scripts/init/generators/theme.mjs
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { substituteTokens } from '../token-substitute.mjs';

const NEXT_STEPS = {
  figma: `# Next Steps — Figma Import

Your project is staged for the Figma → FSE pipeline.

1. Place your Figma URL or export in this repository.
2. Run the \`figma-to-fse-autonomous-workflow\` skill in Claude Code:
   > "Convert this Figma design to WordPress" (with your Figma URL)
3. The generated theme will be written to \`themes/{{THEME_SLUG}}/\`.
`,
  indesign: `# Next Steps — InDesign Import

The InDesign-to-FSE pipeline is not yet implemented.

For now, manually convert your InDesign export to HTML/CSS, then either:
- Place output in \`themes/{{THEME_SLUG}}/\` as a hand-built FSE theme, or
- Adapt the \`canva-to-fse-autonomous-workflow\` (similar HTML/CSS source).
`,
};

async function copyBlank(targetDir, slug) {
  const src = join(targetDir, '.claude/templates/theme');
  const dst = join(targetDir, 'themes', slug);
  await mkdir(dst, { recursive: true });
  await cp(src, dst, { recursive: true });
}

async function copyFlavianShop(targetDir, slug) {
  const src = join(targetDir, 'themes/flavian-shop');
  try {
    await access(src, constants.R_OK);
  } catch {
    throw new Error('themes/flavian-shop/ not found — template repo is incomplete');
  }
  const dst = join(targetDir, 'themes', slug);
  await mkdir(dst, { recursive: true });
  await cp(src, dst, { recursive: true });
}

async function writeNextSteps(targetDir, kind, slug) {
  const docsDir = join(targetDir, 'docs');
  await mkdir(docsDir, { recursive: true });
  const body = NEXT_STEPS[kind].replaceAll('{{THEME_SLUG}}', slug);
  await writeFile(join(docsDir, 'NEXT-STEPS.md'), body);
}

async function rewriteFlavianShopHeaders(targetDir, slug, title) {
  const styleFile = join(targetDir, 'themes', slug, 'style.css');
  let css = await readFile(styleFile, 'utf8');
  css = css.replace(/^Theme Name:.*$/m, `Theme Name: ${title}`);
  css = css.replace(/^Text Domain:.*$/m, `Text Domain: ${slug}`);
  await writeFile(styleFile, css);

  const jsonFile = join(targetDir, 'themes', slug, 'theme.json');
  try {
    const json = JSON.parse(await readFile(jsonFile, 'utf8'));
    json.title = title;
    await writeFile(jsonFile, JSON.stringify(json, null, 2) + '\n');
  } catch {
    // theme.json may not exist in some shop variants; skip silently
  }
}

export async function setupTheme(targetDir, config) {
  const { themeStarter, projectName, siteTitle } = config;
  const slug = projectName;

  switch (themeStarter) {
    case 'blank':
      await copyBlank(targetDir, slug);
      await substituteTokens(join(targetDir, 'themes', slug), {
        THEME_NAME: siteTitle,
        THEME_SLUG: slug,
        SITE_TITLE: siteTitle,
      });
      break;
    case 'flavian-shop':
      await copyFlavianShop(targetDir, slug);
      await rewriteFlavianShopHeaders(targetDir, slug, siteTitle);
      break;
    case 'figma':
    case 'indesign':
      await writeNextSteps(targetDir, themeStarter, slug);
      break;
    default:
      throw new Error(`Unknown theme starter: ${themeStarter}`);
  }
}
```

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/theme-generator.test.mjs`
Expected: 3 tests pass.

**Step 5: Commit**

```bash
git add scripts/init/generators/theme.mjs tests/init/unit/theme-generator.test.mjs
git commit -m "feat(init): add theme generator with 4 starters (#21)"
```

---

### Task 10: Implement and test `generators/woocommerce.mjs`

If WooCommerce is selected but the theme isn't flavian-shop, stage `setup-woocommerce.sh` as a post-install hook (the existing compose profile already handles the install).

**Files:**
- Create: `scripts/init/generators/woocommerce.mjs`
- Test: `tests/init/unit/woocommerce-generator.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/woocommerce-generator.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupWooCommerce } from '../../../scripts/init/generators/woocommerce.mjs';

test('no-op when woocommerce disabled', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'woo-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await setupWooCommerce(dir, { woocommerce: false, themeStarter: 'blank', projectName: 'x' });

  await assert.rejects(() => access(join(dir, 'scripts/wordpress-install/post-install.d'), constants.F_OK));
});

test('no-op when theme = flavian-shop (already wired)', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'woo-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await setupWooCommerce(dir, { woocommerce: true, themeStarter: 'flavian-shop', projectName: 'x' });

  await assert.rejects(() => access(join(dir, 'scripts/wordpress-install/post-install.d'), constants.F_OK));
});

test('writes hook when woo + blank theme', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'woo-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await setupWooCommerce(dir, { woocommerce: true, themeStarter: 'blank', projectName: 'shop' });

  const hook = await readFile(join(dir, 'scripts/wordpress-install/post-install.d/10-woocommerce.sh'), 'utf8');
  assert.match(hook, /setup-woocommerce\.sh/);
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/woocommerce-generator.test.mjs`

**Step 3: Implement**

```js
// scripts/init/generators/woocommerce.mjs
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';

const HOOK = `#!/usr/bin/env bash
# Auto-generated by Flavian init wizard.
# Runs the WooCommerce setup against the dev container after WP installs.
set -euo pipefail
cd "$(dirname "$0")/../../.."
./scripts/wordpress-install/setup-woocommerce.sh "$@"
`;

export async function setupWooCommerce(targetDir, config) {
  if (!config.woocommerce) return;
  if (config.themeStarter === 'flavian-shop') return;

  const dir = join(targetDir, 'scripts/wordpress-install/post-install.d');
  await mkdir(dir, { recursive: true });
  const hookPath = join(dir, '10-woocommerce.sh');
  await writeFile(hookPath, HOOK);
  await chmod(hookPath, 0o755);
}
```

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/woocommerce-generator.test.mjs`

**Step 5: Commit**

```bash
git add scripts/init/generators/woocommerce.mjs tests/init/unit/woocommerce-generator.test.mjs
git commit -m "feat(init): stage WooCommerce post-install hook when requested (#21)"
```

---

### Task 11: Implement and test `generators/git.mjs`

Removes the template's `.git` history and creates a fresh repo with an initial commit. Skipped via `config.initGit = false`.

**Files:**
- Create: `scripts/init/generators/git.mjs`
- Test: `tests/init/unit/git-generator.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/git-generator.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initGit } from '../../../scripts/init/generators/git.mjs';

const exec = promisify(execFile);

test('skipped when initGit false', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'git-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await initGit(dir, { initGit: false });
  await assert.rejects(() => access(join(dir, '.git'), constants.F_OK));
});

test('initialises fresh repo with one commit', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'git-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'README.md'), '# test\n');

  await initGit(dir, { initGit: true, projectName: 'test-site' });

  await access(join(dir, '.git'), constants.F_OK);
  const { stdout } = await exec('git', ['log', '--oneline'], { cwd: dir });
  assert.match(stdout, /chore: initial Flavian scaffold/);
});

test('replaces existing .git from template', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'git-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, '.git'), { recursive: true });
  await writeFile(join(dir, '.git/old-marker'), 'leftover');
  await writeFile(join(dir, 'README.md'), '# test\n');

  await initGit(dir, { initGit: true, projectName: 'test-site' });

  await assert.rejects(() => access(join(dir, '.git/old-marker'), constants.F_OK));
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/git-generator.test.mjs`

**Step 3: Implement**

```js
// scripts/init/generators/git.mjs
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function initGit(targetDir, config) {
  if (!config.initGit) return;

  await rm(join(targetDir, '.git'), { recursive: true, force: true });
  await exec('git', ['init', '-b', 'main'], { cwd: targetDir });
  await exec('git', ['add', '-A'], { cwd: targetDir });
  await exec(
    'git',
    ['commit', '-m', 'chore: initial Flavian scaffold', '--no-verify'],
    {
      cwd: targetDir,
      env: { ...process.env, GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'Flavian Init', GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'init@flavian.local', GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'Flavian Init', GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'init@flavian.local' },
    }
  );
}
```

> **Note on `--no-verify`:** the user's saved feedback forbids `--no-verify` *for their own commits*. The initial scaffold commit is generated by the wizard, runs in the freshly-created project (which has no hooks yet), and `--no-verify` here is solely belt-and-braces to avoid surprise hook execution. Document this in the user docs (Task 14).

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/git-generator.test.mjs`

**Step 5: Commit**

```bash
git add scripts/init/generators/git.mjs tests/init/unit/git-generator.test.mjs
git commit -m "feat(init): add git initialisation generator (#21)"
```

---

### Task 12: Implement and test `verifier.mjs`

Runs static checks against the scaffolded project; fails fast with remediation hints.

**Files:**
- Create: `scripts/init/verifier.mjs`
- Test: `tests/init/unit/verifier.test.mjs`

**Step 1: Write the failing test**

```js
// tests/init/unit/verifier.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verify } from '../../../scripts/init/verifier.mjs';

async function scaffoldOk(slug) {
  const dir = await mkdtemp(join(tmpdir(), 'verify-'));
  await writeFile(join(dir, '.env'), 'WORDPRESS_DB_NAME=x\n');
  await mkdir(join(dir, 'themes', slug, 'templates'), { recursive: true });
  await writeFile(join(dir, 'themes', slug, 'style.css'), '/* Theme Name: X */');
  await writeFile(join(dir, 'themes', slug, 'theme.json'), '{"version":3}');
  await writeFile(join(dir, 'themes', slug, 'templates', 'index.html'), '');
  return dir;
}

test('passes for a valid blank scaffold', async (t) => {
  const dir = await scaffoldOk('foo');
  t.after(() => rm(dir, { recursive: true, force: true }));

  const result = await verify(dir, { projectName: 'foo', themeStarter: 'blank' });
  assert.equal(result.ok, true, JSON.stringify(result.failures));
});

test('skips theme checks for figma/indesign placeholders', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'verify-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, '.env'), 'X=1\n');

  const result = await verify(dir, { projectName: 'foo', themeStarter: 'figma' });
  assert.equal(result.ok, true);
});

test('fails when theme.json is invalid JSON', async (t) => {
  const dir = await scaffoldOk('foo');
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'themes/foo/theme.json'), '{not json');

  const result = await verify(dir, { projectName: 'foo', themeStarter: 'blank' });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some(f => /theme\.json/.test(f.check)));
});

test('fails when .env missing', async (t) => {
  const dir = await scaffoldOk('foo');
  t.after(() => rm(dir, { recursive: true, force: true }));
  await rm(join(dir, '.env'));

  const result = await verify(dir, { projectName: 'foo', themeStarter: 'blank' });
  assert.equal(result.ok, false);
});
```

**Step 2: Run test, confirm it fails**

Run: `node --test tests/init/unit/verifier.test.mjs`

**Step 3: Implement**

```js
// scripts/init/verifier.mjs
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function checkJson(file) {
  const raw = await readFile(file, 'utf8');
  JSON.parse(raw); // throws on bad JSON
}

export async function verify(targetDir, config) {
  const failures = [];
  const themeDir = join(targetDir, 'themes', config.projectName);
  const skipsTheme = config.themeStarter === 'figma' || config.themeStarter === 'indesign';

  const checks = [];

  checks.push({
    name: '.env present',
    run: async () => {
      if (!await pathExists(join(targetDir, '.env'))) {
        throw new Error('Run the wizard again — .env was not written');
      }
      const stat = await readFile(join(targetDir, '.env'), 'utf8');
      if (stat.trim() === '') throw new Error('.env is empty');
    },
  });

  if (!skipsTheme) {
    checks.push(
      {
        name: 'theme.json is valid JSON',
        run: () => checkJson(join(themeDir, 'theme.json')),
      },
      {
        name: 'theme has style.css',
        run: async () => {
          if (!await pathExists(join(themeDir, 'style.css'))) {
            throw new Error('Missing themes/<slug>/style.css');
          }
        },
      },
      {
        name: 'theme has templates/index.html',
        run: async () => {
          if (!await pathExists(join(themeDir, 'templates/index.html'))) {
            throw new Error('Missing themes/<slug>/templates/index.html');
          }
        },
      },
    );
  }

  for (const check of checks) {
    try { await check.run(); }
    catch (err) { failures.push({ check: check.name, reason: err.message }); }
  }

  return { ok: failures.length === 0, failures };
}
```

**Step 4: Run tests, confirm they pass**

Run: `node --test tests/init/unit/verifier.test.mjs`

**Step 5: Commit**

```bash
git add scripts/init/verifier.mjs tests/init/unit/verifier.test.mjs
git commit -m "feat(init): add static scaffold verifier (#21)"
```

---

### Task 13: Implement the main `scripts/init.mjs` (orchestrator + prompts)

Wires everything together: arg parsing, prompts (when not `--yes`), apply phase, output banner.

**Files:**
- Create: `scripts/init.mjs`
- Create: `scripts/init/prompts.mjs`
- Create: `scripts/init/apply.mjs`

**Step 1: Implement `scripts/init/apply.mjs`** (pure orchestration of generators)

```js
// scripts/init/apply.mjs
import { writeEnv } from './generators/env.mjs';
import { setupTheme } from './generators/theme.mjs';
import { setupWooCommerce } from './generators/woocommerce.mjs';
import { initGit } from './generators/git.mjs';
import { verify } from './verifier.mjs';

export async function apply(targetDir, config, logger = console.log) {
  const steps = [
    { name: '.env',         run: () => writeEnv(targetDir, config) },
    { name: 'theme',        run: () => setupTheme(targetDir, config) },
    { name: 'woocommerce',  run: () => setupWooCommerce(targetDir, config) },
    { name: 'git',          run: () => initGit(targetDir, config) },
  ];

  for (const step of steps) {
    await step.run();
    logger(`✓ ${step.name}`);
  }

  const result = await verify(targetDir, config);
  if (!result.ok) {
    for (const f of result.failures) logger(`✗ ${f.check}: ${f.reason}`);
    throw new Error('Verification failed');
  }
  for (const c of result.ok ? ['verify'] : []) logger(`✓ ${c}`);
}
```

**Step 2: Implement `scripts/init/prompts.mjs`** (clack wrapper)

```js
// scripts/init/prompts.mjs
import { intro, outro, text, select, confirm, isCancel, cancel } from '@clack/prompts';
import { validateProjectName } from './validate-name.mjs';
import { slugify, titleCase } from './slugify.mjs';

function abortIfCancelled(value) {
  if (isCancel(value)) {
    cancel('Cancelled — no files written.');
    process.exit(130);
  }
  return value;
}

export async function runPrompts({ cwdBasename, gitEmail }) {
  intro('Flavian — interactive project setup');

  const projectName = abortIfCancelled(await text({
    message: 'Project / theme slug',
    placeholder: slugify(cwdBasename),
    defaultValue: slugify(cwdBasename),
    validate: v => validateProjectName(v) ?? undefined,
  }));

  const siteTitle = abortIfCancelled(await text({
    message: 'Site title (human-readable)',
    placeholder: titleCase(projectName),
    defaultValue: titleCase(projectName),
  }));

  const themeStarter = abortIfCancelled(await select({
    message: 'Theme starter',
    options: [
      { value: 'blank',        label: 'Blank FSE theme' },
      { value: 'flavian-shop', label: 'flavian-shop (WooCommerce-ready)' },
      { value: 'figma',        label: 'Figma import placeholder' },
      { value: 'indesign',     label: 'InDesign import placeholder (not yet implemented)' },
    ],
  }));

  let woocommerce = themeStarter === 'flavian-shop';
  if (!woocommerce) {
    woocommerce = abortIfCancelled(await confirm({
      message: 'Enable WooCommerce support?',
      initialValue: false,
    }));
  }

  const port = abortIfCancelled(await text({
    message: 'Local dev port',
    placeholder: '8080',
    defaultValue: '8080',
    validate: v => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1024 || n > 65535) return 'Port must be 1024–65535';
    },
  }));

  const adminEmail = abortIfCancelled(await text({
    message: 'Admin email',
    placeholder: gitEmail ?? 'admin@example.com',
    defaultValue: gitEmail ?? 'admin@example.com',
  }));

  const goAhead = abortIfCancelled(await confirm({ message: 'Proceed?', initialValue: true }));
  if (!goAhead) {
    cancel('Cancelled — no files written.');
    process.exit(130);
  }

  outro('Setting up your project…');

  return {
    projectName,
    siteTitle,
    themeStarter,
    woocommerce,
    port: Number(port),
    adminEmail,
    initGit: true,
  };
}
```

**Step 3: Implement `scripts/init.mjs`**

```js
// scripts/init.mjs
import { parseArgs } from 'node:util';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename } from 'node:path';
import { resolveDefaults } from './init/default-resolver.mjs';
import { apply } from './init/apply.mjs';
import { runPrompts } from './init/prompts.mjs';

const exec = promisify(execFile);

function usage() {
  console.log(`Usage: node scripts/init.mjs [options]

Options:
  --yes                 Non-interactive mode (uses defaults / flag values)
  --name <slug>         Project slug
  --theme <starter>     blank | flavian-shop | figma | indesign
  --woo                 Enable WooCommerce
  --port <n>            Local dev port (default 8080)
  --email <addr>        Admin email
  --no-git              Skip git init
  --help                Show this message
`);
}

async function getGitEmail() {
  try {
    const { stdout } = await exec('git', ['config', 'user.email']);
    return stdout.trim() || null;
  } catch { return null; }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        yes:    { type: 'boolean' },
        name:   { type: 'string' },
        theme:  { type: 'string' },
        woo:    { type: 'boolean' },
        port:   { type: 'string' },
        email:  { type: 'string' },
        'no-git': { type: 'boolean' },
        help:   { type: 'boolean' },
      },
      strict: true,
    });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    usage();
    process.exit(2);
  }

  if (parsed.values.help) { usage(); process.exit(0); }

  const flagPort = parsed.values.port != null ? Number(parsed.values.port) : undefined;
  if (parsed.values.port != null && (!Number.isInteger(flagPort) || flagPort < 1024 || flagPort > 65535)) {
    console.error('Error: --port must be an integer 1024–65535');
    process.exit(2);
  }

  const targetDir = process.cwd();
  const env = { cwdBasename: basename(targetDir), gitEmail: await getGitEmail() };

  let config;
  if (parsed.values.yes) {
    config = resolveDefaults({
      name: parsed.values.name,
      theme: parsed.values.theme,
      woo: parsed.values.woo,
      port: flagPort,
      email: parsed.values.email,
      noGit: parsed.values['no-git'],
    }, env);
  } else {
    config = await runPrompts(env);
    if (parsed.values['no-git']) config.initGit = false;
  }

  try {
    await apply(targetDir, config);
  } catch (err) {
    console.error(`\n✗ Setup failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`
✓ Project ready at ${targetDir}

Next steps:
  cd ${basename(targetDir)}
  cp .env.example .env       # already done — review values
  docker compose up -d        # boot WordPress at http://localhost:${config.port}
  open http://localhost:${config.port}/wp-admin

Resources:
  - Theme:   themes/${config.projectName}/
  - Docs:    CLAUDE.md, docs/QUICK-START.md
  - Skills:  .claude/skills/README.md
`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

**Step 4: Smoke test it in a throwaway dir**

```bash
TMP=$(mktemp -d)
cp -r .env.example .claude themes scripts package.json pnpm-lock.yaml $TMP
cd $TMP
node scripts/init.mjs --yes --no-git --name=smoke-site --theme=blank
ls themes/smoke-site/    # expect style.css, theme.json, templates/, parts/
cat .env | head -5
cd -
rm -rf $TMP
```

Expected: succeeds, prints `✓` for every step plus the "Next steps" banner.

**Step 5: Commit**

```bash
git add scripts/init.mjs scripts/init/apply.mjs scripts/init/prompts.mjs
git commit -m "feat(init): add main wizard orchestrator and prompt flow (#21)"
```

---

### Task 14: Add the integration smoke test

End-to-end run via `--yes --no-git` against each theme starter in a `mkdtemp` directory.

**Files:**
- Create: `tests/init/integration/smoke.test.mjs`

**Step 1: Write the test**

```js
// tests/init/integration/smoke.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, access, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

async function stageFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'init-smoke-'));
  for (const item of ['.env.example', '.claude', 'themes', 'scripts', 'package.json']) {
    await cp(join(REPO_ROOT, item), join(dir, item), { recursive: true });
  }
  return dir;
}

test('blank theme — full --yes run produces a verifiable scaffold', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const { stdout } = await exec('node', ['scripts/init.mjs', '--yes', '--no-git',
    '--name=smoke-blank', '--theme=blank', '--port=8090'], { cwd: dir });

  assert.match(stdout, /✓ \.env/);
  assert.match(stdout, /✓ theme/);

  await access(join(dir, 'themes/smoke-blank/style.css'), constants.F_OK);
  const env = await readFile(join(dir, '.env'), 'utf8');
  assert.match(env, /WP_PORT=8090/);
  assert.match(env, /WP_SITE_TITLE=Smoke Blank/);
});

test('flavian-shop theme — copies shop and rewrites headers', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await exec('node', ['scripts/init.mjs', '--yes', '--no-git',
    '--name=smoke-shop', '--theme=flavian-shop'], { cwd: dir });

  const style = await readFile(join(dir, 'themes/smoke-shop/style.css'), 'utf8');
  assert.match(style, /Theme Name: Smoke Shop/);
  assert.match(style, /Text Domain: smoke-shop/);
});

test('figma placeholder — writes NEXT-STEPS.md, no theme dir', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await exec('node', ['scripts/init.mjs', '--yes', '--no-git',
    '--name=smoke-figma', '--theme=figma'], { cwd: dir });

  const next = await readFile(join(dir, 'docs/NEXT-STEPS.md'), 'utf8');
  assert.match(next, /figma-to-fse-autonomous-workflow/);
  await assert.rejects(() => access(join(dir, 'themes/smoke-figma'), constants.F_OK));
});

test('--yes refuses an existing themes/<slug> dir cleanly', async (t) => {
  const dir = await stageFixture();
  t.after(() => rm(dir, { recursive: true, force: true }));

  // Pre-create the target theme dir
  await cp(join(REPO_ROOT, 'themes/flavian-shop'), join(dir, 'themes/dup-site'), { recursive: true });

  await assert.rejects(
    () => exec('node', ['scripts/init.mjs', '--yes', '--no-git',
      '--name=dup-site', '--theme=blank'], { cwd: dir }),
    { code: 1 }
  );
});
```

**Step 2: Make `setupTheme` refuse overwrites**

This test exposes a gap: `cp` will overwrite. Edit `scripts/init/generators/theme.mjs` — before the `cp` calls, add:

```js
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
// ...
async function refuseIfExists(dst) {
  try { await access(dst, constants.F_OK); }
  catch { return; }
  throw new Error(`Target already exists: ${dst} — remove it or pick a different slug`);
}
```

Call `await refuseIfExists(join(targetDir, 'themes', slug));` at the top of `copyBlank` and `copyFlavianShop`.

**Step 3: Run the integration suite**

Run: `node --test tests/init/integration/smoke.test.mjs`
Expected: 4 tests pass.

**Step 4: Run the full init test suite**

Run: `pnpm run test:init`
Expected: All unit + integration tests pass.

**Step 5: Commit**

```bash
git add tests/init/integration/smoke.test.mjs scripts/init/generators/theme.mjs
git commit -m "test(init): add integration smoke tests + refuse overwrites (#21)"
```

---

### Task 15: Wire composer `post-create-project-cmd`

So `composer create-project pmds/flavian my-site` runs the wizard at the end.

**Files:**
- Modify: `composer.json`

**Step 1: Add the hook**

In `composer.json`, inside `"scripts"`, add:

```json
"post-create-project-cmd": [
    "@php -r \"if (!is_file('node_modules/.pnpm-installed')) { echo 'Run `pnpm install` then `node scripts/init.mjs` to finish setup.\\n'; exit(0); }\"",
    "@php -r \"passthru('node scripts/init.mjs');\""
]
```

(The first line gracefully prints a hint if `pnpm install` hasn't run yet — the wizard needs `@clack/prompts`.)

**Step 2: Validate composer.json parses**

Run: `composer validate --no-check-publish`
Expected: `./composer.json is valid`.

**Step 3: Commit**

```bash
git add composer.json
git commit -m "feat(init): wire composer post-create-project-cmd to wizard (#21)"
```

---

### Task 16: Add a CI job for the init wizard

A dedicated GitHub Actions job runs `pnpm run test:init` on PRs.

**Files:**
- Modify or create: `.github/workflows/ci.yml` (or whatever exists)

**Step 1: Inspect existing workflows**

Run: `ls .github/workflows/`
If a single CI file exists, add a job. If multiple, pick the one running unit tests (likely `ci.yml` or `test.yml`).

**Step 2: Add the job**

Append to the workflow file (under `jobs:`):

```yaml
  init-wizard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test:init
```

**Step 3: Validate locally**

Run: `pnpm install --frozen-lockfile && pnpm run test:init`
Expected: All init tests pass.

**Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: run init wizard tests on PRs (#21)"
```

---

### Task 17: User-facing docs

A short page explaining how to run the wizard, the prompts, flags, and known limitations.

**Files:**
- Create: `docs/CLI-WIZARD.md`
- Modify: `README.md` (add a Quick Start link)

**Step 1: Write `docs/CLI-WIZARD.md`**

Include:
- One-line `npx` and `composer create-project` invocations (note `@pmds/create-flavian` is published separately — for now, clone and run `pnpm install && pnpm run init`).
- Prompt list (project name, site title, theme starter, WooCommerce, port, admin email).
- All `--yes` flags with their defaults.
- Note that the wizard's initial commit uses `--no-verify` because no hooks exist in the fresh repo yet — your own commits will run hooks as normal.
- Limitations: InDesign placeholder only, no Docker smoke test, won't re-run against an existing scaffold.

**Step 2: Add to README**

In `README.md`, near the top "Quick Start" section, add:

```markdown
## Quick Start

```bash
pnpm install
pnpm run init        # interactive wizard
# or non-interactive:
pnpm run init -- --yes --name=my-site --theme=blank
```

See [docs/CLI-WIZARD.md](docs/CLI-WIZARD.md) for the full flag reference.
```

**Step 3: Commit**

```bash
git add docs/CLI-WIZARD.md README.md
git commit -m "docs: add init wizard user guide and README quick start (#21)"
```

---

### Task 18: Final sweep — run everything

**Step 1: Run the full init test suite**

Run: `pnpm run test:init`
Expected: All unit + integration tests pass.

**Step 2: Run the existing validators**

Run:
```
./scripts/validate-agent-configs.sh
./scripts/wordpress/check-coding-standards.sh themes/flavian-shop || true
```
Expected: agent config validation passes. (PHPCS may warn — that's fine, we didn't change PHP.)

**Step 3: Manual interactive smoke**

```bash
TMP=$(mktemp -d)
cp -r .env.example .claude themes scripts package.json pnpm-lock.yaml $TMP
cd $TMP
pnpm install --frozen-lockfile=false   # one-off
node scripts/init.mjs                   # interactive — exercise every prompt
cd -
rm -rf $TMP
```

Expected: smooth flow, no crashes, generated project passes static verification.

**Step 4: Push and open PR**

Per your saved preferences (always push + PR when finishing a branch):

```bash
git push -u origin 21-create-interactive-cli-setup-wizard
gh pr create --title "feat: interactive CLI setup wizard (#21)" --body "$(cat <<'EOF'
## Summary
- New `scripts/init.mjs` wizard — interactive (clack) and `--yes` modes
- Four theme starters: blank FSE, flavian-shop, Figma placeholder, InDesign placeholder
- Auto-writes `.env`, scaffolds theme, stages WooCommerce, initial git commit
- Static verification: theme.json JSON validity, required files, `.env` present
- Unit + integration tests under `tests/init/`, new CI job
- Composer `post-create-project-cmd` runs the wizard at the end

Closes #21

## Test plan
- [ ] `pnpm run test:init` — all unit + integration tests pass
- [ ] Manual interactive run produces a valid blank scaffold
- [ ] `pnpm run init -- --yes --theme=flavian-shop` produces a WooCommerce-ready scaffold
- [ ] `pnpm run init -- --yes --theme=figma` writes only `docs/NEXT-STEPS.md`
- [ ] Re-running against an existing scaffold fails cleanly
- [ ] `composer validate --no-check-publish` passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope (not in this PR)

- Publishing the `@pmds/create-flavian` npm package (separate repo + release process).
- Docker smoke test in verification (slow, platform-fragile on Windows).
- `.claude/settings.json` mutation (idempotency risk).
- An actual InDesign-to-FSE pipeline.
- Re-running the wizard against an existing scaffold (currently refuses cleanly).
