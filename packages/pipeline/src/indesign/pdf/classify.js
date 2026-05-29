// Heuristic style synthesis. A PDF carries no named paragraph styles, so we
// infer them from the only signal we have: font size. The most-used size is
// "body"; larger sizes become headings (largest = Heading 1); smaller sizes
// become captions. Each synthesized bucket also remembers the font and fill
// color most associated with that size, so the token mapper downstream can turn
// it into a theme.json preset.
//
// This is deliberately coarse. The IDML parser reports real styles; this is the
// fallback's best approximation and is flagged as such in the IR warnings.

import { ptToPx, roundPx } from '../units.js';

// Round sizes so 11.999pt and 12.001pt land in the same bucket.
const SIZE_QUANTUM = 0.5;
const MAX_HEADING_LEVEL = 6;

function roundSize(pt) {
	return Math.round(pt / SIZE_QUANTUM) * SIZE_QUANTUM;
}

/**
 * @param {Map<string, number>} tally
 * @returns {string | undefined} key with the highest count
 */
function argmax(tally) {
	let best;
	let bestN = -Infinity;
	for (const [key, n] of tally) {
		if (n > bestN) {
			bestN = n;
			best = key;
		}
	}
	return best;
}

/**
 * @typedef {Object} StyleBucket
 * @property {string} id
 * @property {string} name
 * @property {'heading'|'body'|'caption'} role
 * @property {number} sizePt
 * @property {number} fontSizePx
 * @property {string} [dominantFontKey]
 * @property {string} [dominantHex]
 *
 * @typedef {Object} ClassifyResult
 * @property {StyleBucket[]} buckets
 * @property {(sizePt: number) => string | undefined} styleIdForSize
 */

/**
 * @param {{
 *   items: Array<{ fontSize: number, fontKey?: string, text: string }>,
 *   colorSamples?: Array<{ fontSizePt: number, hex: string, glyphs: number }>,
 *   dpi: number,
 * }} input
 * @returns {ClassifyResult}
 */
export function classifyStyles({ items, colorSamples = [], dpi }) {
	// chars-per-size, plus per-size font and color tallies.
	const charsBySize = new Map();
	const fontBySize = new Map(); // size -> Map(fontKey -> chars)
	for (const item of items) {
		const size = roundSize(item.fontSize);
		const len = item.text.length;
		charsBySize.set(size, (charsBySize.get(size) ?? 0) + len);
		if (item.fontKey) {
			const fonts = fontBySize.get(size) ?? new Map();
			fonts.set(item.fontKey, (fonts.get(item.fontKey) ?? 0) + len);
			fontBySize.set(size, fonts);
		}
	}

	const colorBySize = new Map(); // size -> Map(hex -> glyphs)
	for (const sample of colorSamples) {
		const size = roundSize(sample.fontSizePt);
		const colors = colorBySize.get(size) ?? new Map();
		colors.set(sample.hex, (colors.get(sample.hex) ?? 0) + sample.glyphs);
		colorBySize.set(size, colors);
	}

	const sizes = [...charsBySize.keys()];
	if (sizes.length === 0) {
		return { buckets: [], styleIdForSize: () => undefined };
	}

	// Body = most-used size. Ties resolve to the smaller size (body text usually
	// outnumbers display text, and the smaller of two equal counts is the safer
	// "body" pick for sparse pages).
	let bodySize = sizes[0];
	for (const size of sizes) {
		const n = charsBySize.get(size);
		const bestN = charsBySize.get(bodySize);
		if (n > bestN || (n === bestN && size < bodySize)) {
			bodySize = size;
		}
	}

	const larger = sizes.filter((s) => s > bodySize).sort((a, b) => b - a);
	const smaller = sizes.filter((s) => s < bodySize).sort((a, b) => b - a);

	/** @type {Map<number, StyleBucket>} */
	const bySize = new Map();
	const makeBucket = (size, role, id, name) => {
		const fonts = fontBySize.get(size);
		const colors = colorBySize.get(size);
		const bucket = {
			id,
			name,
			role,
			sizePt: size,
			fontSizePx: roundPx(ptToPx(size, dpi)),
			dominantFontKey: fonts ? argmax(fonts) : undefined,
			dominantHex: colors ? argmax(colors) : undefined,
		};
		bySize.set(size, bucket);
		return bucket;
	};

	const buckets = [];
	larger.forEach((size, i) => {
		const level = Math.min(i + 1, MAX_HEADING_LEVEL);
		buckets.push(makeBucket(size, 'heading', `pdf-style-h${level}`, `Heading ${level}`));
	});
	buckets.push(makeBucket(bodySize, 'body', 'pdf-style-body', 'Body'));
	smaller.forEach((size, i) => {
		const suffix = i === 0 ? '' : `-${i + 1}`;
		const name = i === 0 ? 'Caption' : `Caption ${i + 1}`;
		buckets.push(makeBucket(size, 'caption', `pdf-style-caption${suffix}`, name));
	});

	// Headings first (largest → smallest), then body, then captions.
	buckets.sort((a, b) => b.sizePt - a.sizePt);

	return {
		buckets,
		styleIdForSize: (sizePt) => bySize.get(roundSize(sizePt))?.id,
	};
}
