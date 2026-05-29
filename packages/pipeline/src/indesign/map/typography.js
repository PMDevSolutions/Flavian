// Map IR paragraph styles to a theme.json typography scale and element presets.
//
// Distinct paragraph-style font sizes are clustered (near-equal sizes merge);
// each cluster becomes one scale entry, reusing a close base font-size slug when
// possible, else a namespaced derived slug named after the InDesign style. Every
// emitted entry is referenced by at least one paragraph style by construction.
// Recognized style names (Heading N / Body / Caption) also produce element
// presets carrying line height, letter spacing, and text color.

import { namespacedSlug } from './slug.js';

const DEFAULT_TOLERANCE_PX = 1;
const DEFAULT_FLUID_THRESHOLD_PX = 32;

const HEADING_RE = /^h(?:eading)?\s*([1-6])$/i;
const BODY_RE = /^(body|paragraph|normal|default|text|copy)\b/i;
const CAPTION_RE = /^(caption|footnote|cutline|credit)\b/i;

/** @param {number} n @param {number} dp */
function round(n, dp) {
	const f = 10 ** dp;
	return Math.round(n * f) / f;
}

/** @param {number} px → rem string (16px base) */
function pxToRem(px) {
	return `${round(px / 16, 4)}rem`;
}

/** Parse "1rem" / "18px" / unitless into px. */
function remOrPxToPx(token) {
	const m = /^([\d.]+)\s*(rem|px)?$/i.exec(String(token).trim());
	if (!m) return Number.NaN;
	const n = Number.parseFloat(m[1]);
	return m[2] && m[2].toLowerCase() === 'px' ? n : n * 16;
}

/** Resolve a base font-size token to a nominal px (clamp() uses its max). */
function resolveBasePx(size) {
	if (typeof size === 'number') return size;
	const s = String(size).trim();
	const clamp = /clamp\(([^,]+),([^,]+),([^)]+)\)/i.exec(s);
	if (clamp) return remOrPxToPx(clamp[3]);
	return remOrPxToPx(s);
}

/** Mirror the base theme's fluid pattern for larger sizes. */
function fluidClamp(px) {
	const maxRem = round(px / 16, 4);
	const minRem = round(maxRem * 0.85, 4);
	return `clamp(${minRem}rem, ${minRem}rem + 2vw, ${maxRem}rem)`;
}

/**
 * Greedily cluster styles by font size (ascending), merging sizes within the
 * tolerance of the running cluster mean.
 *
 * @param {Array<import('../ir.js').StyleIR>} paragraphs
 * @param {number} tolerancePx
 * @returns {Array<{ styles: Array<import('../ir.js').StyleIR>, representativePx: number }>}
 */
function clusterBySize(paragraphs, tolerancePx) {
	const sorted = [...paragraphs].sort((a, b) => a.fontSize - b.fontSize);
	const clusters = [];
	for (const style of sorted) {
		const last = clusters[clusters.length - 1];
		if (last) {
			const mean = last.sizes.reduce((s, v) => s + v, 0) / last.sizes.length;
			if (Math.abs(style.fontSize - mean) <= tolerancePx) {
				last.styles.push(style);
				last.sizes.push(style.fontSize);
				continue;
			}
		}
		clusters.push({ styles: [style], sizes: [style.fontSize] });
	}
	return clusters.map((c) => ({
		styles: c.styles,
		representativePx: Math.round(c.sizes.reduce((s, v) => s + v, 0) / c.sizes.length),
	}));
}

/**
 * @typedef {Object} MapTypographyOptions
 * @property {Array<{ slug: string, size: string | number }>} [baseFontSizes]
 * @property {Record<string, string>} [swatchToSlug]
 * @property {number} [tolerancePx]
 * @property {boolean} [fluid]
 * @property {number} [fluidThresholdPx]
 * @property {string} [namespace]
 *
 * @param {Array<import('../ir.js').StyleIR>} styles
 * @param {MapTypographyOptions} [options]
 * @returns {{ fontSizes: Array<{ slug: string, size: string, name: string }>, elements: Record<string, object>, styleToSlug: Record<string, string> }}
 */
