// Edge cases. These exercise the "warn-don't-throw" philosophy described in
// parse-idml.js. The three explicitly called out in the issue:
//
//   - missing manifest         → throws (structural failure)
//   - unknown style refs       → warns, IR still produced
//   - empty stories            → warns, IR still produced

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdmlBuffer } from '../../src/indesign/parse-idml.js';
import { buildIdml } from './helpers/build-idml.js';

test('throws when designmap.xml is missing', () => {
	const bytes = buildIdml({ omitDesignMap: true });
	assert.throws(() => parseIdmlBuffer(bytes), /missing designmap\.xml/i);
});

test('throws when the package is not a valid zip', () => {
	const garbage = new TextEncoder().encode('not actually a zip file');
	assert.throws(() => parseIdmlBuffer(garbage), /not a valid zip/i);
});

test('warns on unknown paragraph style refs without throwing', () => {
	const bytes = buildIdml({
		styles: [
			{ id: 'pstyle-real', name: 'Body', kind: 'paragraph', pointSize: 12 },
		],
		stories: [
			{
				id: 'story-1',
				runs: [
					{ text: 'Hello', paragraphStyle: 'pstyle-real' },
					{ text: 'Dangling', paragraphStyle: 'pstyle-ghost' },
				],
			},
		],
		spreads: [
			{
				id: 'spread-1',
				pages: [{ id: 'page-1', bounds: [0, 0, 100, 100] }],
				frames: [{ kind: 'text', id: 'frame-1', bounds: [0, 0, 100, 50], parentStory: 'story-1' }],
			},
		],
	});

	const ir = parseIdmlBuffer(bytes);
	const codes = ir.warnings.map((w) => w.code);
	assert.ok(
		codes.includes('missing-paragraph-style-ref'),
		`expected missing-paragraph-style-ref warning, got: ${codes.join(', ')}`,
	);
	// The valid style ref should NOT generate a warning.
	const ghostWarning = ir.warnings.find((w) => w.message.includes('pstyle-ghost'));
	assert.ok(ghostWarning, 'expected the warning to name the dangling ref');
});

test('warns on text frame pointing at a non-existent story', () => {
	const bytes = buildIdml({
		spreads: [
			{
				id: 'spread-1',
				pages: [{ id: 'page-1', bounds: [0, 0, 100, 100] }],
				frames: [{ kind: 'text', id: 'frame-1', bounds: [0, 0, 100, 50], parentStory: 'story-ghost' }],
			},
		],
		// No stories array.
	});

	const ir = parseIdmlBuffer(bytes);
	assert.ok(
		ir.warnings.some((w) => w.code === 'missing-story-ref'),
		`warnings: ${JSON.stringify(ir.warnings)}`,
	);
});

test('empty stories produce an IR with empty run lists, no throw', () => {
	const bytes = buildIdml({
		stories: [{ id: 'story-empty', runs: [] }],
		spreads: [
			{
				id: 'spread-1',
				pages: [{ id: 'page-1', bounds: [0, 0, 100, 100] }],
				frames: [{ kind: 'text', id: 'frame-1', bounds: [0, 0, 100, 50], parentStory: 'story-empty' }],
			},
		],
	});

	const ir = parseIdmlBuffer(bytes);
	assert.equal(ir.stories.length, 1);
	assert.equal(ir.stories[0].runs.length, 0);
	// The frame still references it correctly — no missing-story-ref warning.
	assert.ok(!ir.warnings.some((w) => w.code === 'missing-story-ref'));
});

test('missing optional resource files produce warnings, not errors', () => {
	const bytes = buildIdml({
		omitGraphic: true,
		omitFonts: true,
		omitStyles: true,
	});

	const ir = parseIdmlBuffer(bytes);
	const codes = ir.warnings.map((w) => w.code);
	assert.ok(codes.includes('missing-graphic'));
	assert.ok(codes.includes('missing-fonts'));
	assert.ok(codes.includes('missing-styles'));
	assert.equal(ir.swatches.length, 0);
	assert.equal(ir.fonts.length, 0);
	assert.equal(ir.styles.length, 0);
});

test('unknown color space falls back to black with a warning', () => {
	const bytes = buildIdml({
		colors: [{ id: 'col-weird', name: 'Mystery', space: 'HSB', values: [50, 0, 0] }],
	});
	const ir = parseIdmlBuffer(bytes);
	const swatch = ir.swatches.find((s) => s.id === 'col-weird');
	assert.equal(swatch.color.hex, '#000000');
	assert.equal(swatch.color.space, 'Unknown');
	assert.ok(ir.warnings.some((w) => w.code === 'color-fallback'));
});

test('LAB color space is converted to sRGB (no longer collapses to black)', () => {
	const bytes = buildIdml({
		colors: [{ id: 'col-lab', name: 'Lab Red', space: 'LAB', values: [54, 81, 70] }],
	});
	const ir = parseIdmlBuffer(bytes);
	const swatch = ir.swatches.find((s) => s.id === 'col-lab');
	assert.equal(swatch.color.space, 'LAB');
	assert.deepEqual(swatch.color.components, [54, 81, 70]);
	assert.notEqual(swatch.color.hex, '#000000');
});
