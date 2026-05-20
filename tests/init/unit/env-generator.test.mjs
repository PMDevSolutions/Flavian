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
