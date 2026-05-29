// Swatches → theme.json color palette: convert, dedupe, reuse base slugs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapColors } from '../../src/indesign/map/colors.js';

const base = [{ slug: 'primary', color: '#0b5cff', name: 'Primary' }];

test('includes all distinct swatches, deduped within tolerance', () => {
	const swatches = [
		{ id: 's1', name: 'Brand Blue', color: { hex: '#0066cc', space: 'RGB', components: [0, 102, 204] } },
		{ id: 's2', name: 'Brand Blue Dup', color: { hex: '#0265cb', space: 'RGB', components: [2, 101, 203] } },
		{ id: 's3', name: 'Ink', color: { hex: '#121212', space: 'CMYK', components: [0, 0, 0, 93] } },
	];
	const { palette, swatchToSlug } = mapColors(swatches, { basePalette: base, tolerance: 24 * 24 * 3 });
	// s1 and s2 collapse to one entry; ink is separate → 2 derived entries.
	assert.equal(palette.length, 2);
	assert.equal(swatchToSlug.s1, swatchToSlug.s2);
	// Every derived palette entry is a valid theme.json token.
	for (const entry of palette) {
		assert.match(entry.color, /^#[0-9a-f]{6}$/);
		assert.ok(entry.slug && entry.name);
	}
});

test('reuses a base slug when close, instead of duplicating', () => {
	const swatches = [{ id: 's1', name: 'Almost Primary', color: { hex: '#0b5dff', space: 'RGB', components: [11, 93, 255] } }];
	const { palette, swatchToSlug } = mapColors(swatches, { basePalette: base, tolerance: 24 * 24 * 3 });
	assert.equal(swatchToSlug.s1, 'primary');
	assert.equal(palette.length, 0); // nothing new; it maps onto the base
});

test('derived slugs are namespaced and warns on opaque spaces', () => {
	const warnings = [];
	const swatches = [{ id: 's1', name: 'Pantone 286', color: { hex: '#0000ff', space: 'Spot', components: undefined } }];
	const { palette, swatchToSlug } = mapColors(swatches, {
		basePalette: base,
		namespace: 'id',
		warnings: { add: (code, message) => warnings.push({ code, message }) },
	});
	assert.equal(palette.length, 1);
	assert.ok(swatchToSlug.s1.startsWith('id-'));
	assert.ok(warnings.some((w) => w.code === 'swatch-approximated'));
});
