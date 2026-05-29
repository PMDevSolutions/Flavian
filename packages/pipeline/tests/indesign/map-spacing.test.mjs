// IR geometry + paragraph spacing → a quantized theme.json spacing scale.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSpacing } from '../../src/indesign/map/spacing.js';

function irWith(frames, styles = []) {
	return {
		dpi: 96,
		swatches: [], fonts: [], stories: [], masterSpreads: [], warnings: [],
		styles,
		spreads: [{
			id: 'sp1', source: 's',
			pages: [{ id: 'pg', bounds: { x: 0, y: 0, width: 600, height: 800 } }],
			frames,
		}],
	};
}

test('quantizes observed gaps to the grid and dedupes', () => {
	const ir = irWith(
		[
			{ kind: 'text', id: 'f1', bounds: { x: 48, y: 50, width: 500, height: 100 } },
			{ kind: 'text', id: 'f2', bounds: { x: 48, y: 170, width: 500, height: 100 } }, // 20px vertical gap
		],
		[{ id: 'p1', name: 'Body', kind: 'paragraph', properties: { SpaceAfter: '12pt' } }], // 16px
	);
	const { spacingSizes } = mapSpacing(ir, { gridPx: 4 });
	const rems = spacingSizes.map((s) => s.size);
	assert.ok(rems.includes('1.25rem'), `expected a 20px (1.25rem) gap, got ${rems.join()}`);
	assert.ok(rems.includes('1rem'), '12pt paragraph spacing should quantize to 16px (1rem)');
	// All entries are valid spacing tokens.
	for (const s of spacingSizes) {
		assert.ok(s.slug && s.name);
		assert.match(s.size, /^[\d.]+rem$/);
	}
});

test('caps the number of emitted sizes', () => {
	const frames = [];
	let y = 0;
	for (let i = 0; i < 20; i += 1) {
		frames.push({ kind: 'text', id: `f${i}`, bounds: { x: 10, y, width: 100, height: 10 } });
		y += 10 + (i + 1) * 4; // ever-growing gaps → many distinct values
	}
	const { spacingSizes } = mapSpacing(irWith(frames), { gridPx: 4, maxSizes: 6 });
	assert.ok(spacingSizes.length <= 6, `expected ≤6, got ${spacingSizes.length}`);
});

test('emits an approximate warning for PDF-derived IRs', () => {
	const warnings = [];
	const ir = irWith([
		{ kind: 'text', id: 'f1', bounds: { x: 10, y: 10, width: 100, height: 50 } },
		{ kind: 'text', id: 'f2', bounds: { x: 10, y: 90, width: 100, height: 50 } },
	]);
	ir.warnings = [{ code: 'pdf-fallback', message: 'x', context: {} }];
	mapSpacing(ir, { gridPx: 4, warnings: { add: (code) => warnings.push(code) } });
	assert.ok(warnings.includes('spacing-approximate'));
});
