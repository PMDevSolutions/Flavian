// Round-trip agreement: build the *same logical document* two ways — as IDML
// and as an InDesign-style PDF export — parse both, and assert the IRs agree
// within documented tolerances. This is the cross-check the issue calls for:
// PDF is a lossy fallback, so we assert structural agreement, not equality.
//
// Documented tolerances (see docs/pipeline/indesign-pdf-fidelity.md):
//   - page / spread count ........ exact
//   - image frame count .......... exact
//   - text frame count ........... within ±1
//   - style bucket count ......... within ±1
//   - swatches ................... PDF colors snap to the IDML swatch palette

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdmlBuffer } from '../../src/indesign/parse-idml.js';
import { parsePdfBuffer } from '../../src/indesign/parse-pdf.js';
import { buildIdml } from './helpers/build-idml.js';
import { buildPdf } from './helpers/build-pdf.js';

const BRAND = [0, 102, 204]; // #0066cc
const INK = [0, 0, 0]; // #000000

function buildIdmlVersion() {
	return buildIdml({
		name: 'Round Trip',
		colors: [
			{ id: 'col-brand', name: 'Brand Blue', space: 'RGB', values: BRAND },
			{ id: 'col-ink', name: 'Ink', space: 'CMYK', values: [0, 0, 0, 100] },
		],
		fonts: [
			{ id: 'font-helv-bold', family: 'Helvetica', style: 'Bold', postScriptName: 'Helvetica-Bold' },
			{ id: 'font-helv-reg', family: 'Helvetica', style: 'Regular', postScriptName: 'Helvetica' },
		],
		styles: [
			{ id: 'pstyle-h1', name: 'Heading 1', kind: 'paragraph', pointSize: 36, appliedFont: 'font-helv-bold', fillColor: 'col-brand' },
			{ id: 'pstyle-body', name: 'Body', kind: 'paragraph', pointSize: 12, appliedFont: 'font-helv-reg', fillColor: 'col-ink' },
		],
		stories: [
			{ id: 'story-headline', runs: [{ text: 'Welcome', paragraphStyle: 'pstyle-h1' }] },
			{
				id: 'story-body',
				runs: [{ text: 'Print to web in one pass with a usable styled result.', paragraphStyle: 'pstyle-body' }],
			},
		],
		spreads: [
			{
				id: 'spread-1',
				pages: [{ id: 'page-1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'frame-headline', bounds: [72, 72, 130, 400], parentStory: 'story-headline' },
					{ kind: 'text', id: 'frame-body', bounds: [140, 72, 220, 400], parentStory: 'story-body' },
					{ kind: 'image', id: 'frame-hero', bounds: [250, 72, 430, 400], href: 'file:Resources/hero.jpg' },
				],
			},
		],
	});
}

function buildPdfVersion() {
	const toUnit = ([r, g, b]) => [r / 255, g / 255, b / 255];
	return buildPdf({
		title: 'Round Trip',
		pages: [
			{
				width: 612,
				height: 792,
				texts: [
					{ text: 'Welcome', x: 72, y: 96, size: 36, font: 'Helvetica-Bold', color: toUnit(BRAND) },
					{ text: 'Print to web in one pass with a usable', x: 72, y: 150, size: 12, font: 'Helvetica', color: toUnit(INK) },
					{ text: 'styled result that needs only light touch-ups.', x: 72, y: 166, size: 12, font: 'Helvetica', color: toUnit(INK) },
				],
				images: [{ x: 72, y: 220, width: 240, height: 160, rgb: { width: 6, height: 4, data: new Uint8Array(6 * 4 * 3).fill(128) } }],
			},
		],
	});
}

test('round-trip: page, frame, and style-bucket counts agree within tolerance', async () => {
	const idml = parseIdmlBuffer(buildIdmlVersion());
	const pdf = await parsePdfBuffer(buildPdfVersion(), { swatchPalette: idml.swatches });

	// Page / spread count: exact.
	assert.equal(pdf.spreads.length, idml.spreads.length);

	const countFrames = (ir, kind) =>
		ir.spreads.flatMap((s) => s.frames).filter((f) => f.kind === kind).length;

	// Image frames: exact.
	assert.equal(countFrames(pdf, 'image'), countFrames(idml, 'image'));

	// Text frames: within ±1.
	const idmlText = countFrames(idml, 'text');
	const pdfText = countFrames(pdf, 'text');
	assert.ok(Math.abs(idmlText - pdfText) <= 1, `text frames: idml=${idmlText} pdf=${pdfText}`);

	// Style buckets: within ±1 (IDML has h1 + body; PDF synthesizes the same two).
	assert.ok(Math.abs(idml.styles.length - pdf.styles.length) <= 1, `styles: idml=${idml.styles.length} pdf=${pdf.styles.length}`);
});

test('round-trip: detected PDF colors snap onto the IDML swatch palette', async () => {
	const idml = parseIdmlBuffer(buildIdmlVersion());
	const pdf = await parsePdfBuffer(buildPdfVersion(), { swatchPalette: idml.swatches });

	const pdfSwatchIds = new Set(pdf.swatches.map((s) => s.id));
	assert.ok(pdfSwatchIds.has('col-brand'), 'brand blue should snap to col-brand');
	assert.ok(pdfSwatchIds.has('col-ink'), 'near-black should snap to col-ink');

	// And the synthesized heading style references the shared swatch id.
	const h1 = pdf.styles.find((s) => s.properties.role === 'heading');
	assert.equal(h1.fillColorRef, 'col-brand');
});

test('round-trip: the same prose is recoverable from both IRs', async () => {
	const idml = parseIdmlBuffer(buildIdmlVersion());
	const pdf = await parsePdfBuffer(buildPdfVersion());

	const prose = (ir) =>
		ir.stories
			.flatMap((s) => s.runs.map((r) => r.text))
			.join(' ')
			.replace(/\s+/g, ' ')
			.toLowerCase();

	assert.ok(prose(idml).includes('welcome'));
	assert.ok(prose(pdf).includes('welcome'));
	assert.ok(prose(pdf).includes('print to web in one pass'));
});
