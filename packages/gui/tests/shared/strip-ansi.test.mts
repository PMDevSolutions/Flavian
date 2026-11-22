import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripAnsi } from '../../src/shared/strip-ansi';

// The WordPress screen's log printed wordpress-local.sh's colored banner as raw codes
// ("[0;34m====[0m Activating Theme"), found while recording the #191 demo.

test('removes color codes from a wordpress-local.sh banner', () => {
  const raw = '\x1b[0;34m===================================\x1b[0m\n\x1b[0;34mActivating Theme: clinic-demo\x1b[0m';
  assert.equal(stripAnsi(raw), '===================================\nActivating Theme: clinic-demo');
});

test('removes bold, reset and cursor sequences but keeps the text', () => {
  assert.equal(stripAnsi('\x1b[1m\x1b[32m✓ Theme activated!\x1b[0m\x1b[K'), '✓ Theme activated!');
});

test('leaves plain text untouched', () => {
  const plain = 'Success: Switched to "Clinic Demo" theme. [0;34m is not an escape without ESC';
  assert.equal(stripAnsi(plain), plain);
});
