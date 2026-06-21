import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listThemeDirs } from '../../../src/core/project/list-themes';

test('listThemeDirs lists theme subdirectories (sorted, dirs only)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flavian-themes-'));
  try {
    await mkdir(join(root, 'themes', 'beta'), { recursive: true });
    await mkdir(join(root, 'themes', 'alpha'), { recursive: true });
    await writeFile(join(root, 'themes', 'readme.txt'), 'x');
    assert.deepEqual(await listThemeDirs(root), ['alpha', 'beta']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('listThemeDirs returns [] when themes/ is absent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flavian-nothemes-'));
  try {
    assert.deepEqual(await listThemeDirs(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
