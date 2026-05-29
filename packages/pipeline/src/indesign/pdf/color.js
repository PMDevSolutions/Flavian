// Color normalization for PDF fill operators, plus nearest-match against an
// IDML-derived swatch palette.
//
// PDF content streams set fill color via three operator families:
//   rg  -> DeviceRGB   (pdfjs hands us 0..255 ints)
//   g   -> DeviceGray  (pdfjs hands us a single 0..255 int)
//   k   -> DeviceCMYK  (pdfjs hands us 0..1 floats)
// We collapse all of them to "#rrggbb". When a palette from a sibling IDML
// parse is available, we snap each detected color to the closest swatch so the
// PDF and IDML pipelines produce aligned token names downstream.

/**
 * @param {number} n
 * @returns {string} two-digit lowercase hex
 */
function hexByte(n) {
	return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * @param {[number, number, number]} rgb 0..255 per channel
 * @returns {string}
 */
export function rgbToHex([r, g, b]) {
	return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

/**
 * @param {number} gray 0..255
 * @returns {string}
 */
export function grayToHex(gray) {
	return rgbToHex([gray, gray, gray]);
}

/**
 * DeviceCMYK (0..1) → hex via the same naive conversion the IDML graphic
 * parser uses, so identical CMYK swatches land on identical hex in both pipelines.
 *
 * @param {[number, number, number, number]} cmyk 0..1 per channel
 * @returns {string}
 */
export function cmykToHex([c, m, y, k]) {
	const r = 255 * (1 - c) * (1 - k);
	const g = 255 * (1 - m) * (1 - k);
	const b = 255 * (1 - y) * (1 - k);
	return rgbToHex([r, g, b]);
}

/**
 * @param {string} hex "#rrggbb"
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
	const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!m) return [0, 0, 0];
	return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/**
 * Squared Euclidean distance in RGB. Squared is enough for "which is closest"
 * and avoids a sqrt per comparison.
 *
 * @param {string} a "#rrggbb"
 * @param {string} b "#rrggbb"
 * @returns {number}
 */
export function colorDistance(a, b) {
	const [r1, g1, b1] = hexToRgb(a);
	const [r2, g2, b2] = hexToRgb(b);
	return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

/**
 * Find the closest swatch in a palette, within a tolerance.
 *
 * @param {string} hex "#rrggbb"
 * @param {Array<import('../ir.js').SwatchIR>} palette
 * @param {number} [maxDistance] Squared-distance cutoff (default ~24/channel).
 * @returns {import('../ir.js').SwatchIR | null}
 */
export function nearestSwatch(hex, palette, maxDistance = 24 * 24 * 3) {
	let best = null;
	let bestDist = Infinity;
	for (const swatch of palette) {
		const dist = colorDistance(hex, swatch.color.hex);
		if (dist < bestDist) {
			bestDist = dist;
			best = swatch;
		}
	}
	return best && bestDist <= maxDistance ? best : null;
}
