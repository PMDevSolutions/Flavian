// In-memory PDF fixture builder. Tests call buildPdf({...}) and get back a
// Uint8Array they can hand straight to parsePdfBuffer().
//
// Mirrors the philosophy of build-idml.js: no binary blobs in git, fixtures are
// generated from a readable spec. We emit the small subset of PDF the fallback
// parser reads — positioned text runs in base-14 (non-embedded) fonts, placed
// FlateDecode/DeviceRGB image XObjects, and optional vector fills.
//
// Coordinates in the spec use a TOP-LEFT origin measured in points (y grows
// downward), because that matches how the parser reports geometry and how a
// designer thinks about a page. We flip to PDF's native bottom-left origin
// while writing.

import { deflateSync } from 'node:zlib';

const DEFAULT_PAGE = { width: 612, height: 792 }; // US Letter, points.

/**
 * @typedef {Object} TextSpec
 * @property {string} text
 * @property {number} x       Left edge, points from page left.
 * @property {number} y       Baseline, points from page top.
 * @property {number} size    Font size in points.
 * @property {string} [font]  Base-14 font name (default 'Helvetica').
 * @property {[number, number, number]} [color] Fill color, 0..1 RGB (default black).
 *
 * @typedef {Object} ImageSpec
 * @property {number} x        Left edge, points from page left.
 * @property {number} y        Top edge, points from page top.
 * @property {number} width    Display width in points.
 * @property {number} height   Display height in points.
 * @property {{width: number, height: number, data: Uint8Array}} rgb  Raw 8bpc RGB pixels (width*height*3 bytes).
 *
 * @typedef {Object} RectSpec
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {[number, number, number]} [color]
 *
 * @typedef {Object} PageSpec
 * @property {number} [width]
 * @property {number} [height]
 * @property {TextSpec[]} [texts]
 * @property {ImageSpec[]} [images]
 * @property {RectSpec[]} [rects]
 *
 * @typedef {Object} BuildPdfOptions
 * @property {string} [title]   Document title (/Info /Title).
 * @property {PageSpec[]} pages
 */

/**
 * @param {BuildPdfOptions} options
 * @returns {Uint8Array}
 */
