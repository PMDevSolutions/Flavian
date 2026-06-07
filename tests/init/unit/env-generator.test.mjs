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

test('non-multisite run writes WP_MULTISITE=false and leaves MS_NETWORK_TITLE default', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'env-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await writeFile(join(dir, '.env.example'), [
    'WORDPRESS_DB_NAME=wordpress',
    'MS_NETWORK_TITLE=Flavian Network',
  ].join('\n'));

  await writeEnv(dir, {
    projectName: 'plain', siteTitle: 'Plain', adminEmail: 'a@b.c',
    port: 8080, themeStarter: 'blank', multisite: false, multisiteMode: 'subdirectory',
  });

  const env = await readFile(join(dir, '.env'), 'utf8');
  assert.match(env, /WP_MULTISITE=false/);
  assert.doesNotMatch(env, /WP_MULTISITE_MODE=/);
  assert.match(env, /MS_NETWORK_TITLE=Flavian Network/);
});

test('multisite run writes WP_MULTISITE, mode, and network title from siteTitle', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'env-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await writeFile(join(dir, '.env.example'), [
    'WORDPRESS_DB_NAME=wordpress',
    'MS_NETWORK_TITLE=Flavian Network',
  ].join('\n'));

  await writeEnv(dir, {
    projectName: 'my-network', siteTitle: 'My Network', adminEmail: 'a@b.c',
    port: 8080, themeStarter: 'blank', multisite: true, multisiteMode: 'subdirectory',
  });

  const env = await readFile(join(dir, '.env'), 'utf8');
  assert.match(env, /WP_MULTISITE=true/);
  assert.match(env, /WP_MULTISITE_MODE=subdirectory/);
  assert.match(env, /MS_NETWORK_TITLE=My Network/);
});

test('multisite subdomain mode is recorded', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'env-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await writeFile(join(dir, '.env.example'), 'WORDPRESS_DB_NAME=wordpress\n');

  await writeEnv(dir, {
    projectName: 'net', siteTitle: 'Net', adminEmail: 'a@b.c',
    port: 8080, themeStarter: 'blank', multisite: true, multisiteMode: 'subdomain',
  });

  const env = await readFile(join(dir, '.env'), 'utf8');
  assert.match(env, /WP_MULTISITE_MODE=subdomain/);
});

test('throws if .env.example missing', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'env-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.rejects(
    () => writeEnv(dir, { projectName: 'x', siteTitle: 'X', adminEmail: 'a@b.c', port: 8080, themeStarter: 'blank' }),
    /\.env\.example not found/i
  );
});
