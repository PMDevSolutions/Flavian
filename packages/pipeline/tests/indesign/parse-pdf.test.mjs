// Integration tests: drive the whole PDF parser against programmatically-built
// fixtures (text-heavy, image-heavy, multi-column, single-page brochure) and
// assert the reconstructed IR validates and matches expectations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsePdf, parsePdfBuffer } from '../../src/indesign/parse-pdf.js';
import { Document } from '../../src/indesign/ir.js';
import { buildPdf, solidRgbImage } from './helpers/build-pdf.js';

const warningCodes = (ir) => ir.warnings.map((w) => w.code);
const textFrames = (ir) => ir.spreads.flatMap((s) => s.frames.filter((f) => f.kind === 'text'));
const imageFrames = (ir) => ir.spreads.flatMap((s) => s.frames.filter((f) => f.kind === 'image'));

function bodyLines(count, { x = 72, startY = 120, size = 11, leading = 15, font = 'Helvetica' } = {}) {
	return Array.from({ length: count }, (_, i) => ({
		text: `Body copy line number ${i + 1} with enough words to be realistic.`,
		x,
		y: startY + i * leading,
		size,
		font,
	}));
}

test('text-heavy PDF: validates, one body style, single clustered frame', async () => {
	const ir = await parsePdfBuffer(buildPdf({ pages: [{ texts: bodyLines(8) }] }));
	const validated = Document.parse(ir);
	assert.equal(validated.irVersion, 1);
	assert.equal(validated.spreads.length, 1);

	const bodyStyles = ir.styles.filter((s) => s.properties.role === 'body');
	assert.equal(bodyStyles.length, 1);
	// 8 evenly-spaced lines in one column collapse to a single text frame.
	assert.equal(textFrames(ir).length, 1);
	const story = ir.stories.find((s) => s.id === textFrames(ir)[0].storyRef);
	assert.ok(story.runs.every((r) => r.paragraphStyleRef === 'pdf-style-body'));
});

test('image-heavy PDF: every image becomes an addressable image frame', async () => {
	const ir = await parsePdfBuffer(
		buildPdf({
			pages: [
				{
					texts: [{ text: 'Gallery', x: 72, y: 90, size: 18, font: 'Helvetica-Bold' }],
					images: [
						{ x: 72, y: 120, width: 150, height: 120, rgb: solidRgbImage(6, 5, [200, 30, 30]) },
						{ x: 240, y: 120, width: 150, height: 120, rgb: solidRgbImage(6, 5, [30, 200, 60]) },
						{ x: 72, y: 280, width: 150, height: 120, rgb: solidRgbImage(6, 5, [30, 60, 200]) },
					],
				},
			],
		}),
	);
	Document.parse(ir);
	const imgs = imageFrames(ir);
	assert.equal(imgs.length, 3);
	assert.ok(imgs.every((f) => f.embedded === true));
	assert.deepEqual(
		imgs.map((f) => f.href),
		['assets/pdf-p001-img001.png', 'assets/pdf-p001-img002.png', 'assets/pdf-p001-img003.png'],
	);
	assert.ok(imgs.every((f) => f.bounds.width > 0 && f.bounds.height > 0));
});

test('multi-column PDF: columns become separate frames + a warning', async () => {
	const left = bodyLines(4, { x: 72, startY: 120 }).map((t) => ({ ...t, text: 'Left ' + t.text.slice(0, 20) }));
	const right = bodyLines(4, { x: 340, startY: 120 }).map((t) => ({ ...t, text: 'Right ' + t.text.slice(0, 20) }));
	const ir = await parsePdfBuffer(buildPdf({ pages: [{ texts: [...left, ...right] }] }));
	Document.parse(ir);

	const frames = textFrames(ir).sort((a, b) => a.bounds.x - b.bounds.x);
	assert.ok(frames.length >= 2, `expected >=2 text frames, got ${frames.length}`);
	// The two columns don't horizontally overlap.
	assert.ok(frames[0].bounds.x + frames[0].bounds.width <= frames[1].bounds.x);
	assert.ok(warningCodes(ir).includes('multi-column-layout'));
});

test('single-page brochure: heading + body + caption + image all reconstructed', async () => {
	const ir = await parsePdfBuffer(
		buildPdf({
			title: 'Brochure',
			pages: [
				{
					texts: [
						{ text: 'Welcome', x: 72, y: 90, size: 36, font: 'Helvetica-Bold', color: [0, 0.4, 0.8] },
						...bodyLines(3, { startY: 150, size: 12 }),
						{ text: 'Figure 1: the hero image.', x: 72, y: 470, size: 8, color: [0.4, 0.4, 0.4] },
					],
					images: [{ x: 72, y: 220, width: 240, height: 160, rgb: solidRgbImage(8, 6, [120, 120, 120]) }],
				},
			],
		}),
	);
	Document.parse(ir);
	assert.equal(ir.meta.name, 'Brochure');

	const roles = new Set(ir.styles.map((s) => s.properties.role));
	assert.ok(roles.has('heading') && roles.has('body') && roles.has('caption'));
	assert.equal(imageFrames(ir).length, 1);
	assert.ok(textFrames(ir).length >= 3); // heading, body, caption separated

	// The heading style resolves both a font and a swatch.
	const h1 = ir.styles.find((s) => s.id === 'pdf-style-h1');
	assert.ok(h1.fontRef && ir.fonts.some((f) => f.id === h1.fontRef));
	assert.ok(h1.fillColorRef && ir.swatches.some((s) => s.id === h1.fillColorRef));
});

