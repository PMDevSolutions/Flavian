import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractIdmlAssets } from '../../src/indesign/assets/idml-assets.js';
import { buildIdml } from './helpers/build-idml.js';

test('extracts embedded asset bytes by href', () => {
  const idml = buildIdml({
    spreads: [{ id: 'sp', pages: [{ id: 'p', bounds: [0, 0, 600, 400] }],
      frames: [{ kind: 'image', id: 'img', bounds: [0, 0, 600, 400], href: 'file:Resources/hero.jpg' }] }],
    extraFiles: { 'Resources/hero.jpg': '\x89PNG\x01\x02\x03' },
  });
  const map = extractIdmlAssets(idml);
  assert.ok(map.has('file:Resources/hero.jpg'));
  assert.equal(map.get('file:Resources/hero.jpg').ext, 'jpg');
  assert.ok(map.get('file:Resources/hero.jpg').bytes instanceof Uint8Array);
});

test('only image-typed entries are included (no XML/manifest noise)', () => {
  const idml = buildIdml({
    spreads: [{ id: 'sp', pages: [{ id: 'p', bounds: [0, 0, 600, 400] }], frames: [] }],
  });
  const map = extractIdmlAssets(idml);
  for (const href of map.keys()) {
    assert.match(href, /\.(jpe?g|png|gif|webp|svg|tiff?)$/i);
  }
});
