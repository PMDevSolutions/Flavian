// Map IR swatches to a theme.json color palette.
//
// For each swatch we re-derive sRGB from its raw components (documented math,
// better than the parser's preview hex for LAB), then either reuse a close base
// palette slug or add a deduped, namespaced derived token. Out-of-gamut and
// opaque-space (Spot/Unknown) swatches raise warnings the report surfaces.

import { colorFromComponents, colorDistance } from '../color.js';
import { namespacedSlug } from './slug.js';

const DEFAULT_TOLERANCE = 24 * 24 * 3; // squared RGB distance, ~24/channel

/**
 * @param {string} hex
 * @param {Array<{ slug: string, hex: string }>} candidates
 * @param {number} tolerance
 * @returns {{ slug: string, hex: string } | null}
 */
function nearestByHex(hex, candidates, tolerance) {
	let best = null;
	let bestDist = Infinity;
	for (const c of candidates) {
		const d = colorDistance(hex, c.hex);
		if (d < bestDist) {
			bestDist = d;
			best = c;
		}
	}
	return best && bestDist <= tolerance ? best : null;
}

/**
 * @typedef {Object} MapColorsOptions
 * @property {Array<{ slug: string, color: string, name?: string }>} [basePalette]
 * @property {number} [tolerance]   Squared RGB distance for dedupe + base reuse.
 * @property {string} [namespace]   Prefix for derived slugs (default 'id').
 * @property {{ add: (code: string, message: string, context?: object) => void }} [warnings]
 *
 * @param {Array<import('../ir.js').SwatchIR>} swatches
 * @param {MapColorsOptions} [options]
 * @returns {{ palette: Array<{ slug: string, color: string, name: string }>, swatchToSlug: Record<string, string> }}
 */
export function mapColors(swatches, options = {}) {
	const {
		basePalette = [],
		tolerance = DEFAULT_TOLERANCE,
		namespace = 'id',
		warnings,
	} = options;
	const warn = warnings && typeof warnings.add === 'function'
		? (code, message, context) => warnings.add(code, message, context)
		: () => {};

	/** @type {Array<{ slug: string, color: string, name: string }>} */
	const palette = [];
	/** @type {Record<string, string>} */
	const swatchToSlug = {};
	const used = new Set(basePalette.map((p) => p.slug));
	const baseCandidates = basePalette.map((p) => ({ slug: p.slug, hex: p.color }));

	for (const sw of swatches) {
		const { hex, outOfGamut } = colorFromComponents(sw.color.space, sw.color.components, sw.color.hex);
		if (outOfGamut) {
			warn('color-out-of-gamut', `Swatch ${sw.id} (${sw.name}) is outside the sRGB gamut; using the clamped color`, { id: sw.id });
		}
		if (sw.color.space === 'Spot' || sw.color.space === 'Unknown') {
			warn('swatch-approximated', `Swatch ${sw.id} (${sw.name}) uses ${sw.color.space} color; the hex is an approximation`, { id: sw.id });
		}

		// 1. Reuse a base slug when the color is close to a curated base color.
		const baseMatch = nearestByHex(hex, baseCandidates, tolerance);
		if (baseMatch) {
			swatchToSlug[sw.id] = baseMatch.slug;
			continue;
		}

		// 2. Dedupe against already-derived entries.
		const dup = nearestByHex(hex, palette.map((p) => ({ slug: p.slug, hex: p.color })), tolerance);
		if (dup) {
			swatchToSlug[sw.id] = dup.slug;
			continue;
		}

		// 3. New, namespaced derived token.
		const slug = namespacedSlug(sw.name, namespace, used, 'color');
		used.add(slug);
		palette.push({ slug, color: hex, name: sw.name });
		swatchToSlug[sw.id] = slug;
	}

	return { palette, swatchToSlug };
}
