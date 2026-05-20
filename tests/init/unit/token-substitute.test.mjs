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
