import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toInitFlags } from '../../../src/core/init/init-flags';
import type { InitInput } from '../../../src/shared/types/init';

const base: InitInput = {
  name: 'my-site',
  title: '',
  theme: 'blank',
  canvaExport: '',
  woo: false,
  multisite: false,
  multisiteMode: 'subdirectory',
  port: 8080,
  email: '',
  git: true,
};

test('maps a blank-theme input to CLI flags', () => {
  const f = toInitFlags(base);
  assert.equal(f.name, 'my-site');
  assert.equal(f.theme, 'blank');
  assert.equal(f.canva, false);
  assert.equal(f.canvaExport, undefined);
  assert.equal(f.noGit, false); // git:true → noGit:false
  assert.equal(f.title, undefined); // empty → undefined (resolver derives)
  assert.equal(f.email, undefined); // empty → undefined (resolver falls back)
});

test('canva theme sets the canva flag and export path', () => {
  const f = toInitFlags({ ...base, theme: 'canva', canvaExport: './export' });
  assert.equal(f.canva, true);
  assert.equal(f.theme, 'canva');
  assert.equal(f.canvaExport, './export');
});

test('git:false → noGit:true; multisite/title/email pass through (trimmed)', () => {
  const f = toInitFlags({
    ...base,
    git: false,
    multisite: true,
    multisiteMode: 'subdomain',
    title: 'My Site',
    email: '  a@b.co  ',
  });
  assert.equal(f.noGit, true);
  assert.equal(f.multisite, true);
  assert.equal(f.multisiteMode, 'subdomain');
  assert.equal(f.title, 'My Site');
  assert.equal(f.email, 'a@b.co');
});
