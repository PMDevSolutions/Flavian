// Turn a spread's flat list of frames into an ordered layout: a top-to-bottom
// sequence of rows, where a row holding more than one frame becomes a
// core/columns block. Pure geometry, fully deterministic for a given IR.
//
// Two refinements on top of plain reading order:
//   1. Column grouping — frames whose vertical spans overlap enough sit in the
//      same row and render side by side, left to right.
//   2. Cover nesting — an image frame that largely contains text frames is a
//      background; those text frames are pulled out of normal flow and nested
//      inside the image's cover block instead of stacking after it.

/** Vertical overlap of two rects as a fraction of the shorter one's height. */
function verticalOverlapRatio(a, b) {
	const top = Math.max(a.y, b.y);
	const bottom = Math.min(a.y + a.height, b.y + b.height);
	const overlap = bottom - top;
	if (overlap <= 0) return 0;
	const shorter = Math.min(a.height, b.height) || 1;
	return overlap / shorter;
}

/** Area of intersection of two rects. */
function intersectionArea(a, b) {
	const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
	const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
	return w * h;
}

const COVER_CONTAINMENT = 0.6; // a text frame ≥60% inside an image → overlaid
const ROW_OVERLAP = 0.5;       // vertical overlap ≥50% → same row

/**
 * Assign each text frame that sits mostly inside an image frame to that image
 * (the largest containing image wins). Returns the set of consumed text-frame
 * ids and a map of image-frame id → overlaid text frames (in reading order).
 */
function detectCovers(frames) {
	const images = frames.filter((f) => f.kind === 'image');
	const texts = frames.filter((f) => f.kind === 'text');
	/** @type {Map<string, Array<object>>} */
	const coverChildren = new Map();
	const consumed = new Set();

	for (const text of texts) {
		const textArea = text.bounds.width * text.bounds.height || 1;
		let best = null;
		let bestArea = 0;
		for (const image of images) {
			const contained = intersectionArea(text.bounds, image.bounds) / textArea;
			if (contained < COVER_CONTAINMENT) continue;
			const imageArea = image.bounds.width * image.bounds.height;
			if (imageArea > bestArea) {
				best = image;
				bestArea = imageArea;
			}
		}
		if (best) {
			consumed.add(text.id);
			const list = coverChildren.get(best.id) ?? [];
			list.push(text);
			coverChildren.set(best.id, list);
		}
	}

	for (const list of coverChildren.values()) list.sort(readingOrder);
	return { coverChildren, consumed };
}

/** Reading order: top-to-bottom, then left-to-right, then id for stability. */
function readingOrder(a, b) {
	if (Math.abs(a.bounds.y - b.bounds.y) > 1) return a.bounds.y - b.bounds.y;
	if (Math.abs(a.bounds.x - b.bounds.x) > 1) return a.bounds.x - b.bounds.x;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Group already-ordered frames into rows. A frame joins the current row when it
 * overlaps every member of that row vertically; otherwise it starts a new row.
 */
function groupRows(frames) {
	/** @type {Array<Array<object>>} */
	const rows = [];
	for (const frame of frames) {
		const row = rows[rows.length - 1];
		const fits = row && row.every((m) => verticalOverlapRatio(frame.bounds, m.bounds) >= ROW_OVERLAP);
		if (fits) row.push(frame);
		else rows.push([frame]);
	}
	// Order each row left-to-right so columns read naturally.
	for (const row of rows) row.sort((a, b) => a.bounds.x - b.bounds.x || (a.id < b.id ? -1 : 1));
	return rows;
}

/**
 * @typedef {Object} LayoutFrame
 * @property {object} frame                The IR frame.
 * @property {Array<object>} [coverChildren] Text frames overlaid on an image.
 *
 * @typedef {Object} LayoutRow
 * @property {Array<LayoutFrame>} items    One entry → block; many → columns.
 *
 * Build the ordered row layout for one spread.
 * @param {Array<object>} frames Frames belonging to the spread.
 * @returns {Array<LayoutRow>}
 */
export function layoutSpread(frames) {
	const { coverChildren, consumed } = detectCovers(frames);
	const flow = frames.filter((f) => !consumed.has(f.id)).sort(readingOrder);
	const rows = groupRows(flow);
	return rows.map((row) => ({
		items: row.map((frame) => ({
			frame,
			coverChildren: coverChildren.get(frame.id) ?? [],
		})),
	}));
}
