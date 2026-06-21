import { test } from 'node:test';
import assert from 'node:assert/strict';
import { figmaPrompt, figmaSpec, indesignSpec } from '../../../src/core/pipelines/pipeline-run';
import { CommandBuilder } from '../../../src/core/shell/command-builder';
import type { ShellResolver } from '../../../src/core/shell/shell-resolver';
import type { PipelineInput } from '../../../src/shared/types/pipeline';

const fakeShell: ShellResolver = {
  resolveBash: async () => 'bash',
  resolveTool: async () => null,
};
const commands = new CommandBuilder(fakeShell);

test('figmaPrompt embeds the URL and slug', () => {
  const prompt = figmaPrompt('https://figma.com/design/x', 'my-theme');
  assert.match(prompt, /https:\/\/figma\.com\/design\/x/);
  assert.match(prompt, /my-theme/);
});

test('figmaSpec builds a `claude -p` invocation', async () => {
  const input: PipelineInput = { kind: 'figma', slug: 'my-theme', figmaUrl: 'https://figma.com/x' };
  const spec = await figmaSpec(commands, '/repo', input);
  assert.equal(spec.command, 'claude'); // fake resolver → null → bare 'claude'
  assert.equal(spec.args[0], '-p');
  assert.match(spec.args[1], /my-theme/);
});

test('figmaSpec rejects without a URL', async () => {
  await assert.rejects(() => figmaSpec(commands, '/repo', { kind: 'figma', slug: 's' }));
});

test('indesignSpec builds a `flavian pipeline indesign` invocation', () => {
  const input: PipelineInput = { kind: 'indesign', slug: 'broch', indesignFile: './a.idml' };
  const spec = indesignSpec(commands, '/repo', input);
  assert.equal(spec.command, process.execPath);
  assert.ok(spec.args[0].endsWith('flavian.mjs'));
  assert.deepEqual(spec.args.slice(1), ['pipeline', 'indesign', './a.idml', '--slug', 'broch']);
});

test('indesignSpec throws without a file', () => {
  assert.throws(() => indesignSpec(commands, '/repo', { kind: 'indesign', slug: 's' }));
});
