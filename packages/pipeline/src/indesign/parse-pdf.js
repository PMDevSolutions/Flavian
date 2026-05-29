// PDF fallback parser. Reads a PDF exported from InDesign and reconstructs an
// approximation of the same IR the IDML parser emits, so the downstream mapper
// and generator can consume either source.
//
// PDF is intentionally lossy: there are no named styles, no text frames, no
// swatch palette — just absolutely-positioned glyph runs, fill colors, and
// placed images. We rebuild a *usable, styled* IR (not a pixel-perfect one) and
// attach fidelity warnings describing every approximation we made. Use IDML
// when you have it; use this when you don't, or to cross-check IDML output.
//
// Failure philosophy mirrors parse-idml.js: throw only when the document can't
// be opened at all; everything else becomes a warning and a partial IR.

import { promises as fs } from 'node:fs';

import { Document } from './ir.js';
import { WarningCollector } from './warnings.js';
import { ptToPx, roundPx } from './units.js';
import { openDocument, loadPdfjs } from './pdf/pdfjs.js';
import { extractPage } from './pdf/extract.js';
import { clusterIntoFrames, detectColumns } from './pdf/cluster.js';
import { classifyStyles } from './pdf/classify.js';
import { nearestSwatch } from './pdf/color.js';
import { assetHref, writeAsset } from './pdf/assets.js';

const DEFAULT_DPI = 96;

/**
 * @typedef {Object} ParsePdfOptions
 * @property {number} [dpi]                 Pixels-per-inch for unit normalization. Default 96.
 * @property {string} [name]                Override the document name (defaults to PDF /Title or the file basename).
 * @property {string} [assetCacheDir]       If set, extracted images are PNG-encoded and written here.
 * @property {Array<import('./ir.js').SwatchIR>} [swatchPalette]  IDML-derived swatches to snap detected colors to.
 */

/**
 * Parse a PDF file from disk.
 *
 * @param {string} path
 * @param {ParsePdfOptions} [options]
 * @returns {Promise<import('./ir.js').DocumentIR>}
 */
export async function parsePdf(path, options = {}) {
	const bytes = await fs.readFile(path);
	const fallbackName = path.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '');
	return parsePdfBuffer(bytes, { ...options, name: options.name ?? fallbackName });
}

/**
 * Parse PDF bytes already in memory.
 *
 * @param {Uint8Array} bytes
 * @param {ParsePdfOptions} [options]
 * @returns {Promise<import('./ir.js').DocumentIR>}
 */
