// Deterministic naming for everything the generator emits. Same IR in → same
// slugs and filenames out, so reruns never churn unrelated files.

import { slugify } from '../map/slug.js';

const FALLBACK_THEME_SLUG = 'indesign-import';

/** Theme directory slug: explicit option → document name → fallback. */
export function themeSlug(ir, explicit) {
	return slugify(explicit) || slugify(ir?.meta?.name) || FALLBACK_THEME_SLUG;
}

/** Human-facing theme name. */
export function themeName(ir, explicit) {
	if (explicit && typeof explicit === 'string') return explicit;
	const name = ir?.meta?.name;
	return name && String(name).trim() ? String(name) : 'InDesign Import';
}

/** PHP @package tag, e.g. "Indesign_Import". */
export function themePackage(slug) {
	return slug
		.split('-')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('_');
}

/** Stable pattern slug for a spread, 1-based: "<theme>/spread-N". */
export function spreadPatternSlug(slug, index) {
	return `${slug}/spread-${index + 1}`;
}

/** File extension for an asset href, defaulting to png. */
function assetExt(href) {
	const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(String(href ?? ''));
	return m ? m[1].toLowerCase() : 'png';
}

/**
 * Deterministic asset filename for an image frame. Index-based so a missing or
 * duplicated href never collides or reorders: "spread-N-image-K.ext".
 */
export function assetFileName(spreadIndex, frameIndex, href) {
	return `spread-${spreadIndex + 1}-image-${frameIndex + 1}.${assetExt(href)}`;
}

export { slugify };
