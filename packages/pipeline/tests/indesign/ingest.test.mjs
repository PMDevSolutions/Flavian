// End-to-end ingest stage: auto-detect → parse → validate → enrich → artifact,
// for both input formats. The emitted artifact must still be consumable by the
// generator (it's a valid IR plus an additive `content` key) and deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ingestBuffer, toArtifact } from '../../src/indesign/ingest/index.js';
import { generateTheme } from '../../src/indesign/generate/index.js';
import { Document } from '../../src/indesign/ir.js';
import { buildIdml } from './helpers/build-idml.js';
import { buildPdf, solidRgbImage } from './helpers/build-pdf.js';

function sampleIdml() {
	return buildIdml({
		name: 'Spring Mini',
		colors: [{ id: 'c-brand', name: 'Brand', space: 'RGB', values: [0, 102, 204] }],
		fonts: [{ id: 'f', family: 'Helvetica', style: 'Bold', postScriptName: 'Helvetica-Bold' }],
		styles: [
			{ id: 'h1', name: 'Heading 1', kind: 'paragraph', pointSize: 36, appliedFont: 'f', fillColor: 'c-brand' },
			{ id: 'body', name: 'Body', kind: 'paragraph', pointSize: 12, appliedFont: 'f' },
		],
		stories: [
			{ id: 's-title', runs: [{ text: 'Welcome', paragraphStyle: 'h1' }] },
			{ id: 's-body', runs: [{ text: 'Browse our spring collection.', paragraphStyle: 'body' }] },
			{ id: 's-hero', runs: [{ text: 'On Sale Now', paragraphStyle: 'h1' }] },
		],
		spreads: [
			{
				id: 'cover',
				pages: [{ id: 'p1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'tf-title', bounds: [60, 60, 150, 540], parentStory: 's-title' },
					{ kind: 'text', id: 'tf-body', bounds: [170, 60, 320, 540], parentStory: 's-body' },
				],
			},
			{
				id: 'hero',
				pages: [{ id: 'p2', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'image', id: 'if-hero', bounds: [0, 0, 612, 792], href: 'file:Links/hero.png' },
					{ kind: 'text', id: 'tf-hero', bounds: [240, 100, 330, 500], parentStory: 's-hero' },
				],
			},
		],
	});
}

function samplePdf() {
	const unit = ([r, g, b]) => [r / 255, g / 255, b / 255];
	return buildPdf({
		title: 'Spring Mini',
		pages: [
			{
				width: 612,
				height: 792,
				texts: [
					{ text: 'Welcome', x: 60, y: 96, size: 36, font: 'Helvetica-Bold', color: unit([0, 102, 204]) },
					{ text: 'Browse our spring collection.', x: 60, y: 150, size: 12, font: 'Helvetica', color: unit([0, 0, 0]) },
				],
			},
			{
				width: 612,
				height: 792,
				images: [{ x: 0, y: 0, width: 612, height: 792, rgb: solidRgbImage(16, 16, [0, 102, 204]) }],
				texts: [{ text: 'On Sale Now', x: 80, y: 420, size: 36, font: 'Helvetica-Bold', color: unit([255, 255, 255]) }],
			},
		],
	});
}

test('ingests IDML bytes into a validated, content-bearing IR', async () => {
	const result = await ingestBuffer(sampleIdml());

	assert.equal(result.format, 'idml');
	assert.equal(result.ir.meta.name, 'Spring Mini');
	assert.equal(result.ir.spreads.length, 2);

	// Content model: a heading per spread, a paragraph, and the hero figure.
	assert.equal(result.content.stats.sections, 2);
	assert.equal(result.content.stats.headings, 2);
	assert.equal(result.content.stats.figures, 1);
	assert.deepEqual(result.content.outline.map((h) => h.text), ['Welcome', 'On Sale Now']);

	// On the hero spread, the image reads before the overlaid headline.
	const heroBlocks = result.content.sections[1].blocks.map((b) => b.type);
	assert.deepEqual(heroBlocks, ['figure', 'heading']);
});

test('the artifact is a valid IR the generator consumes unchanged', async () => {
	const result = await ingestBuffer(sampleIdml());
	const artifact = toArtifact(result);

	// Superset of a valid Document: schema still parses (it ignores `content`).
	assert.doesNotThrow(() => Document.parse(artifact));
	assert.ok(artifact.content, 'artifact carries the content model');

	// The generator accepts the enriched artifact and produces a valid theme.
	const theme = generateTheme(artifact);
	assert.equal(theme.report.data.valid, true);
	const patterns = theme.files.filter((f) => /^patterns\/spread-\d+\.php$/.test(f.path));
	assert.equal(patterns.length, result.ir.spreads.length);
});

test('ingest is deterministic — same bytes yield byte-identical JSON', async () => {
	const bytes = sampleIdml();
	const a = JSON.stringify(toArtifact(await ingestBuffer(bytes)));
	const b = JSON.stringify(toArtifact(await ingestBuffer(bytes)));
	assert.equal(a, b);
});

test('--no-content emits the bare IR (no content key)', async () => {
	const result = await ingestBuffer(sampleIdml(), { content: false });
	assert.equal(result.content, null);
	assert.equal(toArtifact(result).content, undefined);
});

test('ingests PDF bytes via the lossy fallback path', async () => {
	const result = await ingestBuffer(samplePdf());

	assert.equal(result.format, 'pdf');
	assert.ok(result.ir.spreads.length >= 1);
	// PDF reconstruction is always lossy → fidelity warnings are expected.
	assert.ok((result.ir.warnings ?? []).length > 0);

	const s = result.content.stats;
	assert.ok(s.sections >= 1);
	assert.ok(s.blocks >= 1);
	assert.equal(s.blocks, s.headings + s.paragraphs + s.figures);
});

test('honors an explicit --format override', async () => {
	const forced = await ingestBuffer(sampleIdml(), { format: 'idml' });
	assert.equal(forced.format, 'idml');
	assert.equal(forced.ir.spreads.length, 2);
});

test('rejects an unrecognized source', async () => {
	await assert.rejects(
		() => ingestBuffer(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
		/Unrecognized source/,
	);
});
