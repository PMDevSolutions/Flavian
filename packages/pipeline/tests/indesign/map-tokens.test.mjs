// End-to-end: mapTokens runs on an IR from either parser (IDML or PDF) and
// produces a schema-valid theme.json, DTCG tokens, and a report.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTokens } from '../../src/indesign/map/index.js';
import { parseIdmlBuffer } from '../../src/indesign/parse-idml.js';
import { parsePdfBuffer } from '../../src/indesign/parse-pdf.js';
import { buildIdml } from './helpers/build-idml.js';
import { buildPdf } from './helpers/build-pdf.js';

function buildBrochureIdml() {
	return buildIdml({
		name: 'Brochure',
		colors: [
			{ id: 'col-brand', name: 'Brand Blue', space: 'RGB', values: [0, 102, 204] },
			{ id: 'col-ink', name: 'Ink', space: 'CMYK', values: [0, 0, 0, 100] },
			{ id: 'col-accent', name: 'Accent', space: 'LAB', values: [54, 81, 70] },
		],
		fonts: [
			{ id: 'f-helv', family: 'Helvetica', style: 'Bold', postScriptName: 'Helvetica-Bold' },
			{ id: 'f-bell', family: 'Bell Gothic', style: 'Regular' }, // not in the font map
		],
		styles: [
			{ id: 'p-h1', name: 'Heading 1', kind: 'paragraph', pointSize: 36, leading: 40, appliedFont: 'f-helv', fillColor: 'col-brand' },
			{ id: 'p-body', name: 'Body', kind: 'paragraph', pointSize: 12, leading: 18, appliedFont: 'f-bell', fillColor: 'col-ink' },
		],
		stories: [
			{ id: 'story-h', runs: [{ text: 'Welcome', paragraphStyle: 'p-h1' }] },
			{ id: 'story-b', runs: [{ text: 'Body copy here.', paragraphStyle: 'p-body' }] },
		],
		spreads: [
			{
				id: 'spread-1',
				pages: [{ id: 'page-1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'frame-h', bounds: [72, 72, 130, 400], parentStory: 'story-h' },
					{ kind: 'text', id: 'frame-b', bounds: [150, 72, 230, 400], parentStory: 'story-b' },
				],
			},
		],
	});
}

test('maps an IDML-derived IR into schema-valid tokens', () => {
	const ir = parseIdmlBuffer(buildBrochureIdml());
	const { partial, designTokens, merged, report } = mapTokens(ir);

	// theme.json validates against the official schema (+ zod subset).
	assert.ok(report.valid, JSON.stringify(report.validationErrors));

	// Palette includes all distinct swatches (3 derived, none close to base).
	assert.equal(report.counts.swatches, 3);
	assert.ok(merged.settings.color.palette.length > 10, 'derived colors added to base');

	// Every emitted typography entry is referenced by at least one paragraph style.
	const referenced = new Set(Object.values(report.provenance.styleToSlug));
	for (const entry of partial.settings.typography?.fontSizes ?? []) {
		assert.ok(referenced.has(entry.slug), `font size ${entry.slug} unreferenced`);
	}

	// Font fallback warning emitted + listed in the report.
	assert.ok(report.fontFallbacks.some((m) => /Bell Gothic/.test(m)));

	// Named style variation: h1 element carries size, family, and color.
	assert.ok(partial.styles.elements.h1);
	assert.match(partial.styles.elements.h1.typography.fontSize, /^var\(--wp--preset--font-size--/);
	assert.ok(partial.styles.elements.h1.typography.fontFamily);
	assert.match(partial.styles.elements.h1.color.text, /^var\(--wp--preset--color--/);

	// DTCG output present.
	assert.ok(designTokens.color);
	assert.ok(designTokens.fontSize);
});

test('maps a PDF-derived IR into schema-valid tokens (source-agnostic)', async () => {
	const toUnit = ([r, g, b]) => [r / 255, g / 255, b / 255];
	const pdf = buildPdf({
		title: 'Brochure PDF',
		pages: [
			{
				width: 612,
				height: 792,
				texts: [
					// Teal headline — clearly outside the base palette, so it derives a token.
					{ text: 'Welcome', x: 72, y: 96, size: 36, font: 'Helvetica-Bold', color: toUnit([20, 184, 166]) },
					{ text: 'Body copy that wraps across the column nicely.', x: 72, y: 150, size: 12, font: 'Helvetica', color: toUnit([0, 0, 0]) },
				],
			},
		],
	});
	const ir = await parsePdfBuffer(pdf);
	const { merged, designTokens, report } = mapTokens(ir);

	assert.ok(report.valid, JSON.stringify(report.validationErrors));
	assert.ok(merged.settings.color.palette.length >= 10);
	assert.ok(designTokens.color, 'a distinct headline color should derive a color token');
	// Styles synthesized from the PDF were mapped to typography slugs.
	assert.ok(Object.keys(report.provenance.styleToSlug).length > 0);
});
