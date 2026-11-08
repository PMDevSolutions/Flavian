import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_PRODUCT_ID,
  PRODUCTS,
  getScreen,
  initModuleDir,
  soleStep,
} from '../../../src/shared/product';
import { aureliusManifest } from '../../../src/shared/product/aurelius';
import { flavianManifest } from '../../../src/shared/product/flavian';
import { vespasianManifest } from '../../../src/shared/product/vespasian';
import { streamResultParser } from '../../../src/core/product/parsers';

// Stage 4 of docs/GUI-PLATFORM.md (issue #187): the Flavian, Aurelius and Vespasian manifests
// type-check against one contract and live in one registry. These tests pin the registry and
// the invariants every registered manifest must keep for the engine to render it.

test('the registry holds the Flavian, Aurelius and Vespasian manifests under their own ids', () => {
  assert.deepEqual(Object.keys(PRODUCTS).sort(), ['aurelius', 'flavian', 'vespasian']);
  for (const [id, manifest] of Object.entries(PRODUCTS)) {
    assert.equal(manifest.id, id, `registry key "${id}" holds manifest "${manifest.id}"`);
  }
  assert.equal(PRODUCTS.flavian, flavianManifest);
  assert.equal(PRODUCTS.aurelius, aureliusManifest);
  assert.equal(PRODUCTS.vespasian, vespasianManifest);
});

test('this build still ships Flavian', () => {
  assert.equal(ACTIVE_PRODUCT_ID, 'flavian');
});

test('Aurelius exposes four screens: no local server stack, and Figma builds the app', () => {
  assert.deepEqual(
    aureliusManifest.screens.map((s) => s.id),
    ['prereq', 'wizard', 'pipeline', 'qa'],
  );
  assert.deepEqual(
    aureliusManifest.screens.map((s) => s.navLabel),
    ['Prerequisites', 'Setup wizard', 'Build from Figma', 'Visual QA'],
  );
  assert.deepEqual(
    getScreen(aureliusManifest, 'prereq').steps.map((s) => s.id),
    ['check', 'playwright'],
  );
  assert.equal(getScreen(aureliusManifest, 'wizard').extras?.frameworks?.length, 5);
});

test('Vespasian exposes five screens with the Wix site screen where Flavian has WordPress', () => {
  assert.deepEqual(
    vespasianManifest.screens.map((s) => s.id),
    ['prereq', 'wizard', 'site', 'pipeline', 'qa'],
  );
  const site = getScreen(vespasianManifest, 'site');
  assert.equal(site.navLabel, 'Wix site');
  assert.deepEqual(
    site.steps.map((s) => s.id),
    ['list', 'use', 'apply', 'publish'],
  );
});

test('the wizard is an in-process module for Flavian and Vespasian and a script for Aurelius', () => {
  assert.equal(initModuleDir(flavianManifest), 'scripts/init');
  assert.equal(initModuleDir(vespasianManifest), 'scripts/init');
  assert.equal(soleStep(aureliusManifest, 'wizard').command.exec, 'bashScript');
  assert.throws(() => initModuleDir(aureliusManifest), /not a 'module' command/);
});

for (const manifest of Object.values(PRODUCTS)) {
  const name = manifest.displayName;

  test(`${name}: screen ids and step ids are unique and every screen has steps`, () => {
    const screenIds = manifest.screens.map((s) => s.id);
    assert.equal(new Set(screenIds).size, screenIds.length, `duplicate screen id in ${screenIds}`);
    for (const screen of manifest.screens) {
      assert.ok(screen.steps.length > 0, `${screen.id} has no steps`);
      const stepIds = screen.steps.map((s) => s.id);
      assert.equal(new Set(stepIds).size, stepIds.length, `duplicate step id in ${screen.id}`);
    }
  });

  test(`${name}: every screen and step carries its labels and a task kind`, () => {
    for (const screen of manifest.screens) {
      assert.ok(screen.navLabel.length > 0 && screen.title.length > 0, `${screen.id} is unlabelled`);
      for (const step of screen.steps) {
        assert.ok(step.label.length > 0, `${screen.id}/${step.id} has no label`);
        assert.ok(String(step.taskKind).length > 0, `${screen.id}/${step.id} has no task kind`);
      }
    }
  });

  test(`${name}: the prerequisites screen follows the shared convention`, () => {
    const check = soleStep(manifest, 'prereq');
    assert.equal(check.taskKind, 'prereq-check');
    assert.equal(check.parser, 'prereq');
    assert.deepEqual(check.successExitCodes, [0, 1]);
  });

  test(`${name}: every parser a step names is registered in the engine`, () => {
    for (const screen of manifest.screens) {
      for (const step of screen.steps) {
        if (step.parser) {
          assert.doesNotThrow(() => streamResultParser(step.parser), `${screen.id}/${step.id}`);
        }
      }
    }
  });

  test(`${name}: delegate steps point at a screen of the same product`, () => {
    const screenIds = new Set(manifest.screens.map((s) => s.id));
    for (const screen of manifest.screens) {
      for (const step of screen.steps) {
        if (step.command.exec === 'delegate') {
          assert.ok(screenIds.has(step.command.toScreen), `${screen.id}/${step.id} delegates to a missing screen`);
        }
      }
    }
  });

  test(`${name}: success exit codes always include 0`, () => {
    for (const screen of manifest.screens) {
      for (const step of screen.steps) {
        if (step.successExitCodes) assert.ok(step.successExitCodes.includes(0), `${screen.id}/${step.id}`);
      }
    }
  });

  test(`${name}: the manifest is plain, serializable data`, () => {
    assert.deepEqual(JSON.parse(JSON.stringify(manifest)), manifest);
  });
}
