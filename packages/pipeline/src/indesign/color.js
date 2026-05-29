// Shared color module: the single source of truth for color math across the
// IDML parser, the PDF parser, and the token mapper.
//
// Two families of conversion live here:
//   1. Device formatting/snapping used by the PDF operator path
//      (rgbToHex/grayToHex/cmykToHex take pdfjs-shaped inputs).
//   2. Documented source-space → sRGB conversion used by the mapper
//      (rgbToSrgbHex/cmykToSrgb/labToSrgb take IR component ranges and report
//      out-of-gamut). See colorFromComponents for the dispatcher.

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
 * DeviceCMYK (0..1) → hex. The naive conversion the PDF operator path uses;
 * kept range-compatible with pdfjs (0..1). For the mapper's IR-range CMYK
 * (0..100) use cmykToSrgb instead.
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
 * @param {Array<import('./ir.js').SwatchIR>} palette
 * @param {number} [maxDistance] Squared-distance cutoff (default ~24/channel).
 * @returns {import('./ir.js').SwatchIR | null}
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

// --- Source-space → sRGB conversion (mapper) -------------------------------

/**
 * Format an IR-range RGB triple (0..255) as an sRGB hex string. Alias of
 * rgbToHex for callers that think in terms of "source space".
 *
 * @param {[number, number, number]} rgb
 * @returns {string}
 */
export const rgbToSrgbHex = rgbToHex;

/**
 * Naive, profile-free CMYK → sRGB. Components in 0..100 (the IR's range), which
 * matches the parser's preview conversion so the same swatch lands on the same
 * hex in both the IR and the tokens. Without an ICC profile this conversion
 * never clips, so outOfGamut is always false (documented, not faked).
 *
 * @param {[number, number, number, number]} cmyk 0..100 per channel
 * @returns {{ hex: string, outOfGamut: boolean }}
 */
export function cmykToSrgb([c, m, y, k]) {
	const cv = c / 100, mv = m / 100, yv = y / 100, kv = k / 100;
	const r = 255 * (1 - cv) * (1 - kv);
	const g = 255 * (1 - mv) * (1 - kv);
	const b = 255 * (1 - yv) * (1 - kv);
	return { hex: rgbToHex([r, g, b]), outOfGamut: false };
}

// CIELAB → XYZ uses D50 (the ICC/InDesign connection-space white). The matrix
// below maps XYZ(D50) → linear sRGB with the Bradford adaptation to D65 folded
// in (Lindbloom), so it is paired with the matching D50 white point below.
const D50 = { Xn: 0.96422, Yn: 1.0, Zn: 0.82521 };
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;
const GAMUT_TOLERANCE = 1e-4;
const XYZ_D50_TO_LINEAR_SRGB = [
	[3.1338561, -1.6168667, -0.4906146],
	[-0.9787684, 1.9161415, 0.0334540],
	[0.0719453, -0.2289914, 1.4052427],
];

function srgbGamma(c) {
	return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * CIELAB (D50) → sRGB. L in 0..100, a/b in roughly -128..127. Reports whether
 * the color fell outside the sRGB gamut (a linear channel < 0 or > 1 before
 * clamping), so the mapper can warn that the hex is an approximation.
 *
 * @param {[number, number, number]} lab
 * @returns {{ hex: string, outOfGamut: boolean }}
 */
export function labToSrgb([L, a, b]) {
	const fy = (L + 16) / 116;
	const fx = fy + a / 500;
	const fz = fy - b / 200;
	const fx3 = fx ** 3;
	const fz3 = fz ** 3;
	const xr = fx3 > EPS ? fx3 : (116 * fx - 16) / KAPPA;
	const yr = L > KAPPA * EPS ? fy ** 3 : L / KAPPA;
	const zr = fz3 > EPS ? fz3 : (116 * fz - 16) / KAPPA;
	const X = xr * D50.Xn;
	const Y = yr * D50.Yn;
	const Z = zr * D50.Zn;
	const lin = XYZ_D50_TO_LINEAR_SRGB.map((row) => row[0] * X + row[1] * Y + row[2] * Z);
	const outOfGamut = lin.some((v) => v < -GAMUT_TOLERANCE || v > 1 + GAMUT_TOLERANCE);
	const rgb = /** @type {[number, number, number]} */ (
		lin.map((v) => srgbGamma(Math.max(0, Math.min(1, v))) * 255)
	);
	return { hex: rgbToHex(rgb), outOfGamut };
}

/**
 * Convert a swatch's raw components to sRGB, dispatching on color space. Falls
 * back to the supplied parse-time hex when components are absent or the space is
 * opaque (Spot/Unknown — no documented numeric conversion).
 *
 * @param {import('./ir.js').ColorIR['space']} space
 * @param {number[] | undefined} components
 * @param {string} fallbackHex
 * @returns {{ hex: string, outOfGamut: boolean }}
 */
export function colorFromComponents(space, components, fallbackHex) {
	if (components && components.length) {
		if (space === 'RGB' && components.length >= 3) {
			return { hex: rgbToSrgbHex(/** @type {any} */ (components)), outOfGamut: false };
		}
		if (space === 'CMYK' && components.length >= 4) {
			return cmykToSrgb(/** @type {any} */ (components));
		}
		if (space === 'LAB' && components.length >= 3) {
			return labToSrgb(/** @type {any} */ (components));
		}
	}
	return { hex: fallbackHex, outOfGamut: false };
}
