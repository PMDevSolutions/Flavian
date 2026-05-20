import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
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
