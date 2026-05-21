// Happy-path: a small but realistic IDML with swatches, fonts, styles, a
// story, a spread, and a master spread should round-trip into a valid IR.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdmlBuffer } from '../../src/indesign/parse-idml.js';
import { Document } from '../../src/indesign/ir.js';
import { buildIdml } from './helpers/build-idml.js';

function buildHappyPath() {
	return buildIdml({
		idmlVersion: '16.0',
		name: 'Brochure',
		colors: [
			{ id: 'col-brand', name: 'Brand Blue', space: 'RGB', values: [0, 102, 204] },
			{ id: 'col-ink',   name: 'Ink',        space: 'CMYK', values: [0, 0, 0, 100] },
		],
		fonts: [
			{ id: 'font-helv-reg',  family: 'Helvetica', style: 'Regular',  postScriptName: 'Helvetica' },
			{ id: 'font-helv-bold', family: 'Helvetica', style: 'Bold',     postScriptName: 'Helvetica-Bold' },
		],
		styles: [
			{ id: 'pstyle-h1',  name: 'Heading 1', kind: 'paragraph', pointSize: 36, leading: 42, appliedFont: 'font-helv-bold', fillColor: 'col-brand' },
			{ id: 'pstyle-body', name: 'Body',     kind: 'paragraph', pointSize: 12, leading: 16, appliedFont: 'font-helv-reg',  fillColor: 'col-ink' },
			{ id: 'cstyle-emph', name: 'Emphasis', kind: 'character' },
		],
		stories: [
			{
				id: 'story-headline',
				runs: [
					{ text: 'Welcome', paragraphStyle: 'pstyle-h1' },
					{ text: 'Print to web in one pass.', paragraphStyle: 'pstyle-body' },
				],
			},
		],
		spreads: [
			{
				id: 'spread-1',
				appliedMaster: 'master-A',
				pages: [{ id: 'page-1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text',  id: 'frame-headline', bounds: [36, 36, 360, 100], parentStory: 'story-headline' },
					{ kind: 'image', id: 'frame-hero',     bounds: [36, 200, 540, 550], href: 'file:Resources/hero.jpg' },
				],
			},
		],
		masters: [
			{
				id: 'master-A',
				name: 'A-Master',
				pages: [{ id: 'master-page-1', bounds: [0, 0, 792, 612] }],
				frames: [{ kind: 'text', id: 'master-folio', bounds: [720, 580, 770, 600] }],
			},
		],
	});
}

test('happy path: parses a full IDML into a validated IR', () => {
	const bytes = buildHappyPath();
	const ir = parseIdmlBuffer(bytes);

	// zod has already validated, but we want an explicit second pass that
	// surfaces field-level errors if the IR shape drifts later.
	const validated = Document.parse(ir);
	assert.equal(validated.irVersion, 1);
	assert.equal(validated.dpi, 96);
	assert.equal(validated.meta.idmlVersion, '16.0');
	assert.equal(validated.meta.name, 'Brochure');
});

test('happy path: all swatches/fonts/styles enumerated', () => {
	const ir = parseIdmlBuffer(buildHappyPath());

	assert.equal(ir.swatches.length, 2);
	assert.equal(ir.swatches.find((s) => s.id === 'col-brand')?.color.hex, '#0066cc');
	assert.equal(ir.swatches.find((s) => s.id === 'col-brand')?.color.space, 'RGB');
	// CMYK 0/0/0/100 should approximate to near-black.
	assert.equal(ir.swatches.find((s) => s.id === 'col-ink')?.color.hex, '#000000');

	assert.equal(ir.fonts.length, 2);
	assert.equal(ir.fonts[0].family, 'Helvetica');

	assert.equal(ir.styles.length, 3);
	const h1 = ir.styles.find((s) => s.id === 'pstyle-h1');
	assert.ok(h1);
	// 36pt at 96dpi = 48px
	assert.equal(h1.fontSize, 48);
	// 42pt at 96dpi = 56px
	assert.equal(h1.leading, 56);
});

test('happy path: stories carry runs with paragraph style refs', () => {
	const ir = parseIdmlBuffer(buildHappyPath());

	assert.equal(ir.stories.length, 1);
	const story = ir.stories[0];
	assert.equal(story.id, 'story-headline');
	assert.equal(story.runs.length, 2);
	assert.equal(story.runs[0].paragraphStyleRef, 'pstyle-h1');
	assert.ok(story.runs[0].text.includes('Welcome'));
});

test('happy path: spread frames + master inheritance survive', () => {
	const ir = parseIdmlBuffer(buildHappyPath());

	assert.equal(ir.spreads.length, 1);
	const spread = ir.spreads[0];
	assert.equal(spread.appliedMasterRef, 'master-A');
	assert.equal(spread.frames.length, 2);

	const textFrame = spread.frames.find((f) => f.kind === 'text');
	assert.equal(textFrame.storyRef, 'story-headline');

	const imageFrame = spread.frames.find((f) => f.kind === 'image');
	assert.equal(imageFrame.href, 'file:Resources/hero.jpg');
	assert.equal(imageFrame.embedded, true);
});

test('happy path: image frames have positive normalized bounds', () => {
	const ir = parseIdmlBuffer(buildHappyPath());
	const imageFrame = ir.spreads[0].frames.find((f) => f.kind === 'image');
	// 36pt → 48px at 96dpi, etc. We only check sign + positive area.
	assert.ok(imageFrame.bounds.width > 0);
	assert.ok(imageFrame.bounds.height > 0);
});

test('happy path: configurable DPI scales geometry', () => {
	const lo = parseIdmlBuffer(buildHappyPath(), { dpi: 72 });
	const hi = parseIdmlBuffer(buildHappyPath(), { dpi: 144 });
	const frameLo = lo.spreads[0].frames.find((f) => f.kind === 'text').bounds;
	const frameHi = hi.spreads[0].frames.find((f) => f.kind === 'text').bounds;
	// 144 dpi = 2x the px of 72 dpi.
	assert.equal(frameHi.width, frameLo.width * 2);
	assert.equal(frameHi.height, frameLo.height * 2);
});

test('happy path: no parse warnings on clean input', () => {
	const ir = parseIdmlBuffer(buildHappyPath());
	assert.deepEqual(ir.warnings, []);
});
