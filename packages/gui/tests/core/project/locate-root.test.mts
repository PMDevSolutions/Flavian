import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { locateRepoRoot, validateRepoRoot } from '../../../src/core/project/locate-root';

async function makeFlavianRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'flavian-gui-test-'));
  await writeFile(join(root, 'wordpress-local.sh'), '#!/bin/bash\n');
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(join(root, 'scripts', 'check-prerequisites.sh'), '#!/bin/bash\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'flavian' }));
  return root;
}

test('locateRepoRoot walks up to find the project root', async () => {
  const root = await makeFlavianRoot();
  try {
    const nested = join(root, 'a', 'b', 'c');
    await mkdir(nested, { recursive: true });
    const ref = await locateRepoRoot(nested);
    assert.equal(ref.valid, true);
    assert.equal(ref.root, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('validateRepoRoot rejects a non-Flavian directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'not-flavian-'));
  try {
    const ref = await validateRepoRoot(dir);
    assert.equal(ref.valid, false);
    assert.ok(ref.reason);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
