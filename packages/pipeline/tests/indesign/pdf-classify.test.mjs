// Style synthesis from font-size buckets (pure, no pdfjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStyles } from '../../src/indesign/pdf/classify.js';

function makeInput() {
	return {
		dpi: 96,
		items: [
			{ fontSize: 36, fontKey: 'pdf-font-helvetica-bold', text: 'Title' },
			// Body dominates by character count.
			{ fontSize: 12, fontKey: 'pdf-font-helvetica', text: 'The quick brown fox jumps over the lazy dog.' },
			{ fontSize: 12, fontKey: 'pdf-font-helvetica', text: 'Another full line of ordinary body copy here.' },
			{ fontSize: 8, fontKey: 'pdf-font-helvetica', text: 'fig' },
		],
		colorSamples: [
			{ fontSizePt: 36, hex: '#0066cc', glyphs: 5 },
			{ fontSizePt: 12, hex: '#111111', glyphs: 80 },
			{ fontSizePt: 8, hex: '#888888', glyphs: 3 },
		],
	};
}

test('largest size becomes Heading 1, most-used becomes Body, smallest becomes Caption', () => {
	const { buckets } = classifyStyles(makeInput());
	const byRole = Object.fromEntries(buckets.map((b) => [b.role, b]));
	assert.equal(byRole.heading.id, 'pdf-style-h1');
	assert.equal(byRole.heading.sizePt, 36);
	assert.equal(byRole.heading.fontSizePx, 48); // 36pt @ 96dpi
	assert.equal(byRole.body.id, 'pdf-style-body');
	assert.equal(byRole.body.sizePt, 12);
	assert.equal(byRole.caption.id, 'pdf-style-caption');
	assert.equal(byRole.caption.sizePt, 8);
});

test('buckets carry the dominant font and color for each size', () => {
	const { buckets } = classifyStyles(makeInput());
	const body = buckets.find((b) => b.role === 'body');
	assert.equal(body.dominantFontKey, 'pdf-font-helvetica');
	assert.equal(body.dominantHex, '#111111');
	const heading = buckets.find((b) => b.role === 'heading');
	assert.equal(heading.dominantFontKey, 'pdf-font-helvetica-bold');
	assert.equal(heading.dominantHex, '#0066cc');
});

test('styleIdForSize maps a size back to its bucket id', () => {
	const { styleIdForSize } = classifyStyles(makeInput());
	assert.equal(styleIdForSize(36), 'pdf-style-h1');
	assert.equal(styleIdForSize(12), 'pdf-style-body');
	assert.equal(styleIdForSize(8), 'pdf-style-caption');
	assert.equal(styleIdForSize(99), undefined);
});

test('multiple heading sizes get descending levels', () => {
	const { buckets } = classifyStyles({
		dpi: 96,
		items: [
			{ fontSize: 48, fontKey: 'f', text: 'Big' },
			{ fontSize: 24, fontKey: 'f', text: 'Med' },
			{ fontSize: 10, fontKey: 'f', text: 'lots of body copy lots of body copy' },
		],
	});
	const headings = buckets.filter((b) => b.role === 'heading').sort((a, b) => b.sizePt - a.sizePt);
	assert.equal(headings[0].id, 'pdf-style-h1');
	assert.equal(headings[0].sizePt, 48);
	assert.equal(headings[1].id, 'pdf-style-h2');
	assert.equal(headings[1].sizePt, 24);
});

test('a single font size yields only a Body bucket', () => {
	const { buckets } = classifyStyles({
		dpi: 96,
		items: [{ fontSize: 11, fontKey: 'f', text: 'uniform text everywhere' }],
	});
	assert.equal(buckets.length, 1);
	assert.equal(buckets[0].role, 'body');
});
