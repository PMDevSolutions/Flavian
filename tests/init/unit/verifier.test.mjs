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
