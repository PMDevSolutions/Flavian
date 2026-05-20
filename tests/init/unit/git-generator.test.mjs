import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initGit } from '../../../scripts/init/generators/git.mjs';

const exec = promisify(execFile);

test('skipped when initGit false', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'git-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await initGit(dir, { initGit: false });
  await assert.rejects(() => access(join(dir, '.git'), constants.F_OK));
});

test('initialises fresh repo with one commit', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'git-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'README.md'), '# test\n');

  await initGit(dir, { initGit: true, projectName: 'test-site' });

  await access(join(dir, '.git'), constants.F_OK);
  const { stdout } = await exec('git', ['log', '--oneline'], { cwd: dir });
  assert.match(stdout, /chore: initial Flavian scaffold/);
});

test('replaces existing .git from template', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'git-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, '.git'), { recursive: true });
  await writeFile(join(dir, '.git/old-marker'), 'leftover');
  await writeFile(join(dir, 'README.md'), '# test\n');

  await initGit(dir, { initGit: true, projectName: 'test-site' });

  await assert.rejects(() => access(join(dir, '.git/old-marker'), constants.F_OK));
});
