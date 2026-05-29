// Paragraph styles → theme.json typography scale + element presets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTypography } from '../../src/indesign/map/typography.js';

const baseFontSizes = [
	{ slug: 'base', size: '1rem' }, // 16px
	{ slug: 'display', size: 'clamp(2.25rem, 5vw, 3.5rem)' }, // 56px max
];

test('clusters near-equal sizes and references every emitted entry by a style', () => {
	const styles = [
		{ id: 'p1', name: 'Body', kind: 'paragraph', fontSize: 16 },
		{ id: 'p2', name: 'Body Alt', kind: 'paragraph', fontSize: 16.4 },
		{ id: 'p3', name: 'Title', kind: 'paragraph', fontSize: 56 },
	];
	const { fontSizes, styleToSlug } = mapTypography(styles, { baseFontSizes, tolerancePx: 1 });
	// 16 / 16.4 reuse base 'base'; 56 reuses base 'display' → no new entries.
	assert.equal(styleToSlug.p1, 'base');
	assert.equal(styleToSlug.p2, 'base');
	assert.equal(styleToSlug.p3, 'display');
	for (const entry of fontSizes) {
		assert.ok(Object.values(styleToSlug).includes(entry.slug), `entry ${entry.slug} must be referenced`);
	}
});

test('creates a derived, namespaced slug for a size with no base match', () => {
	const styles = [{ id: 'p1', name: 'Lead', kind: 'paragraph', fontSize: 21 }];
	const { fontSizes, styleToSlug } = mapTypography(styles, { baseFontSizes, tolerancePx: 1, namespace: 'id' });
	assert.equal(fontSizes.length, 1);
	assert.equal(styleToSlug.p1, fontSizes[0].slug);
	assert.equal(fontSizes[0].slug, 'id-lead');
	assert.equal(fontSizes[0].size, '1.3125rem'); // 21/16
	assert.equal(fontSizes[0].name, 'Lead');
});

test('maps recognized style names to elements with line height and color', () => {
	const styles = [
		{ id: 'p1', name: 'Heading 1', kind: 'paragraph', fontSize: 56, leading: 64, tracking: -10, fillColorRef: 'col-brand' },
		{ id: 'p2', name: 'Body', kind: 'paragraph', fontSize: 16, leading: 24 },
	];
	const swatchToSlug = { 'col-brand': 'id-brand' };
	const { elements } = mapTypography(styles, { baseFontSizes, swatchToSlug, tolerancePx: 1 });
	assert.ok(elements.h1, 'h1 element should be present');
	assert.equal(elements.h1.typography.fontSize, 'var(--wp--preset--font-size--display)');
	assert.equal(elements.h1.typography.lineHeight, '1.14'); // 64/56
	assert.equal(elements.h1.typography.letterSpacing, '-0.01em'); // -10/1000
	assert.equal(elements.h1.color.text, 'var(--wp--preset--color--id-brand)');
	assert.ok(elements.p, 'p element should be present');
	assert.equal(elements.p.typography.lineHeight, '1.5'); // 24/16
});
