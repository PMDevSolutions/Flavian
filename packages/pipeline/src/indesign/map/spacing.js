// Derive a quantized theme.json spacing scale from IR geometry.
//
// Candidate spacings come from three observations: page margins (the smallest
// offset between a frame and each page edge), inter-frame gutters (gaps between
// adjacent frames), and paragraph space-before/after on styles. Values are
// quantized to a grid, deduped, and capped. Spacing is inherently approximate —
// especially for PDF-derived IRs — so an advisory warning is raised for those.

import { lengthToPx } from '../units.js';

const DEFAULT_GRID_PX = 4;
const DEFAULT_MAX_SIZES = 8;

/** @param {number} px @param {number} grid */
function quantize(px, grid) {
	return Math.round(px / grid) * grid;
}

/** @param {number} px → rem string */
function pxToRem(px) {
	return `${Math.round((px / 16) * 10000) / 10000}rem`;
}

/**
 * Smallest positive offset between any frame and each page edge = page margins.
 * @param {{ bounds: { x: number, y: number, width: number, height: number } }} page
 * @param {Array<{ bounds: { x: number, y: number, width: number, height: number } }>} frames
 * @returns {number[]}
 */
function pageMargins(page, frames) {
	const p = page.bounds;
	const edges = { left: Infinity, top: Infinity, right: Infinity, bottom: Infinity };
	for (const f of frames) {
		const b = f.bounds;
		edges.left = Math.min(edges.left, b.x - p.x);
		edges.top = Math.min(edges.top, b.y - p.y);
		edges.right = Math.min(edges.right, p.x + p.width - (b.x + b.width));
		edges.bottom = Math.min(edges.bottom, p.y + p.height - (b.y + b.height));
	}
	return Object.values(edges).filter((v) => Number.isFinite(v) && v > 0);
}

/**
 * Gaps between adjacent frames: vertical (stacked) and horizontal (side by side).
 * @param {Array<{ bounds: { x: number, y: number, width: number, height: number } }>} frames
 * @returns {number[]}
 */
function frameGutters(frames) {
	const gaps = [];
	const byY = [...frames].sort((a, b) => a.bounds.y - b.bounds.y);
	for (let i = 1; i < byY.length; i += 1) {
		const prev = byY[i - 1].bounds;
		const cur = byY[i].bounds;
		gaps.push(cur.y - (prev.y + prev.height));
	}
	const byX = [...frames].sort((a, b) => a.bounds.x - b.bounds.x);
	for (let i = 1; i < byX.length; i += 1) {
		const prev = byX[i - 1].bounds;
		const cur = byX[i].bounds;
		// Only count as a gutter when the two frames overlap vertically.
		const overlap = Math.min(prev.y + prev.height, cur.y + cur.height) - Math.max(prev.y, cur.y);
		if (overlap > 0) gaps.push(cur.x - (prev.x + prev.width));
	}
	return gaps.filter((g) => g > 0);
}

/**
 * Paragraph space-before/after pulled from style properties (raw IDML attribute
 * values, in points), tolerant of `@`-prefixed and bare keys.
 * @param {Array<import('../ir.js').StyleIR>} styles
 * @param {number} dpi
 * @returns {number[]}
 */
function paragraphSpacing(styles, dpi) {
	const out = [];
	const keys = ['SpaceBefore', 'SpaceAfter', '@SpaceBefore', '@SpaceAfter', 'spaceBefore', 'spaceAfter'];
	for (const style of styles) {
		const props = style.properties ?? {};
		for (const key of keys) {
			if (props[key] === undefined || props[key] === null) continue;
			const px = lengthToPx(props[key], dpi);
			if (Number.isFinite(px) && px > 0) out.push(px);
		}
	}
	return out;
}

/**
 * @typedef {Object} MapSpacingOptions
 * @property {number} [gridPx]    Quantization grid (default 4).
 * @property {number} [maxSizes]  Cap on emitted sizes (default 8).
 * @property {string} [namespace] Slug prefix (default 'id').
 * @property {{ add: (code: string, message: string, context?: object) => void }} [warnings]
 *
 * @param {import('../ir.js').DocumentIR} ir
 * @param {MapSpacingOptions} [options]
 * @returns {{ spacingSizes: Array<{ slug: string, size: string, name: string }> }}
 */
export function mapSpacing(ir, options = {}) {
	const {
		gridPx = DEFAULT_GRID_PX,
		maxSizes = DEFAULT_MAX_SIZES,
		namespace = 'id',
		warnings,
	} = options;
	const warn = warnings && typeof warnings.add === 'function'
		? (code, message, context) => warnings.add(code, message, context)
		: () => {};

	const dpi = ir.dpi ?? 96;
	/** @type {number[]} */
	const candidates = [];
	let usedGeometry = false;

	for (const spread of ir.spreads ?? []) {
		const frames = spread.frames ?? [];
		if (frames.length) usedGeometry = true;
		for (const page of spread.pages ?? []) {
			candidates.push(...pageMargins(page, frames));
		}
		candidates.push(...frameGutters(frames));
	}
	candidates.push(...paragraphSpacing(ir.styles ?? [], dpi));

	// Quantize, drop non-positive, dedupe, sort ascending, cap to the smallest N.
	const quantized = [...new Set(candidates.map((px) => quantize(px, gridPx)).filter((px) => px > 0))]
		.sort((a, b) => a - b)
		.slice(0, maxSizes);

	if (usedGeometry && (ir.warnings ?? []).some((w) => w.code === 'pdf-fallback')) {
		warn('spacing-approximate', 'Spacing scale was derived from approximate PDF geometry; verify against the source.', {});
	}

	const spacingSizes = quantized.map((px, i) => ({
		slug: `${namespace}-space-${(i + 1) * 10}`,
		size: pxToRem(px),
		name: `Space ${(i + 1) * 10}`,
	}));

	return { spacingSizes };
}
