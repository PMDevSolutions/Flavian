// IR Color schema: optional raw components for the token mapper.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Color } from '../../src/indesign/ir.js';

test('Color accepts optional raw components', () => {
	const c = Color.parse({ hex: '#0066cc', space: 'RGB', components: [0, 102, 204] });
	assert.deepEqual(c.components, [0, 102, 204]);
});

test('Color still validates without components (backward compatible)', () => {
	const c = Color.parse({ hex: '#000000', space: 'CMYK' });
	assert.equal(c.components, undefined);
});
