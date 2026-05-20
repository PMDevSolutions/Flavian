import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, access, rm, cp } from 'node:fs/promises';
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

test('refuses to overwrite an existing theme dir', async (t) => {
  const dir = await setupTarget();
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'themes/foo-shop'), { recursive: true });

  await assert.rejects(
    () => setupTheme(dir, { themeStarter: 'blank', projectName: 'foo-shop', siteTitle: 'Foo Shop' }),
    /already exists/i
  );
});
