import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommandSpec, fillTemplate } from '../../../src/core/product/command-spec';
import { CommandBuilder } from '../../../src/core/shell/command-builder';
import { getScreen, getStep, soleStep } from '../../../src/shared/product';
import { flavianManifest } from '../../../src/shared/product/flavian';
import type { ShellResolver } from '../../../src/core/shell/shell-resolver';

// Proves the generic engine renders a concrete command from a manifest's declarative
// CommandDescriptor — no per-product code path. Uses a fake shell so resolution is
// deterministic, then drives the REAL Flavian manifest steps.
const fakeShell: ShellResolver = {
  resolveBash: async () => 'bash',
  resolveTool: async () => null,
};
const commands = new CommandBuilder(fakeShell);

test('fillTemplate substitutes {placeholders} and passes through the rest', () => {
  assert.deepEqual(fillTemplate(['a', '{x}', 'c-{y}'], { x: 'B', y: 'D' }), ['a', 'B', 'c-D']);
  assert.deepEqual(fillTemplate(undefined, {}), []);
  assert.deepEqual(fillTemplate(['{missing}'], {}), ['']); // unknown placeholder → ''
});

test('bashScript descriptor → bash <root>/<script> <args>', async () => {
  const spec = await buildCommandSpec(commands, '/repo', {
    exec: 'bashScript',
    script: 'wordpress-local.sh',
    argsTemplate: ['start'],
  });
  assert.equal(spec.command, 'bash');
  assert.ok(spec.args[0].endsWith('wordpress-local.sh'));
  assert.equal(spec.args[1], 'start');
  assert.equal(spec.cwd, '/repo');
});

test("module and delegate descriptors are not runnable through buildCommandSpec", async () => {
  await assert.rejects(() => buildCommandSpec(commands, '/repo', { exec: 'module', module: 'scripts/init' }));
  await assert.rejects(() =>
    buildCommandSpec(commands, '/repo', { exec: 'delegate', toScreen: 'wizard' }),
  );
});

// ── Driven by the real Flavian manifest ─────────────────────────────────────────

test('docker "start" step renders `bash wordpress-local.sh start`', async () => {
  const step = getStep(getScreen(flavianManifest, 'docker'), 'start');
  const spec = await buildCommandSpec(commands, '/repo', step.command);
  assert.equal(spec.command, 'bash');
  assert.ok(spec.args[0].endsWith('wordpress-local.sh'));
  assert.equal(spec.args[1], 'start');
});

test('docker "activate-theme" step fills the {theme} placeholder', async () => {
  const step = getStep(getScreen(flavianManifest, 'docker'), 'activate-theme');
  const spec = await buildCommandSpec(commands, '/repo', step.command, { theme: 'my-theme' });
  assert.deepEqual(spec.args.slice(1), ['activate-theme', 'my-theme']);
});

test('qa "visual:diff" step renders `bash -c "pnpm run visual:diff"`', async () => {
  const step = getStep(getScreen(flavianManifest, 'qa'), 'visual:diff');
  const spec = await buildCommandSpec(commands, '/repo', step.command);
  assert.equal(spec.command, 'bash');
  assert.deepEqual(spec.args, ['-c', 'pnpm run visual:diff']);
});

test('prereq step targets scripts/check-prerequisites.sh', async () => {
  const step = soleStep(flavianManifest, 'prereq');
  const spec = await buildCommandSpec(commands, '/repo', step.command);
  assert.equal(spec.command, 'bash');
  assert.ok(spec.args[0].endsWith('check-prerequisites.sh'));
});

test('pipeline "figma" step renders a `claude -p` prompt with the URL and slug', async () => {
  const step = getStep(getScreen(flavianManifest, 'pipeline'), 'figma');
  const spec = await buildCommandSpec(commands, '/repo', step.command, {
    figmaUrl: 'https://figma.com/x',
    slug: 'my-theme',
  });
  assert.equal(spec.command, 'claude');
  assert.equal(spec.args[0], '-p');
  assert.match(spec.args[1], /https:\/\/figma\.com\/x/);
  assert.match(spec.args[1], /my-theme/);
});

test('pipeline "indesign" step renders the `node bin/flavian.mjs` CLI', async () => {
  const step = getStep(getScreen(flavianManifest, 'pipeline'), 'indesign');
  const spec = await buildCommandSpec(commands, '/repo', step.command, {
    file: './a.idml',
    slug: 'broch',
  });
  assert.equal(spec.command, process.execPath);
  assert.ok(spec.args[0].endsWith('flavian.mjs'));
  assert.deepEqual(spec.args.slice(1), ['pipeline', 'indesign', './a.idml', '--slug', 'broch']);
});