export async function parsePdfBuffer(bytes, options = {}) {
	const dpi = options.dpi ?? DEFAULT_DPI;
	const palette = options.swatchPalette ?? [];
	const warnings = new WarningCollector();

	let doc;
	try {
		doc = await openDocument(bytes);
	} catch (err) {
		throw new Error(`PDF could not be opened: ${err.message}`);
	}

	let title;
	try {
		const md = await doc.getMetadata();
		title = md?.info?.Title || undefined;
	} catch {
		// Metadata is optional; ignore.
	}

	const pdfjs = await loadPdfjs();

	// --- Pass 1: extract every page, normalizing font keys to a global identity.
	const fontsById = new Map(); // fontId -> { id, family, style, postScriptName }
	const pages = [];
	const allItems = [];
	const allColorSamples = [];
	let anyVector = false;
	let anyEmbeddedFont = false;
	let sawFonts = false;

	for (let p = 0; p < doc.numPages; p += 1) {
		const page = await doc.getPage(p + 1);
		const extracted = await extractPage(page, pdfjs);
		// Note: we deliberately don't page.cleanup() here — decoded image bytes
		// are PNG-encoded later, and cleanup can clear page.objs out from under us.
		// doc.cleanup() at the end releases everything.

		// loader font key (page-scoped, e.g. "g_d0_f1") -> stable global font id.
		const localToGlobal = new Map();
		for (const [localKey, font] of extracted.fonts) {
			sawFonts = true;
			if (font.embedded) anyEmbeddedFont = true;
			const id = fontId(font.name);
			if (!fontsById.has(id)) {
				fontsById.set(id, { id, family: font.family, style: font.style, postScriptName: font.name });
			}
			localToGlobal.set(localKey, id);
		}

		const items = extracted.textItems.map((it) => ({
			...it,
			fontKey: localToGlobal.get(it.fontKey) ?? it.fontKey,
		}));
		allItems.push(...items);
		allColorSamples.push(...extracted.colorSamples);
		if (extracted.hasVector) anyVector = true;

		pages.push({ index: p, ...extracted, items });
	}

	// --- Swatches: distinct detected colors, snapped to the IDML palette if given.
	const swatches = [];
	const hexToSwatchId = new Map();
	for (const sample of allColorSamples) {
		if (hexToSwatchId.has(sample.hex)) continue;
		const matched = palette.length ? nearestSwatch(sample.hex, palette) : null;
		if (matched) {
			hexToSwatchId.set(sample.hex, matched.id);
			if (!swatches.some((s) => s.id === matched.id)) swatches.push(matched);
		} else {
			const id = `pdf-color-${sample.hex.slice(1)}`;
			hexToSwatchId.set(sample.hex, id);
			swatches.push({ id, name: sample.hex.toUpperCase(), color: { hex: sample.hex, space: sample.space ?? 'RGB', components: sample.components } });
		}
	}

	// --- Styles: synthesize buckets from font-size distribution.
	const { buckets, styleIdForSize } = classifyStyles({ items: allItems, colorSamples: allColorSamples, dpi });
	const styles = buckets.map((b) => ({
		id: b.id,
		name: b.name,
		kind: 'paragraph',
		fontSize: b.fontSizePx,
		fontRef: b.dominantFontKey && fontsById.has(b.dominantFontKey) ? b.dominantFontKey : undefined,
		fillColorRef: b.dominantHex ? hexToSwatchId.get(b.dominantHex) : undefined,
		properties: { role: b.role, sourceSizePt: b.sizePt },
	}));

	// --- Spreads: one per page, with reconstructed text + image frames.
	const stories = [];
	const spreads = [];
	const pendingWrites = []; // { href, image } to persist if assetCacheDir is set
	for (const page of pages) {
		const pageNum = page.index + 1;
		const frames = [];

		const blocks = clusterIntoFrames(page.items);
		const columns = detectColumns(blocks);
		if (columns > 1) {
			warnings.add(
				'multi-column-layout',
				`Page ${pageNum}: detected ${columns} columns; emitted as ${blocks.length} separate text frames`,
				{ file: `pdf:page:${pageNum}` },
			);
		}

		blocks.forEach((block, idx) => {
			const storyId = `pdf-story-p${pageNum}-${idx + 1}`;
			stories.push({ id: storyId, source: `pdf:page:${pageNum}`, runs: blockToRuns(block, styleIdForSize) });
			frames.push({
				kind: 'text',
				id: `pdf-frame-p${pageNum}-t${idx + 1}`,
				bounds: rectToPx(block.bounds, dpi),
				storyRef: storyId,
			});
		});

		page.images.forEach((img, idx) => {
			const href = assetHref(page.index, idx);
			frames.push({
				kind: 'image',
				id: `pdf-frame-p${pageNum}-i${idx + 1}`,
				bounds: boxToPx(img, dpi),
				href,
				embedded: true,
			});
			if (img.failed) {
				warnings.add('image-extract-failed', `Page ${pageNum}: could not decode image ${href}`, {
					file: `pdf:page:${pageNum}`,
				});
			} else if (options.assetCacheDir) {
				// Defer the actual write (collected below) so failures don't abort.
				pendingWrites.push({ href, image: img.image });
			}
		});

		if (frames.length === 0) {
			warnings.add('empty-page', `Page ${pageNum} produced no text or image frames`, {
				file: `pdf:page:${pageNum}`,
			});
		}

		spreads.push({
			id: `pdf-spread-${pageNum}`,
			source: `pdf:page:${pageNum}`,
			pages: [{ id: `pdf-page-${pageNum}`, bounds: { x: 0, y: 0, width: roundPx(ptToPx(page.widthPt, dpi)), height: roundPx(ptToPx(page.heightPt, dpi)) } }],
			frames,
			appliedMasterRef: undefined,
		});
	}

	// --- Persist extracted images, if a cache dir was given.
	if (options.assetCacheDir) {
		for (const w of pendingWrites) {
			try {
				await writeAsset(options.assetCacheDir, w.href, w.image);
			} catch (err) {
				warnings.add('asset-write-failed', `Failed writing ${w.href}: ${err.message}`);
			}
		}
	}

	// --- Fidelity warnings: describe every approximation.
	addFidelityWarnings(warnings, {
		sawFonts,
		anyEmbeddedFont,
		anyColor: allColorSamples.length > 0,
		anyVector,
		hasStyles: styles.length > 0,
	});

	const document = Document.parse({
		irVersion: 1,
		// Embedded /Title wins over the caller-supplied/filename fallback, mirroring
		// how the IDML parser prefers designmap's @Name.
		meta: { name: title ?? options.name },
		dpi,
		swatches,
		fonts: [...fontsById.values()],
		styles,
		stories,
		spreads,
		masterSpreads: [],
		warnings: warnings.list(),
	});

	await doc.cleanup();
	return document;
}