test('fidelity warnings are always present and describe approximations', async () => {
	const ir = await parsePdfBuffer(
		buildPdf({
			pages: [
				{
					texts: [{ text: 'Hello world', x: 72, y: 90, size: 12, color: [0.1, 0.1, 0.1] }],
					rects: [{ x: 0, y: 0, width: 612, height: 60, color: [0.9, 0.9, 0.9] }],
				},
			],
		}),
	);
	const codes = warningCodes(ir);
	assert.ok(codes.includes('pdf-fallback'));
	assert.ok(codes.includes('text-reconstructed-from-glyphs'));
	assert.ok(codes.includes('styles-synthesized'));
	assert.ok(codes.includes('no-embedded-fonts')); // base-14, not embedded
	assert.ok(codes.includes('color-attribution-approximate'));
	assert.ok(codes.includes('vector-paths-dropped')); // the rect fill
});

test('assetCacheDir: extracted images are written as readable PNGs', async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flavian-pdf-'));
	try {
		const ir = await parsePdfBuffer(
			buildPdf({
				pages: [
					{
						texts: [{ text: 'Pic', x: 72, y: 90, size: 12 }],
						images: [{ x: 72, y: 120, width: 100, height: 80, rgb: solidRgbImage(4, 3, [10, 20, 30]) }],
					},
				],
			}),
			{ assetCacheDir: dir },
		);
		const href = imageFrames(ir)[0].href;
		const buf = await fs.readFile(path.join(dir, href));
		assert.ok(buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
		assert.equal(buf.readUInt32BE(16), 4); // IHDR width
		assert.equal(buf.readUInt32BE(20), 3); // IHDR height
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
});

test('swatchPalette: detected colors snap to IDML swatch ids', async () => {
	const palette = [{ id: 'col-brand', name: 'Brand Blue', color: { hex: '#0066cc', space: 'RGB' } }];
	const ir = await parsePdfBuffer(
		// 0,0.4,0.8 → #0066cc exactly; use a slightly-off shade to prove snapping.
		buildPdf({ pages: [{ texts: [{ text: 'Brand', x: 72, y: 90, size: 24, color: [0.01, 0.4, 0.79] }] }] }),
		{ swatchPalette: palette },
	);
	assert.ok(ir.swatches.some((s) => s.id === 'col-brand'));
	const h1 = ir.styles.find((s) => s.properties.role === 'heading') ?? ir.styles[0];
	assert.equal(h1.fillColorRef, 'col-brand');
});

test('dpi scales geometry linearly', async () => {
	const make = (dpi) =>
		parsePdfBuffer(buildPdf({ pages: [{ texts: [{ text: 'Scale me', x: 72, y: 100, size: 12 }] }] }), { dpi });
	const lo = await make(72);
	const hi = await make(144);
	const loFrame = lo.spreads[0].frames.find((f) => f.kind === 'text').bounds;
	const hiFrame = hi.spreads[0].frames.find((f) => f.kind === 'text').bounds;
	assert.ok(Math.abs(hiFrame.width - loFrame.width * 2) < 0.01);
	assert.ok(Math.abs(hiFrame.x - loFrame.x * 2) < 0.01);
});

test('multi-page PDF yields one spread per page', async () => {
	const page = { texts: [{ text: 'Page text', x: 72, y: 90, size: 12 }] };
	const ir = await parsePdfBuffer(buildPdf({ pages: [page, page, page] }));
	assert.equal(ir.spreads.length, 3);
	assert.deepEqual(ir.spreads.map((s) => s.source), ['pdf:page:1', 'pdf:page:2', 'pdf:page:3']);
});

test('throws on bytes that are not a PDF', async () => {
	const garbage = new TextEncoder().encode('this is definitely not a pdf');
	await assert.rejects(() => parsePdfBuffer(garbage), /could not be opened/i);
});

test('parsePdf reads from disk (Buffer input) and prefers the embedded /Title', async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flavian-pdf-disk-'));
	try {
		const file = path.join(dir, 'report-2026.pdf');
		await fs.writeFile(file, buildPdf({ title: 'Quarterly Report', pages: [{ texts: bodyLines(3) }] }));
		const ir = await parsePdf(file);
		Document.parse(ir);
		// Embedded /Title beats the filename fallback.
		assert.equal(ir.meta.name, 'Quarterly Report');
		assert.equal(ir.spreads.length, 1);
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
});

test('parsePdf falls back to the filename when there is no /Title', async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flavian-pdf-disk-'));
	try {
		const file = path.join(dir, 'untitled-doc.pdf');
		await fs.writeFile(file, buildPdf({ pages: [{ texts: bodyLines(2) }] }));
		const ir = await parsePdf(file);
		assert.equal(ir.meta.name, 'untitled-doc');
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
});
