import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readImageDataUrl, readTextArtifact } from '../../../src/core/fs/read-artifact';

test('readImageDataUrl reads an allowlisted PNG and rejects everything else', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flavian-qa-'));
  try {
    await mkdir(join(root, 'tests', 'visual', 'diffs'), { recursive: true });
    await writeFile(join(root, 'tests', 'visual', 'diffs', 'diff-home.png'), Buffer.from('png-bytes'));

    const dataUrl = await readImageDataUrl(root, 'tests/visual/diffs/diff-home.png');
    assert.ok(dataUrl?.startsWith('data:image/png;base64,'));

    // outside the allowlisted dirs
    await writeFile(join(root, 'secret.png'), Buffer.from('x'));
    assert.equal(await readImageDataUrl(root, 'secret.png'), null);
    // path traversal
    assert.equal(await readImageDataUrl(root, '../evil.png'), null);
    // wrong extension within an allowed dir
    await writeFile(join(root, 'tests', 'visual', 'note.txt'), 'hi');
    assert.equal(await readImageDataUrl(root, 'tests/visual/note.txt'), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('readTextArtifact reads allowlisted markdown and rejects traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flavian-qa2-'));
  try {
    await mkdir(join(root, '.claude', 'visual-qa'), { recursive: true });
    await writeFile(join(root, '.claude', 'visual-qa', 'report.md'), '# Report');
    assert.equal(await readTextArtifact(root, '.claude/visual-qa/report.md'), '# Report');
    assert.equal(await readTextArtifact(root, '../../etc/passwd'), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
