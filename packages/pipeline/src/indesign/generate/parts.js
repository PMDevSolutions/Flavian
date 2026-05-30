// Template parts from master-spread chrome. A master's repeating elements split
// by vertical position: text in the top band becomes the header, text in the
// bottom band becomes the footer (page-number / running-head chrome → a web
// footer line). With no usable master, sensible FSE defaults are emitted so the
// theme still has a working header and footer.

import { renderTextFrameInner, indent } from './blocks.js';

const DEFAULT_HEADER = [
	'<!-- wp:group {"tagName":"header","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|30","right":"var:preset|spacing|40","bottom":"var:preset|spacing|30","left":"var:preset|spacing|40"}}},"layout":{"type":"constrained"}} -->',
	'<header class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--30);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--30);padding-left:var(--wp--preset--spacing--40)">',
	'\t<!-- wp:group {"layout":{"type":"flex","justifyContent":"space-between","flexWrap":"nowrap"}} -->',
	'\t<div class="wp-block-group">',
	'\t\t<!-- wp:site-title {"level":0} /-->',
	'',
	'\t\t<!-- wp:navigation {"overlayMenu":"mobile"} /-->',
	'\t</div>',
	'\t<!-- /wp:group -->',
	'</header>',
	'<!-- /wp:group -->',
	'',
].join('\n');

const DEFAULT_FOOTER = [
	'<!-- wp:group {"tagName":"footer","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|40","right":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|40"}}},"layout":{"type":"constrained"}} -->',
	'<footer class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)">',
	'\t<!-- wp:paragraph {"align":"center"} -->',
	'\t<p class="has-text-align-center"><?php echo esc_html( wp_date( "Y" ) ); ?> &middot; <?php echo esc_html( get_bloginfo( "name" ) ); ?></p>',
	'\t<!-- /wp:paragraph -->',
	'</footer>',
	'<!-- /wp:group -->',
	'',
].join('\n');

/** Text-frame inner blocks whose vertical centre falls in [lo, hi) of the page. */
function bandText(master, ctx, lo, hi) {
	const page = master.pages?.[0]?.bounds;
	const pageTop = page ? page.y : 0;
	const pageHeight = page ? page.height : null;
	const frames = (master.frames ?? [])
		.filter((f) => f.kind === 'text')
		.filter((f) => {
			if (!pageHeight) return false;
			const centre = f.bounds.y + f.bounds.height / 2;
			const rel = (centre - pageTop) / pageHeight;
			return rel >= lo && rel < hi;
		})
		.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
	return frames.flatMap((f) => renderTextFrameInner(f, ctx));
}

function wrap(tagName, inner) {
	return [
		`<!-- wp:group {"tagName":"${tagName}","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|40","right":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|40"}}},"layout":{"type":"constrained"}} -->`,
		`<${tagName} class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)">`,
		indent(inner),
		`</${tagName}>`,
		'<!-- /wp:group -->',
		'',
	].join('\n');
}

/**
 * Build header + footer parts. Uses the first master spread's chrome when it has
 * usable text; otherwise emits defaults.
 *
 * @returns {{ header: string, footer: string, derivedFromMaster: boolean }}
 */
export function buildParts(ir, ctx) {
	const master = (ir.masterSpreads ?? [])[0];
	if (!master) return { header: DEFAULT_HEADER, footer: DEFAULT_FOOTER, derivedFromMaster: false };

	const top = bandText(master, ctx, 0, 0.34);
	const bottom = bandText(master, ctx, 0.66, 1.01);
	const header = top.length ? wrap('header', top.join('\n\n')) : DEFAULT_HEADER;
	const footer = bottom.length ? wrap('footer', bottom.join('\n\n')) : DEFAULT_FOOTER;
	return { header, footer, derivedFromMaster: top.length > 0 || bottom.length > 0 };
}