export function buildPdf(options) {
	const pages = (options.pages ?? []).map((p) => ({
		width: p.width ?? DEFAULT_PAGE.width,
		height: p.height ?? DEFAULT_PAGE.height,
		texts: p.texts ?? [],
		images: p.images ?? [],
		rects: p.rects ?? [],
	}));

	const writer = new ObjectWriter();

	// Object 1 is the catalog, object 2 the pages tree. We reserve them up front
	// so child page objects can reference the parent by a known id.
	const catalogId = writer.reserve();
	const pagesId = writer.reserve();

	const pageIds = [];
	for (const page of pages) {
		pageIds.push(buildPageObjects(writer, page, pagesId));
	}

	writer.define(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
	writer.define(
		pagesId,
		`<< /Type /Pages /Kids [ ${pageIds.map((id) => `${id} 0 R`).join(' ')} ] /Count ${pageIds.length} >>`,
	);

	let infoId;
	if (options.title) {
		infoId = writer.add(`<< /Title (${escapePdfString(options.title)}) /Producer (flavian-test) >>`);
	}

	return writer.serialize(catalogId, infoId);
}

/**
 * Emit the content stream + page dict + its resource objects.
 * Returns the page object id.
 */
function buildPageObjects(writer, page, pagesId) {
	const fontResources = new Map(); // base-font name -> resource key (F1, F2…)
	const xobjectResources = new Map(); // image object id -> resource key (Im1…)

	const ops = [];

	// Vector fills first (drawn underneath).
	for (const rect of page.rects) {
		const [r, g, b] = rect.color ?? [0, 0, 0];
		const yPdf = page.height - rect.y - rect.height;
		ops.push(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg`);
		ops.push(`${fmt(rect.x)} ${fmt(yPdf)} ${fmt(rect.width)} ${fmt(rect.height)} re f`);
	}

	// Images.
	for (const image of page.images) {
		const imgId = writer.add(imageXObject(image.rgb));
		let key = xobjectResources.get(imgId);
		if (!key) {
			key = `Im${xobjectResources.size + 1}`;
			xobjectResources.set(imgId, key);
		}
		const yPdf = page.height - image.y - image.height;
		// cm maps the unit square to the placement rectangle.
		ops.push('q');
		ops.push(`${fmt(image.width)} 0 0 ${fmt(image.height)} ${fmt(image.x)} ${fmt(yPdf)} cm`);
		ops.push(`/${key} Do`);
		ops.push('Q');
	}

	// Text runs.
	for (const t of page.texts) {
		const fontName = t.font ?? 'Helvetica';
		let fontKey = fontResources.get(fontName);
		if (!fontKey) {
			fontKey = `F${fontResources.size + 1}`;
			fontResources.set(fontName, fontKey);
		}
		const [r, g, b] = t.color ?? [0, 0, 0];
		const yPdf = page.height - t.y;
		ops.push('BT');
		ops.push(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg`);
		ops.push(`/${fontKey} ${fmt(t.size)} Tf`);
		ops.push(`${fmt(t.x)} ${fmt(yPdf)} Td`);
		ops.push(`(${escapePdfString(t.text)}) Tj`);
		ops.push('ET');
	}

	const contentStream = ops.join('\n') + '\n';
	const contentId = writer.add(streamObject('<< /Length LEN >>', Buffer.from(contentStream, 'latin1')));

	// Font objects.
	const fontEntries = [];
	for (const [baseFont, key] of fontResources) {
		const fontId = writer.add(
			`<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`,
		);
		fontEntries.push(`/${key} ${fontId} 0 R`);
	}

	const xobjectEntries = [];
	for (const [imgId, key] of xobjectResources) {
		xobjectEntries.push(`/${key} ${imgId} 0 R`);
	}

	const resourceParts = ['/ProcSet [ /PDF /Text /ImageC ]'];
	if (fontEntries.length > 0) {
		resourceParts.push(`/Font << ${fontEntries.join(' ')} >>`);
	}
	if (xobjectEntries.length > 0) {
		resourceParts.push(`/XObject << ${xobjectEntries.join(' ')} >>`);
	}

	return writer.add(
		`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [ 0 0 ${fmt(page.width)} ${fmt(page.height)} ] ` +
			`/Resources << ${resourceParts.join(' ')} >> /Contents ${contentId} 0 R >>`,
	);
}

/**
 * A FlateDecode/DeviceRGB 8-bit image XObject. pdfjs decodes this to raw RGB
 * without needing a canvas, which is exactly what the parser's extractor reads.
 */
function imageXObject(rgb) {
	const raw = Buffer.from(rgb.data.buffer ?? rgb.data, rgb.data.byteOffset ?? 0, rgb.data.byteLength ?? rgb.data.length);
	const compressed = deflateSync(raw);
	const dict =
		`<< /Type /XObject /Subtype /Image /Width ${rgb.width} /Height ${rgb.height} ` +
		`/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length LEN >>`;
	return streamObject(dict, compressed);
}

/** Marker so the writer knows this object carries a binary stream payload. */
function streamObject(dict, payload) {
	return { dict, payload };
}

class ObjectWriter {
	constructor() {
		/** @type {Array<string | {dict: string, payload: Buffer} | null>} */
		this.objects = [];
	}

	/** Reserve an id, to be filled in later with define(). */
	reserve() {
		this.objects.push(null);
		return this.objects.length;
	}

	define(id, body) {
		this.objects[id - 1] = body;
	}

	/** Append a fully-formed object and return its id. */
	add(body) {
		this.objects.push(body);
		return this.objects.length;
	}

	/**
	 * Assemble the file with a correct classic xref table.
	 * @param {number} rootId
	 * @param {number} [infoId]
	 * @returns {Uint8Array}
	 */
	serialize(rootId, infoId) {
		const chunks = [];
		let offset = 0;
		const offsets = new Array(this.objects.length + 1).fill(0);

		const push = (buf) => {
			chunks.push(buf);
			offset += buf.length;
		};

		// Binary marker comment keeps tools (and pdfjs heuristics) treating the
		// file as binary.
		push(Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'latin1'));

		for (let i = 0; i < this.objects.length; i += 1) {
			const id = i + 1;
			const body = this.objects[i];
			if (body === null) {
				throw new Error(`PDF object ${id} was reserved but never defined`);
			}
			offsets[id] = offset;
			push(Buffer.from(`${id} 0 obj\n`, 'latin1'));
			if (typeof body === 'string') {
				push(Buffer.from(body + '\n', 'latin1'));
			} else {
				const dict = body.dict.replace('LEN', String(body.payload.length));
				push(Buffer.from(dict + '\nstream\n', 'latin1'));
				push(body.payload);
				push(Buffer.from('\nendstream\n', 'latin1'));
			}
			push(Buffer.from('endobj\n', 'latin1'));
		}

		const xrefOffset = offset;
		const count = this.objects.length + 1;
		let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
		for (let id = 1; id < count; id += 1) {
			xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
		}
		push(Buffer.from(xref, 'latin1'));

		const trailerParts = [`/Size ${count}`, `/Root ${rootId} 0 R`];
		if (infoId) {
			trailerParts.push(`/Info ${infoId} 0 R`);
		}
		push(Buffer.from(`trailer\n<< ${trailerParts.join(' ')} >>\nstartxref\n${xrefOffset}\n%%EOF\n`, 'latin1'));

		return new Uint8Array(Buffer.concat(chunks));
	}
}

/** Format a number for PDF content streams: trim trailing zeros, no exponent. */
function fmt(n) {
	if (!Number.isFinite(n)) return '0';
	return (Math.round(n * 1000) / 1000).toString();
}

function escapePdfString(s) {
	return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Convenience: a solid-color RGB image buffer for image fixtures.
 *
 * @param {number} width
 * @param {number} height
 * @param {[number, number, number]} rgb 0..255 per channel.
 * @returns {{width: number, height: number, data: Uint8Array}}
 */
export function solidRgbImage(width, height, [r, g, b]) {
	const data = new Uint8Array(width * height * 3);
	for (let i = 0; i < width * height; i += 1) {
		data[i * 3] = r;
		data[i * 3 + 1] = g;
		data[i * 3 + 2] = b;
	}
	return { width, height, data };
}
