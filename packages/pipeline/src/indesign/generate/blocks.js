// Render IR frames into WordPress block markup. Text frames become
// heading/paragraph blocks grouped together; image frames become core/image,
// or core/cover when text is overlaid on them. Design tokens (font-size, color
// slugs) are referenced by slug — never inline values — wherever the mapper
// produced one.

import { classifyStyleRole } from '../map/typography.js';
import { escapeHtml, inlineWithBreaks, themeFileUri } from './escape.js';

/** Prefix every non-empty line of a block with `pad` (a tab by default). */
export function indent(block, pad = '\t') {
	return String(block)
		.split('\n')
		.map((line) => (line ? pad + line : line))
		.join('\n');
}

function classList(...classes) {
	return classes.filter(Boolean).join(' ');
}

function attrComment(name, attrs) {
	const keys = Object.keys(attrs);
	const json = keys.length ? ` ${JSON.stringify(attrs)}` : '';
	return `<!-- wp:${name}${json} -->`;
}

function headingBlock({ level, fontSize, textColor }, html) {
	const attrs = {};
	if (level !== 2) attrs.level = level;
	if (textColor) attrs.textColor = textColor;
	if (fontSize) attrs.fontSize = fontSize;
	const cls = classList(
		'wp-block-heading',
		textColor && `has-${textColor}-color`,
		textColor && 'has-text-color',
		fontSize && `has-${fontSize}-font-size`,
	);
	return [
		attrComment('heading', attrs),
		`<h${level} class="${cls}">${html}</h${level}>`,
		'<!-- /wp:heading -->',
	].join('\n');
}

function paragraphBlock({ fontSize, textColor, className }, html) {
	const attrs = {};
	if (className) attrs.className = className;
	if (textColor) attrs.textColor = textColor;
	if (fontSize) attrs.fontSize = fontSize;
	const cls = classList(
		className,
		textColor && `has-${textColor}-color`,
		textColor && 'has-text-color',
		fontSize && `has-${fontSize}-font-size`,
	);
	const openTag = cls ? `<p class="${cls}">` : '<p>';
	return [attrComment('paragraph', attrs), `${openTag}${html}</p>`, '<!-- /wp:paragraph -->'].join('\n');
}

/** Resolve a paragraph style ref to its role, font-size slug, and color slug. */
function resolveStyle(ref, ctx) {
	const style = ref ? ctx.stylesById.get(ref) : undefined;
	const role = classifyStyleRole(style?.name);
	return {
		role: role.role,
		level: role.level,
		fontSize: style ? ctx.styleToSlug[style.id] : undefined,
		textColor: style?.fillColorRef ? ctx.swatchToSlug[style.fillColorRef] : undefined,
	};
}

/** Split a run's text into non-empty logical lines. */
function lines(text) {
	return String(text ?? '')
		.replace(/\n+$/, '')
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);
}

/**
 * Turn a story's runs into a flat list of block-markup strings. Headings and
 * captions collapse hard breaks into a single block; body/generic text emits
 * one paragraph per line.
 */
function renderRuns(runs, ctx) {
	const blocks = [];
	for (const run of runs ?? []) {
		const ls = lines(run.text);
		if (!ls.length) continue;
		const s = resolveStyle(run.paragraphStyleRef, ctx);
		if (s.role === 'heading') {
			blocks.push(headingBlock({ level: s.level, fontSize: s.fontSize, textColor: s.textColor }, inlineWithBreaks(run.text.replace(/\n+$/, ''))));
		} else if (s.role === 'caption') {
			blocks.push(paragraphBlock({ fontSize: s.fontSize, textColor: s.textColor, className: 'is-style-caption' }, inlineWithBreaks(run.text.replace(/\n+$/, ''))));
		} else {
			for (const line of ls) blocks.push(paragraphBlock({ fontSize: s.fontSize, textColor: s.textColor }, escapeHtml(line)));
		}
	}
	return blocks;
}

/**
 * Inner blocks for a text frame (no wrapping container). Returns [] when the
 * frame resolves to no renderable text; callers treat that as unmapped.
 */
export function renderTextFrameInner(frame, ctx) {
	const story = frame.storyRef ? ctx.storiesById.get(frame.storyRef) : undefined;
	if (!story) return [];
	return renderRuns(story.runs, ctx);
}

function imageBlock(assetPath, alt) {
	const src = assetPath ? themeFileUri(assetPath) : '';
	return [
		attrComment('image', { sizeSlug: 'large' }),
		`<figure class="wp-block-image size-large"><img src="${src}" alt="${escapeHtml(alt)}"/></figure>`,
		'<!-- /wp:image -->',
	].join('\n');
}

const COVER_DIM = 50;

function coverBlock(assetPath, minHeight, innerBlocks) {
	const attrs = { dimRatio: COVER_DIM, minHeight, minHeightUnit: 'px', isDark: false, layout: { type: 'constrained' } };
	const src = assetPath ? themeFileUri(assetPath) : '';
	const inner = innerBlocks.length ? indent(innerBlocks.join('\n\n')) : '';
	// Markup mirrors core/cover's save() output (dim class for the ratio, inline
	// min-height) so the Site Editor accepts it without a block-recovery prompt.
	return [
		attrComment('cover', attrs),
		`<div class="wp-block-cover" style="min-height:${minHeight}px">`,
		`<span aria-hidden="true" class="wp-block-cover__background has-background-dim-${COVER_DIM} has-background-dim"></span>`,
		`<img class="wp-block-cover__image-background" alt="" src="${src}" data-object-fit="cover"/>`,
		'<div class="wp-block-cover__inner-container">',
		...(inner ? [inner] : []),
		'</div>',
		'</div>',
		'<!-- /wp:cover -->',
	].join('\n');
}

/**
 * Render a single layout item (frame plus any overlaid text) to block markup.
 * Pushes to ctx.unmapped for frames that yield nothing renderable. Returns a
 * markup string, or null when the frame produced no block.
 *
 * @param {{ frame: object, coverChildren?: Array<object> }} item
 * @param {object} ctx
 * @returns {string|null}
 */
export function renderFrame(item, ctx) {
	const { frame, coverChildren = [] } = item;

	if (frame.kind === 'image') {
		const assetPath = ctx.assetPathById.get(frame.id);
		if (!assetPath) ctx.unmapped.push({ id: frame.id, kind: 'image', reason: 'image frame has no linked asset' });
		if (coverChildren.length) {
			const inner = coverChildren.flatMap((child) => renderTextFrameInner(child, ctx));
			const minHeight = Math.max(120, Math.round(frame.bounds.height));
			return coverBlock(assetPath, minHeight, inner);
		}
		return imageBlock(assetPath, '');
	}

	const inner = renderTextFrameInner(frame, ctx);
	if (!inner.length) {
		ctx.unmapped.push({ id: frame.id, kind: 'text', reason: frame.storyRef ? 'story has no renderable text' : 'text frame has no story' });
		return null;
	}
	return inner.join('\n\n');
}
