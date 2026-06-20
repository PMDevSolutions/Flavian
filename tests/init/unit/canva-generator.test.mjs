import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, access, rm, cp } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  setupCanvaTheme,
  dedupeBySlug,
  luminance,
  pickContrastColors,
  mergeCanvaTokens,
  cleanConvertedBlocks,
  rewriteImageSrcs,
  packageName,
} from '../../../scripts/init/generators/canva.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURE = join(REPO_ROOT, 'tests/fixtures/canva/landing');

// --- pure helpers ---------------------------------------------------------

test('dedupeBySlug keeps the first entry per slug, preserving order', () => {
  const out = dedupeBySlug([
    { slug: '40', size: '12px' },
    { slug: '40', size: '16px' },
    { slug: '50', size: '24px' },
  ]);
  assert.deepEqual(out.map(x => x.size), ['12px', '24px']);
});

test('luminance ranks black < blue < white and rejects junk', () => {
  assert.ok(luminance('#000000') < luminance('#1f6feb'));
  assert.ok(luminance('#1f6feb') < luminance('#ffffff'));
  assert.equal(luminance('not-a-color'), null);
  assert.ok(luminance('#fff') > 200); // shorthand expands
});

test('pickContrastColors maps lightest→background, darkest→text', () => {
  const c = pickContrastColors([
    { slug: 'fg', color: '#1d1d1f' },
    { slug: 'brand', color: '#1f6feb' },
    { slug: 'bg', color: '#ffffff' },
  ]);
  assert.deepEqual(c, { backgroundSlug: 'bg', textSlug: 'fg' });
});

test('pickContrastColors returns null for <2 usable colors', () => {
  assert.equal(pickContrastColors([{ slug: 'only', color: '#123456' }]), null);
  assert.equal(pickContrastColors([]), null);
});

test('mergeCanvaTokens replaces tokens and rewrites dangling style refs', () => {
  const base = {
    version: 3,
    settings: {
      color: { palette: [{ slug: 'surface', color: '#fff', name: 'Surface' }] },
      typography: { fontFamilies: [{ slug: 'system', fontFamily: 'system-ui', name: 'System' }] },
    },
    styles: {
      color: { background: 'var(--wp--preset--color--surface)', text: 'var(--wp--preset--color--primary)' },
      typography: { fontFamily: 'var(--wp--preset--font-family--system)', lineHeight: '1.6' },
    },
  };
  const out = mergeCanvaTokens(base, {
    colors: [
      { slug: 'c-dark', color: '#111111', name: 'C1' },
      { slug: 'c-light', color: '#fefefe', name: 'C2' },
    ],
    fonts: [{ slug: 'inter', fontFamily: 'Inter', name: 'Inter' }],
    fontSizes: [{ slug: 'base', size: '16px', name: 'base' }],
    spacing: [{ slug: '40', size: '12px', name: 'Space 40' }],
  });

  // Tokens replaced.
  assert.deepEqual(out.settings.color.palette.map(c => c.slug), ['c-dark', 'c-light']);
  assert.equal(out.settings.typography.fontFamilies[0].slug, 'inter');
  assert.equal(out.settings.typography.fontSizes[0].slug, 'base');
  assert.equal(out.settings.spacing.spacingSizes[0].slug, '40');

  // Style refs point only at slugs that now exist (no dangling surface/primary/system).
  assert.equal(out.styles.color.background, 'var(--wp--preset--color--c-light)');
  assert.equal(out.styles.color.text, 'var(--wp--preset--color--c-dark)');
  assert.equal(out.styles.typography.fontFamily, 'var(--wp--preset--font-family--inter)');
  assert.equal(out.styles.typography.lineHeight, '1.6'); // preserved

  // Input not mutated.
  assert.equal(base.settings.color.palette[0].slug, 'surface');
});

test('mergeCanvaTokens leaves base untouched when no tokens extracted', () => {
  const base = { settings: { color: { palette: [{ slug: 'surface', color: '#fff' }] } }, styles: { color: { text: 'x' } } };
  const out = mergeCanvaTokens(base, { colors: [], fonts: [], fontSizes: [], spacing: [] });
  assert.deepEqual(out.settings.color.palette[0].slug, 'surface');
  assert.deepEqual(out.styles.color, { text: 'x' });
});

test('cleanConvertedBlocks strips leading HTML-document chrome', () => {
  const raw = [
    '<!DOCTYPE html>',
    '<head>',
    '<body>',
    '<!-- wp:heading {"level":1} -->',
    '<h1 class="wp-block-heading">Hi</h1>',
    '<!-- /wp:heading -->',
    '',
  ].join('\n');
  const out = cleanConvertedBlocks(raw);
  assert.ok(out.startsWith('<!-- wp:heading'));
  assert.doesNotMatch(out, /DOCTYPE|<head>|<body>/);
});

