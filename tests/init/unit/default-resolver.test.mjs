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

test('multisite defaults to false', () => {
  const cfg = resolveDefaults({}, { cwdBasename: 'x', gitEmail: null });
  assert.equal(cfg.multisite, false);
});

test('--multisite enables multisite in subdirectory mode by default', () => {
  const cfg = resolveDefaults({ multisite: true }, { cwdBasename: 'x', gitEmail: null });
  assert.equal(cfg.multisite, true);
  assert.equal(cfg.multisiteMode, 'subdirectory');
});

test('--multisite-mode=subdomain is honoured', () => {
  const cfg = resolveDefaults(
    { multisite: true, multisiteMode: 'subdomain' },
    { cwdBasename: 'x', gitEmail: null }
  );
  assert.equal(cfg.multisiteMode, 'subdomain');
});

test('invalid multisite mode throws', () => {
  assert.throws(
    () => resolveDefaults(
      { multisite: true, multisiteMode: 'sideways' },
      { cwdBasename: 'x', gitEmail: null }
    ),
    /multisite mode/i
  );
});
