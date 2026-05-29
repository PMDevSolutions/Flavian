// Positional clustering: turn a flat bag of positioned text runs into logical
// text frames, the way a reader would group them.
//
// PDF has no concept of a "text frame" — InDesign flattens everything to
// absolutely-positioned glyph runs. We reconstruct frames in two passes:
//   1. Runs sharing a baseline (within tolerance) become a line.
//   2. Lines that are vertically adjacent AND horizontally overlapping become a
//      block (frame). Processing lines top-to-bottom while keeping several
//      blocks "open" lets side-by-side columns fall out naturally — a line only
//      joins a block in its own column.
//
// All geometry here is in points with a top-left origin (y grows downward),
// which is what the orchestrator converts to px when emitting the IR.

// Fractions of font size used to approximate a glyph run's vertical box from
// its baseline. Real ascent/descent vary per font; these are good enough to
// cluster and to draw a frame rectangle a human would accept.
const ASCENT_RATIO = 0.8;
const DESCENT_RATIO = 0.2;

// Two runs are on the same line if their baselines are within this fraction of
// the smaller font size.
const LINE_BASELINE_TOL = 0.5;

// A line joins a block only if the vertical gap to the block's last line is no
// more than this multiple of the line height — enough for paragraph spacing,
// not enough to swallow a separate block further down the page.
const BLOCK_GAP_FACTOR = 1.8;

// Runs on the same baseline but separated by more than this multiple of the
// font size are treated as different columns, not one wide line. Print columns
// commonly share baselines, so baseline proximity alone can't tell them apart —
// the horizontal gutter does.
const GUTTER_FACTOR = 2.5;

/**
 * @typedef {Object} TextItem
 * @property {string} text
 * @property {number} x          Left edge (pt).
 * @property {number} baseline   Baseline y, top-left origin (pt).
 * @property {number} width      Run advance width (pt).
 * @property {number} fontSize   Font size (pt).
 * @property {string} fontKey    Stable key into the page's font table.
 *
 * @typedef {Object} Line
 * @property {number} baseline
 * @property {number} top
 * @property {number} bottom
 * @property {number} left
 * @property {number} right
 * @property {number} lineHeight
 * @property {TextItem[]} items
 *
 * @typedef {Object} TextBlock
 * @property {Line[]} lines
 * @property {TextItem[]} items
 * @property {{minX: number, minY: number, maxX: number, maxY: number}} bounds
 */

function itemTop(item) {
	return item.baseline - item.fontSize * ASCENT_RATIO;
}

function itemBottom(item) {
	return item.baseline + item.fontSize * DESCENT_RATIO;
}

function rangesOverlap(aMin, aMax, bMin, bMax) {
	return aMin < bMax && bMin < aMax;
}

/**
 * Group runs sharing a baseline into lines.
 *
 * @param {TextItem[]} items
 * @returns {Line[]}
 */
export function groupLines(items) {
	const sorted = [...items].sort((a, b) => a.baseline - b.baseline || a.x - b.x);
	/** @type {Line[]} */
	const lines = [];
	for (const item of sorted) {
		const last = lines[lines.length - 1];
		const tol = Math.min(item.fontSize, last ? last.lineHeight : item.fontSize) * LINE_BASELINE_TOL;
		const sameBaseline = last && Math.abs(item.baseline - last.baseline) <= tol;
		// A wide horizontal gap on the same baseline is a column gutter, not a
		// space — start a new line so the two columns cluster apart.
		const gutter = Math.max(last ? last.lineHeight : item.fontSize, item.fontSize) * GUTTER_FACTOR;
		const acrossGutter = last && item.x - last.right > gutter;
		if (sameBaseline && !acrossGutter) {
			last.items.push(item);
			last.left = Math.min(last.left, item.x);
			last.right = Math.max(last.right, item.x + item.width);
			last.top = Math.min(last.top, itemTop(item));
			last.bottom = Math.max(last.bottom, itemBottom(item));
			last.lineHeight = Math.max(last.lineHeight, item.fontSize);
		} else {
			lines.push({
				baseline: item.baseline,
				top: itemTop(item),
				bottom: itemBottom(item),
				left: item.x,
				right: item.x + item.width,
				lineHeight: item.fontSize,
				items: [item],
			});
		}
	}
	// Reading order within each line.
	for (const line of lines) {
		line.items.sort((a, b) => a.x - b.x);
	}
	return lines;
}

/**
 * Group lines into blocks (frames). Multiple blocks stay open at once so that
 * two columns processed in interleaved vertical order don't merge.
 *
 * @param {Line[]} lines
 * @returns {TextBlock[]}
 */
export function groupBlocks(lines) {
	/** @type {Array<{lines: Line[], left: number, right: number, lastBottom: number}>} */
	const open = [];
	for (const line of [...lines].sort((a, b) => a.top - b.top)) {
		let target = null;
		for (const block of open) {
			const gap = line.top - block.lastBottom;
			const tol = BLOCK_GAP_FACTOR * line.lineHeight;
			if (gap <= tol && rangesOverlap(block.left, block.right, line.left, line.right)) {
				target = block;
				break;
			}
		}
		if (!target) {
			target = { lines: [], left: line.left, right: line.right, lastBottom: -Infinity };
			open.push(target);
		}
		target.lines.push(line);
		target.left = Math.min(target.left, line.left);
		target.right = Math.max(target.right, line.right);
		target.lastBottom = Math.max(target.lastBottom, line.bottom);
	}

	return open.map((block) => {
		const items = block.lines.flatMap((l) => l.items);
		const minY = Math.min(...block.lines.map((l) => l.top));
		const maxY = Math.max(...block.lines.map((l) => l.bottom));
		return {
			lines: block.lines,
			items,
			bounds: { minX: block.left, minY, maxX: block.right, maxY },
		};
	});
}

/**
 * Full pipeline: positioned runs → text frames, in top-to-bottom reading order.
 *
 * @param {TextItem[]} items
 * @returns {TextBlock[]}
 */
export function clusterIntoFrames(items) {
	const withText = items.filter((it) => it.text && it.text.trim().length > 0);
	if (withText.length === 0) return [];
	const blocks = groupBlocks(groupLines(withText));
	return blocks.sort((a, b) => a.bounds.minY - b.bounds.minY || a.bounds.minX - b.bounds.minX);
}

/**
 * Count distinct columns: clusters of frames whose horizontal x-ranges don't
 * overlap. Used for the multi-column fidelity check and round-trip reporting.
 *
 * @param {TextBlock[]} blocks
 * @returns {number}
 */
export function detectColumns(blocks) {
	if (blocks.length === 0) return 0;
	const intervals = blocks
		.map((b) => ({ min: b.bounds.minX, max: b.bounds.maxX }))
		.sort((a, b) => a.min - b.min);
	let columns = 1;
	let currentMax = intervals[0].max;
	for (let i = 1; i < intervals.length; i += 1) {
		if (intervals[i].min >= currentMax) {
			columns += 1;
			currentMax = intervals[i].max;
		} else {
			currentMax = Math.max(currentMax, intervals[i].max);
		}
	}
	return columns;
}