export function mapTypography(styles, options = {}) {
	const {
		baseFontSizes = [],
		swatchToSlug = {},
		tolerancePx = DEFAULT_TOLERANCE_PX,
		fluid = false,
		fluidThresholdPx = DEFAULT_FLUID_THRESHOLD_PX,
		namespace = 'id',
	} = options;

	const paragraphs = styles.filter(
		(s) => s.kind === 'paragraph' && typeof s.fontSize === 'number' && s.fontSize > 0,
	);
	const clusters = clusterBySize(paragraphs, tolerancePx);

	const used = new Set(baseFontSizes.map((b) => b.slug));
	const baseResolved = baseFontSizes.map((b) => ({ slug: b.slug, px: resolveBasePx(b.size) }));

	/** @type {Array<{ slug: string, size: string, name: string }>} */
	const fontSizes = [];
	/** @type {Record<string, string>} */
	const styleToSlug = {};

	for (const cluster of clusters) {
		// Reuse the closest base slug within tolerance.
		let slug = null;
		let bestDist = Infinity;
		for (const b of baseResolved) {
			const d = Math.abs(b.px - cluster.representativePx);
			if (d <= tolerancePx && d < bestDist) {
				bestDist = d;
				slug = b.slug;
			}
		}

		if (!slug) {
			// Derived token, named after the cluster style closest to the mean.
			const rep = cluster.styles.reduce(
				(best, s) => (Math.abs(s.fontSize - cluster.representativePx) < Math.abs(best.fontSize - cluster.representativePx) ? s : best),
				cluster.styles[0],
			);
			slug = namespacedSlug(rep.name, namespace, used, 'font-size');
			used.add(slug);
			const size = fluid && cluster.representativePx >= fluidThresholdPx
				? fluidClamp(cluster.representativePx)
				: pxToRem(cluster.representativePx);
			fontSizes.push({ slug, size, name: rep.name });
		}

		for (const s of cluster.styles) styleToSlug[s.id] = slug;
	}

	const elements = buildElements(paragraphs, clusters, styleToSlug, swatchToSlug);
	return { fontSizes, elements, styleToSlug };
}

/**
 * Build styles.elements presets for recognized style names, with a fallback
 * that maps the most-used size to the body paragraph element.
 */
function buildElements(paragraphs, clusters, styleToSlug, swatchToSlug) {
	/** @type {Record<string, object>} */
	const elements = {};

	const makeEntry = (style) => {
		const slug = styleToSlug[style.id];
		/** @type {Record<string, string>} */
		const typography = { fontSize: `var(--wp--preset--font-size--${slug})` };
		if (style.leading && style.fontSize) {
			typography.lineHeight = String(round(style.leading / style.fontSize, 2));
		}
		if (style.tracking) {
			typography.letterSpacing = `${round(style.tracking / 1000, 3)}em`;
		}
		/** @type {{ typography: object, color?: object }} */
		const entry = { typography };
		const colorSlug = style.fillColorRef ? swatchToSlug[style.fillColorRef] : undefined;
		if (colorSlug) entry.color = { text: `var(--wp--preset--color--${colorSlug})` };
		return entry;
	};

	let pAssigned = false;
	for (const style of paragraphs) {
		const name = String(style.name ?? '').trim();
		const h = HEADING_RE.exec(name);
		if (h && !elements[`h${h[1]}`]) {
			elements[`h${h[1]}`] = makeEntry(style);
			continue;
		}
		if (BODY_RE.test(name) && !elements.p) {
			elements.p = makeEntry(style);
			pAssigned = true;
			continue;
		}
		if (CAPTION_RE.test(name) && !elements.caption) {
			elements.caption = makeEntry(style);
		}
	}

	// Fallback: bind the most-used size to <p> if no body style was recognized.
	if (!pAssigned && clusters.length) {
		const bodyCluster = clusters.reduce((a, b) => (b.styles.length > a.styles.length ? b : a), clusters[0]);
		if (bodyCluster && !elements.p) elements.p = makeEntry(bodyCluster.styles[0]);
	}

	return elements;
}