test('rewriteImageSrcs rewrites relative srcs and records assets, leaving URLs alone', () => {
  const input =
    '<img src="images/hero.jpg" alt="a" />\n' +
    '<img src="https://cdn.example/x.png" alt="b" />\n' +
    '<img src="/root.png" alt="c" />';
  const { markup, assets } = rewriteImageSrcs(input);
  assert.match(markup, /get_theme_file_uri\( 'assets\/images\/hero\.jpg' \)/);
  assert.match(markup, /src="https:\/\/cdn\.example\/x\.png"/); // untouched
  assert.match(markup, /src="\/root\.png"/);                    // untouched
  assert.deepEqual(assets, ['images/hero.jpg']);
});

test('packageName produces a PascalCase package token', () => {
  assert.equal(packageName('my-canva-shop'), 'MyCanvaShop');
  assert.equal(packageName('shop'), 'Shop');
});

// --- full generator against the committed fixture -------------------------

async function stageTarget() {
  const dir = await mkdtemp(join(tmpdir(), 'canva-gen-'));
  await mkdir(join(dir, '.claude/templates'), { recursive: true });
  await cp(join(REPO_ROOT, '.claude/templates/theme'), join(dir, '.claude/templates/theme'), { recursive: true });
  return dir;
}

test('setupCanvaTheme builds a working theme from the fixture export', async (t) => {
  const dir = await stageTarget();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await setupCanvaTheme(dir, {
    projectName: 'acme',
    siteTitle: 'Acme',
    canvaExport: FIXTURE,
  });

  const themeDir = join(dir, 'themes/acme');

  // Base scaffold present → satisfies the wizard verifier.
  await access(join(themeDir, 'style.css'), constants.F_OK);
  await access(join(themeDir, 'templates/index.html'), constants.F_OK);

  // theme.json: valid JSON carrying the Canva-extracted tokens.
  const themeJson = JSON.parse(await readFile(join(themeDir, 'theme.json'), 'utf8'));
  const hexes = themeJson.settings.color.palette.map(c => c.color);
  assert.ok(hexes.includes('#1f6feb'), 'extracted Canva brand color present');
  assert.ok(themeJson.settings.typography.fontFamilies.some(f => f.fontFamily === 'Inter'));
  assert.ok(themeJson.settings.typography.fontSizes.length >= 3);
  assert.ok(themeJson.settings.spacing.spacingSizes.length >= 3);
  // No duplicate spacing slugs survived the merge.
  const spacingSlugs = themeJson.settings.spacing.spacingSizes.map(s => s.slug);
  assert.equal(new Set(spacingSlugs).size, spacingSlugs.length);
  // Style refs resolve to existing palette slugs (lightest=bg, darkest=text).
  assert.match(themeJson.styles.color.background, /var\(--wp--preset--color--/);
  const paletteSlugs = new Set(themeJson.settings.color.palette.map(c => c.slug));
  for (const ref of [themeJson.styles.color.background, themeJson.styles.color.text]) {
    const slug = ref.match(/color--([^)]+)\)/)[1];
    assert.ok(paletteSlugs.has(slug), `style ref ${slug} exists in palette`);
  }

  // Content converted into a pattern, wired into front-page.html (pattern-first).
  const front = await readFile(join(themeDir, 'templates/front-page.html'), 'utf8');
  assert.match(front, /wp:pattern \{"slug":"acme\/canva-content"\}/);
  assert.doesNotMatch(front, /<\?php/, 'no PHP in HTML templates');

  const pattern = await readFile(join(themeDir, 'patterns/canva-content.php'), 'utf8');
  assert.match(pattern, /Slug:\s*acme\/canva-content/);
  assert.match(pattern, /Welcome to Acme/);
  assert.match(pattern, /get_theme_file_uri\( 'assets\/images\/hero\.jpg' \)/);

  // Referenced image copied into the theme.
  await access(join(themeDir, 'assets/images/hero.jpg'), constants.F_OK);

  // Bridge doc for the agent refinement pass.
  const next = await readFile(join(dir, 'docs/NEXT-STEPS.md'), 'utf8');
  assert.match(next, /canva-fse-converter/);
});

test('setupCanvaTheme fails clearly when the export directory is missing', async (t) => {
  const dir = await stageTarget();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.rejects(
    () => setupCanvaTheme(dir, { projectName: 'x', siteTitle: 'X', canvaExport: join(dir, 'nope') }),
    /export directory not found/i
  );
});
