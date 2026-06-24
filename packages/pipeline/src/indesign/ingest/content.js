// Content extraction: the InDesign IR captures *design* (swatches, fonts,
// styles) and *geometry* (spreads → frames), but nothing semantic about the
// editorial content. This transform walks the IR and derives a normalized,
// reading-order content model: each editorial spread becomes a section of
// classified blocks (headings, paragraphs, figures), plus a flat document
// outline and summary stats.
//
// Pure and deterministic: IR in, content object out — no fs, no clock, no
// randomness. The same IR always yields the same model.
//
// Heuristics (necessary because neither IDML nor PDF labels semantics):
//   • Heading vs body is inferred from font size. The smallest paragraph size
//     used across the spreads is the body baseline; every larger distinct size
//     is a heading, ranked largest → <h1>, capped at <h6>. A single size (or
//     none) ⇒ no headings, everything is a paragraph.
//   • Reading order = top-to-bottom, then left-to-right, by frame bounds, with
//     a small row tolerance so a two-column row isn't interleaved by sub-pixel y.
//   • Consecutive runs that share a paragraph style merge into one block, so a
//     sentence split into character runs (e.g. a bold word) stays one paragraph.
//   • Master-spread frames (running header/footer chrome) are excluded — the
//     generator derives those separately.

import { z } from 'zod';
import { Rect } from '../ir.js';

export const ContentBlock = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('heading'),
		level: z.number().int().min(1).max(6),
		text: z.string(),
		styleRef: z.string().optional(),
		frameRef: z.string().optional(),
	}),
	z.object({
		type: z.literal('paragraph'),
		text: z.string(),
		styleRef: z.string().optional(),
		frameRef: z.string().optional(),
	}),
	z.object({
		type: z.literal('figure'),
		href: z.string().optional(),
		embedded: z.boolean().default(false),
		bounds: Rect.optional(),
		frameRef: z.string().optional(),
	}),
]);

export const ContentSection = z.object({
	id: z.string(),
	source: z.string().optional(),
	// The section's first heading, when it has one — a convenient label.
	title: z.string().optional(),
	blocks: z.array(ContentBlock),
});

export const ContentModel = z.object({
	contentVersion: z.literal(1).default(1),
	sections: z.array(ContentSection),
	outline: z.array(
		z.object({ level: z.number().int().min(1).max(6), text: z.string() }),
	),
	stats: z.object({
		sections: z.number().int().nonnegative(),
		blocks: z.number().int().nonnegative(),
		headings: z.number().int().nonnegative(),
		paragraphs: z.number().int().nonnegative(),
		figures: z.number().int().nonnegative(),
		emptyTextFrames: z.number().int().nonnegative(),
		danglingStoryRefs: z.number().int().nonnegative(),
	}),
});

/**
 * @typedef {z.infer<typeof ContentModel>} ContentModelData
 * @typedef {z.infer<typeof ContentBlock>} ContentBlockData
 */

// Frames whose tops fall within this band read as the same row.
const ROW_TOLERANCE_PX = 8;

/**
 * @param {import('../ir.js').DocumentIR} ir
 * @returns {ContentModelData}
 */
export function extractContent(ir) {
	const storiesById = indexBy(ir.stories ?? [], 'id');
	const stylesById = indexBy(ir.styles ?? [], 'id');
	const spreads = ir.spreads ?? [];

	// Pass 1 — flatten each spread into reading-ordered items. Text classification
	// waits until pass 2, once the global size distribution is known.
	const raw = spreads.map((spread) => ({
		id: spread.id,
		source: spread.source,
		items: orderFrames(spread.frames ?? []).flatMap((frame) =>
			frame.kind === 'image'
				? [imageItem(frame)]
				: textItems(frame, storiesById, stylesById),
		),
	}));

	// Pass 2 — derive heading levels from the set of text sizes, then build blocks.
	const sizeToLevel = buildHeadingScale(raw);

	const stats = {
		sections: 0,
		blocks: 0,
		headings: 0,
		paragraphs: 0,
		figures: 0,
		emptyTextFrames: 0,
		danglingStoryRefs: 0,
	};
	const outline = [];
	const sections = [];

	for (const section of raw) {
		const blocks = [];
		for (const item of section.items) {
			if (item.note === 'empty') {
				stats.emptyTextFrames += 1;
				continue;
			}
			if (item.note === 'dangling') {
				stats.danglingStoryRefs += 1;
				continue;
			}
			if (item.kind === 'figure') {
				blocks.push({
					type: 'figure',
					href: item.href,
					embedded: item.embedded,
					bounds: item.bounds,
					frameRef: item.frameRef,
				});
				stats.figures += 1;
				continue;
			}
			const level = typeof item.size === 'number' ? sizeToLevel.get(item.size) : undefined;
			if (level) {
				blocks.push({ type: 'heading', level, text: item.text, styleRef: item.styleRef, frameRef: item.frameRef });
				stats.headings += 1;
				outline.push({ level, text: item.text });
			} else {
				blocks.push({ type: 'paragraph', text: item.text, styleRef: item.styleRef, frameRef: item.frameRef });
				stats.paragraphs += 1;
			}
		}
		stats.blocks += blocks.length;
		const title = blocks.find((b) => b.type === 'heading')?.text;
		sections.push({ id: section.id, source: section.source, title, blocks });
	}
	stats.sections = sections.length;

	return ContentModel.parse({ contentVersion: 1, sections, outline, stats });
}

