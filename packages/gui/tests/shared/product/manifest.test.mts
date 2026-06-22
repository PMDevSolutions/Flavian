import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_PRODUCT_ID,
  PRODUCTS,
  activeManifest,
  getScreen,
  getStep,
  initModuleDir,
  soleStep,
} from '../../../src/shared/product';
import { flavianManifest } from '../../../src/shared/product/flavian';

// Proves the shell renders its catalog (brand, screens, steps) from the manifest, and
// that the Flavian manifest reproduces the previously hard-coded catalog exactly.

test('the active product is Flavian', () => {
  assert.equal(ACTIVE_PRODUCT_ID, 'flavian');
  assert.equal(activeManifest, flavianManifest);
  assert.equal(activeManifest.displayName, 'Flavian');
  assert.equal(PRODUCTS.flavian, flavianManifest);
});

test('Flavian exposes the five expected screens, in order, with their nav labels', () => {
  assert.deepEqual(
    flavianManifest.screens.map((s) => s.id),
    ['prereq', 'wizard', 'docker', 'pipeline', 'qa'],
  );
  assert.deepEqual(
    flavianManifest.screens.map((s) => s.navLabel),
    ['Prerequisites', 'Setup wizard', 'WordPress', 'Convert design', 'Visual QA'],
  );
});

test('the WordPress screen lists the full docker lifecycle vocabulary', () => {
  const ids = getScreen(flavianManifest, 'docker').steps.map((s) => s.id);
  assert.deepEqual(ids, [
    'build',
    'start',
    'stop',
    'restart',
    'install',
    'logs',
    'list-themes',
    'activate-theme',
  ]);
});

test('every step has a label and a task kind; every screen has steps', () => {
  for (const screen of flavianManifest.screens) {
    assert.ok(screen.steps.length > 0, `${screen.id} has no steps`);
    for (const step of screen.steps) {
      assert.ok(step.label.length > 0, `${screen.id}/${step.id} missing label`);
      assert.ok(String(step.taskKind).length > 0, `${screen.id}/${step.id} missing taskKind`);
    }
  }
});

test('task kinds reuse the shared vocabulary the engine already emits', () => {
  assert.equal(soleStep(flavianManifest, 'prereq').taskKind, 'prereq-check');
  assert.equal(soleStep(flavianManifest, 'wizard').taskKind, 'init');
  assert.equal(getStep(getScreen(flavianManifest, 'docker'), 'start').taskKind, 'docker:start');
  assert.equal(getStep(getScreen(flavianManifest, 'pipeline'), 'figma').taskKind, 'pipeline:figma');
  assert.equal(getStep(getScreen(flavianManifest, 'qa'), 'lighthouse:run').taskKind, 'qa:lighthouse:run');
});

test('selectors resolve manifest entries and throw on unknown ids', () => {
  assert.equal(initModuleDir(flavianManifest), 'scripts/init');
  assert.equal(soleStep(flavianManifest, 'wizard').command.exec, 'module');
  assert.throws(() => getScreen(flavianManifest, 'nope'));
  assert.throws(() => getStep(getScreen(flavianManifest, 'qa'), 'nope'));
});

test('prereq step treats exit 0 and 1 as success and names the prereq parser', () => {
  const step = soleStep(flavianManifest, 'prereq');
  assert.deepEqual(step.successExitCodes, [0, 1]);
  assert.equal(step.parser, 'prereq');
});

test('project identity carries the Flavian checkout markers and chooser copy', () => {
  assert.deepEqual(flavianManifest.project.markers, [
    'wordpress-local.sh',
    'scripts/check-prerequisites.sh',
  ]);
  assert.equal(flavianManifest.project.packageName, 'flavian');
  assert.match(flavianManifest.project.selectTitle, /Flavian/);
});