/**
 * @param {import('./pdf/cluster.js').TextBlock} block
 * @param {(sizePt: number) => string | undefined} styleIdForSize
 * @returns {Array<import('./ir.js').TextRun>}
 */
function blockToRuns(block, styleIdForSize) {
	const runs = [];
	for (const line of block.lines) {
		line.items.forEach((item, idx) => {
			let text = item.text;
			if (idx < line.items.length - 1) text += ' ';
			runs.push({ text, paragraphStyleRef: styleIdForSize(item.fontSize) });
		});
		// Close each line with a newline so prose re-flows downstream.
		if (runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
			runs[runs.length - 1].text += '\n';
		}
	}
	return runs;
}

function rectToPx(b, dpi) {
	return {
		x: roundPx(ptToPx(b.minX, dpi)),
		y: roundPx(ptToPx(b.minY, dpi)),
		width: roundPx(ptToPx(Math.max(0, b.maxX - b.minX), dpi)),
		height: roundPx(ptToPx(Math.max(0, b.maxY - b.minY), dpi)),
	};
}

function boxToPx(box, dpi) {
	return {
		x: roundPx(ptToPx(box.x, dpi)),
		y: roundPx(ptToPx(box.y, dpi)),
		width: roundPx(ptToPx(Math.max(0, box.width), dpi)),
		height: roundPx(ptToPx(Math.max(0, box.height), dpi)),
	};
}

function fontId(psName) {
	const slug = psName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `pdf-font-${slug || 'unknown'}`;
}

function addFidelityWarnings(warnings, flags) {
	warnings.add(
		'pdf-fallback',
		'IR reconstructed from PDF; layout, frames, and styles are approximate. Prefer IDML when available.',
	);
	warnings.add(
		'text-reconstructed-from-glyphs',
		'Text was recovered from positioned glyph runs; ligatures, hidden text, and reading order may differ from the source.',
	);
	if (flags.hasStyles) {
		warnings.add(
			'styles-synthesized',
			'Paragraph styles were inferred from font-size buckets, not real named styles.',
		);
	}
	if (flags.sawFonts && !flags.anyEmbeddedFont) {
		warnings.add(
			'no-embedded-fonts',
			'No embedded fonts found; font family/style mapping is best-effort from PostScript names.',
		);
	}
	if (flags.anyColor) {
		warnings.add(
			'color-attribution-approximate',
			'Swatch attribution is heuristic: colors are bucketed by font size, not resolved per run.',
		);
	}
	if (flags.anyVector) {
		warnings.add(
			'vector-paths-dropped',
			'Vector paths and image masks were detected but are not represented in the IR.',
		);
	}
}