function indexBy(items, key) {
	const map = new Map();
	for (const item of items) map.set(item[key], item);
	return map;
}

/**
 * Stable top-to-bottom, then left-to-right ordering. Frame tops within
 * ROW_TOLERANCE_PX share a row so multi-column rows aren't interleaved by tiny
 * y differences; ties fall back to source order for determinism.
 */
function orderFrames(frames) {
	return frames
		.map((frame, index) => ({ frame, index }))
		.sort((a, b) => {
			const rowA = Math.round((a.frame.bounds?.y ?? 0) / ROW_TOLERANCE_PX);
			const rowB = Math.round((b.frame.bounds?.y ?? 0) / ROW_TOLERANCE_PX);
			if (rowA !== rowB) return rowA - rowB;
			const xA = a.frame.bounds?.x ?? 0;
			const xB = b.frame.bounds?.x ?? 0;
			if (xA !== xB) return xA - xB;
			return a.index - b.index;
		})
		.map((entry) => entry.frame);
}

function imageItem(frame) {
	return {
		kind: 'figure',
		href: frame.href,
		embedded: frame.embedded ?? false,
		bounds: frame.bounds,
		frameRef: frame.id,
	};
}

/** One text frame → zero or more text items (runs merged by paragraph style). */
function textItems(frame, storiesById, stylesById) {
	if (!frame.storyRef) return [{ kind: 'text', note: 'empty', frameRef: frame.id }];
	const story = storiesById.get(frame.storyRef);
	if (!story) return [{ kind: 'text', note: 'dangling', frameRef: frame.id }];

	const groups = groupRuns(story.runs ?? []);
	if (groups.length === 0) return [{ kind: 'text', note: 'empty', frameRef: frame.id }];

	return groups.map((group) => {
		const style = group.styleRef ? stylesById.get(group.styleRef) : undefined;
		return {
			kind: 'text',
			text: group.text,
			styleRef: group.styleRef,
			size: style?.fontSize,
			frameRef: frame.id,
		};
	});
}

/**
 * Merge consecutive runs sharing a paragraph style into one block and drop
 * whitespace-only fragments (frame padding, stray paragraph breaks).
 */
function groupRuns(runs) {
	const groups = [];
	for (const run of runs) {
		const text = run.text ?? '';
		const styleRef = run.paragraphStyleRef;
		const last = groups[groups.length - 1];
		if (last && last.styleRef === styleRef) last.text += text;
		else groups.push({ styleRef, text });
	}
	return groups
		.map((group) => ({ styleRef: group.styleRef, text: group.text.trim() }))
		.filter((group) => group.text.length > 0);
}

/**
 * Map each distinct text size to a heading level: the smallest size is the body
 * baseline (no level); larger sizes rank largest → 1, capped at 6. Sizes that
 * aren't headings are absent from the map (callers treat that as a paragraph).
 */
function buildHeadingScale(raw) {
	const sizes = new Set();
	for (const section of raw) {
		for (const item of section.items) {
			if (item.kind === 'text' && !item.note && typeof item.size === 'number') {
				sizes.add(item.size);
			}
		}
	}
	const map = new Map();
	const ascending = [...sizes].sort((a, b) => a - b);
	if (ascending.length <= 1) return map; // one size (or none) ⇒ all body

	const baseline = ascending[0];
	const headingSizes = ascending.filter((size) => size > baseline).sort((a, b) => b - a);
	headingSizes.forEach((size, index) => map.set(size, Math.min(index + 1, 6)));
	return map;
}
