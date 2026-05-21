// Unit conversion. IDML stores most measurements as points; some appear with
// a unit suffix (e.g. "12.5pt", "3cm"). We normalize everything to CSS pixels
// at a caller-chosen DPI.
//
// Why DPI is configurable: 96 matches the CSS px (web default). 72 matches
// PostScript points (print default). 150/300 are common print exports.

const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;
const PICAS_PER_INCH = 6;

/**
 * Convert a value in IDML's native unit (points) to pixels.
 *
 * @param {number} pt
 * @param {number} dpi
 * @returns {number}
 */
export function ptToPx(pt, dpi) {
	return (pt / POINTS_PER_INCH) * dpi;
}

/**
 * Parse a length string that may carry a unit suffix and return pixels.
 *
 * Accepted: bare numbers (treated as points — IDML's native unit), "pt", "px",
 * "pc" (picas), "mm", "cm", "in". Returns NaN for unrecognized input so
 * callers can decide whether to warn or fall back.
 *
 * @param {string|number} value
 * @param {number} dpi
 * @returns {number}
 */
export function lengthToPx(value, dpi) {
	if (typeof value === 'number') {
		return ptToPx(value, dpi);
	}
	if (typeof value !== 'string') {
		return Number.NaN;
	}
	const match = value.trim().match(/^(-?\d*\.?\d+)\s*([a-z]*)$/i);
	if (!match) {
		return Number.NaN;
	}
	const n = Number.parseFloat(match[1]);
	const unit = match[2].toLowerCase();
	switch (unit) {
		case '':
		case 'pt':
			return ptToPx(n, dpi);
		case 'px':
			return n;
		case 'pc':
			return (n / PICAS_PER_INCH) * dpi;
		case 'mm':
			return (n / MM_PER_INCH) * dpi;
		case 'cm':
			return (n * 10 / MM_PER_INCH) * dpi;
		case 'in':
			return n * dpi;
		default:
			return Number.NaN;
	}
}

/**
 * Round to a sensible precision so downstream JSON stays tidy. 3 decimals is
 * sub-pixel enough for any rendering decision but avoids long binary tails.
 *
 * @param {number} n
 * @returns {number}
 */
export function roundPx(n) {
	if (!Number.isFinite(n)) {
		return n;
	}
	return Math.round(n * 1000) / 1000;
}
