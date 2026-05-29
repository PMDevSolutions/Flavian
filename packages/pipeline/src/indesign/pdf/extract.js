// The one module that talks to pdfjs. Everything pdfjs-shaped is converted here
// into plain data the pure modules (cluster, classify, color, png) can consume,
// so the heuristics stay unit-testable without a PDF engine.
//
// Per page we pull four things:
//   - positioned text runs (getTextContent) → geometry + font key per run
//   - font metadata (commonObjs) → real PostScript name + embedded flag
//   - a walk of the operator list → fill-color-per-size samples, placed images,
//     and whether any vector paths were drawn (which we cannot represent)
//
// Coordinates are converted from PDF's bottom-left origin to a top-left origin
// (points). The orchestrator scales points → px.

import { rgbToHex, grayToHex, cmykToHex } from './color.js';

const SUBSET_PREFIX = /^[A-Z]{6}\+/;

/**
 * @param {[number, number, number, number, number, number]} m
 * @param {number} x
 * @param {number} y
 * @returns {[number, number]}
 */
function applyMatrix(m, x, y) {
	return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Concatenate `cm` onto the current matrix (PDF row-vector convention). */
function multiply(cm, ctm) {
	return [
		cm[0] * ctm[0] + cm[1] * ctm[2],
		cm[0] * ctm[1] + cm[1] * ctm[3],
		cm[2] * ctm[0] + cm[3] * ctm[2],
		cm[2] * ctm[1] + cm[3] * ctm[3],
		cm[4] * ctm[0] + cm[5] * ctm[2] + ctm[4],
		cm[4] * ctm[1] + cm[5] * ctm[3] + ctm[5],
	];
}

function parseFontName(psName, fontObj) {
	const clean = psName.replace(SUBSET_PREFIX, '');
	const dash = clean.indexOf('-');
	let family = dash >= 0 ? clean.slice(0, dash) : clean;
	let style = dash >= 0 ? clean.slice(dash + 1) : '';
	if (!style) {
		if (fontObj?.bold && fontObj?.italic) style = 'Bold Italic';
		else if (fontObj?.bold) style = 'Bold';
		else if (fontObj?.italic) style = 'Italic';
		else style = 'Regular';
	}
	// "Times-Roman" reads better as family Times, style Regular for web mapping.
	if (style === 'Roman') style = 'Regular';
	return { family: family || clean, style };
}

function getImageObject(page, name) {
	return new Promise((resolve) => {
		try {
			if (page.objs.has(name)) {
				resolve(page.objs.get(name));
			} else {
				page.objs.get(name, resolve);
			}
		} catch {
			resolve(null);
		}
	});
}

/**
 * @param {import('pdfjs-dist/legacy/build/pdf.mjs').PDFPageProxy} page
 * @param {typeof import('pdfjs-dist/legacy/build/pdf.mjs')} pdfjs
 * @returns {Promise<{
 *   widthPt: number,
 *   heightPt: number,
 *   textItems: Array<{ text: string, x: number, baseline: number, width: number, fontSize: number, fontKey: string }>,
 *   fonts: Map<string, { name: string, family: string, style: string, embedded: boolean, type: string }>,
 *   colorSamples: Array<{ fontSizePt: number, hex: string, glyphs: number }>,
 *   images: Array<{ x: number, y: number, width: number, height: number, image: object | null, failed: boolean }>,
 *   hasVector: boolean,
 * }>}
 */
export async function extractPage(page, pdfjs) {
	const { OPS } = pdfjs;
	const [x0, y0, x1, y1] = page.view;
	const widthPt = x1 - x0;
	const heightPt = y1 - y0;

	// Operator list first: it populates objs/commonObjs and gives us colors,
	// images, and vector presence.
	const opList = await page.getOperatorList();

	let ctm = [1, 0, 0, 1, 0, 0];
	const ctmStack = [];
	let fillHex = '#000000';
	let currentSize = 0;
	let hasVector = false;
	const colorSamples = [];
	const images = [];

	const countGlyphs = (glyphs) =>
		Array.isArray(glyphs) ? glyphs.filter((g) => g && typeof g === 'object' && 'unicode' in g).length : 0;

	for (let i = 0; i < opList.fnArray.length; i += 1) {
		const fn = opList.fnArray[i];
		const args = opList.argsArray[i];
		switch (fn) {
			case OPS.save:
				ctmStack.push(ctm);
				break;
			case OPS.restore:
				ctm = ctmStack.pop() ?? ctm;
				break;
			case OPS.transform:
				ctm = multiply(args, ctm);
				break;
			case OPS.setFillRGBColor:
				fillHex = rgbToHex([args[0], args[1], args[2]]);
				break;
			case OPS.setFillGray:
				fillHex = grayToHex(args[0]);
				break;
			case OPS.setFillCMYKColor:
				fillHex = cmykToHex([args[0], args[1], args[2], args[3]]);
				break;
			case OPS.setFont:
				currentSize = Math.abs(args[1]);
				break;
			case OPS.showText:
			case OPS.showSpacedText: {
				const glyphs = countGlyphs(args[0]);
				if (glyphs > 0 && currentSize > 0) {
					colorSamples.push({ fontSizePt: currentSize, hex: fillHex, glyphs });
				}
				break;
			}
			case OPS.fill:
			case OPS.eoFill:
			case OPS.stroke:
			case OPS.fillStroke:
			case OPS.eoFillStroke:
			case OPS.closeFillStroke:
			case OPS.closeEOFillStroke:
			case OPS.closeStroke:
				hasVector = true;
				break;
			case OPS.paintImageXObject:
			case OPS.paintImageXObjectRepeat: {
				const name = args[0];
				// Unit square mapped through the CTM gives the placed rectangle.
				const c0 = applyMatrix(ctm, 0, 0);
				const c1 = applyMatrix(ctm, 1, 1);
				const left = Math.min(c0[0], c1[0]);
				const right = Math.max(c0[0], c1[0]);
				const bottom = Math.min(c0[1], c1[1]);
				const top = Math.max(c0[1], c1[1]);
				const obj = await getImageObject(page, name);
				images.push({
					x: left,
					y: heightPt - top, // flip to top-left origin
					width: right - left,
					height: top - bottom,
					image: obj && obj.data ? obj : null,
					failed: !(obj && obj.data),
				});
				break;
			}
			case OPS.paintInlineImageXObject: {
				const obj = args[0];
				const c0 = applyMatrix(ctm, 0, 0);
				const c1 = applyMatrix(ctm, 1, 1);
				const left = Math.min(c0[0], c1[0]);
				const right = Math.max(c0[0], c1[0]);
				const bottom = Math.min(c0[1], c1[1]);
				const top = Math.max(c0[1], c1[1]);
				images.push({
					x: left,
					y: heightPt - top,
					width: right - left,
					height: top - bottom,
					image: obj && obj.data ? obj : null,
					failed: !(obj && obj.data),
				});
				break;
			}
			case OPS.paintImageMaskXObject:
				// Stencil masks paint the current fill through a 1-bit mask; there's
				// no extractable raster, so we note it as vector-like content.
				hasVector = true;
				break;
			default:
				break;
		}
	}

	// Text geometry + font keys.
	const textContent = await page.getTextContent();
	const fonts = new Map();
	const textItems = [];
	for (const item of textContent.items) {
		if (!('str' in item) || item.str.trim().length === 0) continue;
		const t = item.transform; // [a,b,c,d,e,f]
		const fontSize = Math.hypot(t[2], t[3]) || item.height || 0;
		if (fontSize === 0) continue;
		textItems.push({
			text: item.str,
			x: t[4],
			baseline: heightPt - t[5],
			width: item.width,
			fontSize,
			fontKey: item.fontName,
		});
		if (item.fontName && !fonts.has(item.fontName)) {
			const obj = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
			const psName = obj?.name ?? item.fontName;
			const { family, style } = parseFontName(psName, obj);
			fonts.set(item.fontName, {
				name: psName,
				family,
				style,
				embedded: !!obj && obj.missingFile === false,
				type: obj?.type ?? 'unknown',
			});
		}
	}

	return { widthPt, heightPt, textItems, fonts, colorSamples, images, hasVector };
}
