// Escaping helpers for the artifacts the generator emits.
//
// Pattern files are PHP, but the design *content* we drop into block markup is
// static — we escape it once at generation time rather than echoing it through
// PHP. Image URLs are the exception: those go through get_theme_file_uri() so a
// relocated theme still resolves its assets (the pattern-first rule).

/** Escape text for an HTML text node. */
export function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/** Escape text for a double-quoted HTML attribute. */
export function escapeAttr(value) {
	return escapeHtml(value).replace(/"/g, '&quot;');
}

/** Escape a value for a single-quoted PHP string literal. */
export function phpSingleQuoted(value) {
	return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * A `get_theme_file_uri()` PHP expression for an asset path relative to the
 * theme root. Keeps images resolvable wherever the theme is installed.
 */
export function themeFileUri(relPath) {
	return `<?php echo esc_url( get_theme_file_uri( '${phpSingleQuoted(relPath)}' ) ); ?>`;
}

/**
 * Collapse a block of imported prose into HTML, preserving hard breaks. A run's
 * text may carry embedded newlines (from <Br/> or paragraph terminators); inner
 * newlines become <br>, the value is otherwise escaped.
 */
export function inlineWithBreaks(text) {
	return String(text ?? '')
		.split('\n')
		.map((line) => escapeHtml(line))
		.join('<br>');
}
