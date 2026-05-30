// Assemble one FSE block pattern (a PHP file) per spread. Rows become
// core/columns when they hold more than one frame; a lone text frame is wrapped
// in a core/group; the whole spread is a full-width constrained section so it
// drops cleanly into a template or page.

import { layoutSpread } from './layout.js';
import { renderFrame, indent } from './blocks.js';

const PATTERN_CATEGORY = 'indesign-imports';

function groupBlock(inner, { align } = {}) {
	const attrs = {};
	if (align) attrs.align = align;
	attrs.layout = { type: 'constrained' };
	const cls = align ? `wp-block-group align${align}` : 'wp-block-group';
	return [
		`<!-- wp:group ${JSON.stringify(attrs)} -->`,
		`<div class="${cls}">`,
		indent(inner),
		'</div>',
		'<!-- /wp:group -->',
	].join('\n');
}

function columnBlock(inner) {
	return ['<!-- wp:column -->', '<div class="wp-block-column">', indent(inner), '</div>', '<!-- /wp:column -->'].join('\n');
}

function columnsBlock(columns) {
	return [
		'<!-- wp:columns -->',
		'<div class="wp-block-columns">',
		...columns.map((c) => indent(columnBlock(c))),
		'</div>',
		'<!-- /wp:columns -->',
	].join('\n');
}

/** Render one layout row to markup, or null if every frame in it was unmapped. */
function renderRow(row, ctx) {
	if (row.items.length === 1) {
		const item = row.items[0];
		const markup = renderFrame(item, ctx);
		if (markup == null) return null;
		// A bare text frame gets a group container; image/cover stand alone.
		return item.frame.kind === 'text' ? groupBlock(markup) : markup;
	}

	const columns = row.items
		.map((item) => renderFrame(item, ctx))
		.filter((m) => m != null);
	if (!columns.length) return null;
	if (columns.length === 1) return columns[0];
	return columnsBlock(columns);
}

/**
 * Build the block markup body (no PHP header) for a spread.
 * @returns {string}
 */
export function renderSpreadBody(spread, ctx) {
	const rows = layoutSpread(spread.frames ?? []);
	const blocks = rows.map((row) => renderRow(row, ctx)).filter(Boolean);
	const section = blocks.join('\n\n') || '<!-- wp:spacer {"height":"80px"} -->\n<div style="height:80px" aria-hidden="true" class="wp-block-spacer"></div>\n<!-- /wp:spacer -->';
	return groupBlock(section, { align: 'full' });
}

/**
 * Build a full pattern PHP file for a spread.
 *
 * @param {Object} input
 * @param {object} input.spread
 * @param {number} input.index           0-based spread index.
 * @param {string} input.themePackage
 * @param {string} input.title
 * @param {string} input.patternSlug     "<theme>/spread-N"
 * @param {object} input.ctx             Render context (stories, styles, slugs…).
 * @returns {string}
 */
export function buildPatternFile({ spread, index, themePackage, title, patternSlug, ctx }) {
	const body = renderSpreadBody(spread, ctx);
	const description = `Imported from InDesign spread ${index + 1}. Replace placeholder text and images after inserting.`;
	const header = [
		'<?php',
		'/**',
		` * Title: ${phpDocComment(title)}`,
		` * Slug: ${patternSlug}`,
		` * Categories: ${PATTERN_CATEGORY}`,
		` * Description: ${phpDocComment(description)}`,
		' * Viewport Width: 1400',
		' *',
		` * @package ${themePackage}`,
		' */',
		'',
		'?>',
	].join('\n');
	return `${header}\n${body}\n`;
}

/** Strip characters that would break out of a PHP docblock header line. */
function phpDocComment(text) {
	return String(text ?? '').replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ');
}

export { PATTERN_CATEGORY };
