// The repo is its own plugin marketplace (#203): `.claude-plugin/marketplace.json`
// lists the `flavian` plugin at the repo root, and the install instructions
// point at this repository, which anyone can read.
//
// Run: node --test tests/claude-code/marketplace.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(REPO_ROOT, rel), 'utf8');
const MARKETPLACE = '.claude-plugin/marketplace.json';

// Every file that tells a reader how to install the plugin.
const INSTALL_DOCS = [
  'README.md',
  'CLAUDE.md',
  '.claude/PLUGINS-REFERENCE.md',
  '.claude/rules/claude-code-conventions.md',
];

describe('plugin marketplace manifest', () => {
  test('exists and lists the flavian plugin at the repo root', () => {
    assert.ok(existsSync(join(REPO_ROOT, MARKETPLACE)), `${MARKETPLACE} is missing`);
    const marketplace = JSON.parse(read(MARKETPLACE));
    const plugin = JSON.parse(read('.claude-plugin/plugin.json'));

    assert.equal(marketplace.name, 'flavian');
    assert.ok(marketplace.owner?.name, 'owner.name is required');
    assert.equal(marketplace.plugins.length, 1);

    const [entry] = marketplace.plugins;
    assert.equal(entry.name, plugin.name, 'the entry must carry the name in plugin.json');
    assert.equal(entry.source, './', 'the plugin is the repository itself');
    assert.ok(entry.description, 'the entry needs a description');
  });
});

describe('plugin install instructions', () => {
  for (const doc of INSTALL_DOCS) {
    test(`${doc} does not send readers to a marketplace they cannot read`, () => {
      const text = read(doc);
      assert.ok(!/marketplace add PMDevSolutions\/(?!Flavian\b)/.test(text), 'marketplace add must name PMDevSolutions/Flavian');
      assert.ok(!/--marketplace PMDevSolutions\/(?!Flavian\b)/.test(text), '--marketplace must name PMDevSolutions/Flavian');
      assert.ok(!text.includes('flavian@pmds'), 'the plugin id is flavian@flavian');
    });
  }

  test('README installs from this repository', () => {
    const readme = read('README.md');
    assert.ok(readme.includes('claude plugin marketplace add PMDevSolutions/Flavian'));
    assert.ok(readme.includes('claude plugin install flavian@flavian --scope project'));
    assert.ok(readme.includes('/plugin install flavian --marketplace PMDevSolutions/Flavian'));
    assert.ok(!readme.includes('git clone <repository-url>'), 'Quick Start should give the real clone URL');
  });
});
