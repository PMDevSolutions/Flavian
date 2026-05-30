// FSE templates. index.html stitches the imported spread patterns between the
// header and footer parts so the design renders end-to-end; page.html and
// 404.html are minimal, valid fallbacks that keep the Site Editor happy.

function shell(mainInner) {
	return [
		'<!-- wp:template-part {"slug":"header","tagName":"header"} /-->',
		'',
		'<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->',
		'<main class="wp-block-group">',
		mainInner,
		'</main>',
		'<!-- /wp:group -->',
		'',
		'<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->',
		'',
	].join('\n');
}

/** index.html — references every spread pattern in order. */
export function buildIndexTemplate(patternSlugs) {
	const refs = patternSlugs.length
		? patternSlugs.map((slug) => `\t<!-- wp:pattern {"slug":"${slug}"} /-->`).join('\n\n')
		: '\t<!-- wp:post-content /-->';
	return shell(refs);
}

/** page.html — standard single-page layout. */
export function buildPageTemplate() {
	return shell(
		[
			'\t<!-- wp:post-title {"level":1} /-->',
			'',
			'\t<!-- wp:post-content {"layout":{"type":"constrained"}} /-->',
		].join('\n'),
	);
}

/** 404.html — friendly not-found page. */
export function buildNotFoundTemplate() {
	return shell(
		[
			'\t<!-- wp:heading {"level":1} -->',
			'\t<h1 class="wp-block-heading">Page not found</h1>',
			'\t<!-- /wp:heading -->',
			'',
			'\t<!-- wp:paragraph -->',
			'\t<p>The page you were looking for is not here.</p>',
			'\t<!-- /wp:paragraph -->',
		].join('\n'),
	);
}
