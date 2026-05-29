// Map IR fonts to theme.json font families via a configurable fallback table
// (config/font-map.json).
//
// A mapped family reuses a base family slug when its CSS stack matches one,
// otherwise it becomes a namespaced derived family. Unmapped families fall back
// to a heuristic generic (serif/sans-serif/monospace) and raise a font-fallback
// warning the report lists. Google-sourced fonts are returned separately so a
// downstream generator can enqueue the web fonts (kept out of theme.json to
// keep the emitted tokens schema-clean).

import { readFileSync } from 'node:fs';
import { namespacedSlug } from './slug.js';

const DEFAULT_FONT_MAP_URL = new URL('../../../config/font-map.json', import.meta.url);

const GENERIC_STACKS = {
	'sans-serif': "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
	serif: "Georgia, 'Times New Roman', serif",
	monospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

/**
 * Load the font map JSON. Defaults to the shipped table.
 * @param {string | URL} [path]
 * @returns {Record<string, { fontFamily: string, source?: string, googleFontName?: string, fallback?: string }>}
 */
export function loadFontMap(path) {
	return JSON.parse(readFileSync(path ?? DEFAULT_FONT_MAP_URL, 'utf8'));
}

/** Case-insensitive lookup into the font map. */
function lookupFontMap(fontMap, family) {
	if (fontMap[family]) return fontMap[family];
	const lower = family.toLowerCase();
	for (const key of Object.keys(fontMap)) {
		if (key.toLowerCase() === lower) return fontMap[key];
	}
	return null;
}

/** Guess a CSS generic family from a font family name. */
function heuristicGeneric(family) {
	if (/mono|courier|consol/i.test(family)) return 'monospace';
	if (/serif|georgia|times|garamond|baskerville|minion|caslon|playfair/i.test(family)) return 'serif';
	return 'sans-serif';
}

/** Normalize a CSS stack for equality comparison. */
function normalizeStack(stack) {
	return String(stack).toLowerCase().replace(/['"\s]/g, '');
}

/** The last (generic) family in a CSS stack. */
function lastFamily(stack) {
	const parts = String(stack).split(',');
	return parts[parts.length - 1].trim().toLowerCase();
}

/**
 * @typedef {Object} MapFontsOptions
 * @property {Record<string, object>} [fontMap]
 * @property {Array<{ slug: string, name?: string, fontFamily: string }>} [baseFontFamilies]
 * @property {string} [namespace]
 * @property {{ add: (code: string, message: string, context?: object) => void }} [warnings]
 *
 * @param {Array<import('../ir.js').FontIR>} fonts
 * @param {MapFontsOptions} [options]
 * @returns {{ fontFamilies: Array<{ slug: string, name: string, fontFamily: string }>, fontToSlug: Record<string, string>, googleFonts: Array<{ slug: string, name: string }> }}
 */
export function mapFonts(fonts, options = {}) {
	const {
		fontMap = {},
		baseFontFamilies = [],
		namespace = 'id',
		warnings,
	} = options;
	const warn = warnings && typeof warnings.add === 'function'
		? (code, message, context) => warnings.add(code, message, context)
		: () => {};

	/** @type {Array<{ slug: string, name: string, fontFamily: string }>} */
	const fontFamilies = [];
	/** @type {Record<string, string>} */
	const fontToSlug = {};
	/** @type {Array<{ slug: string, name: string }>} */
	const googleFonts = [];
	const used = new Set(baseFontFamilies.map((b) => b.slug));
	const familyToSlug = new Map();

	for (const font of fonts) {
		const family = font.family;
		if (!family) continue;
		if (familyToSlug.has(family)) {
			fontToSlug[font.id] = familyToSlug.get(family);
			continue;
		}

		const mapped = lookupFontMap(fontMap, family);
		let stack;
		let fallback;
		let source;
		let googleName;
		if (mapped) {
			stack = mapped.fontFamily;
			fallback = mapped.fallback ?? lastFamily(mapped.fontFamily);
			source = mapped.source;
			googleName = mapped.googleFontName;
		} else {
			fallback = heuristicGeneric(family);
			stack = GENERIC_STACKS[fallback];
			warn('font-fallback', `Font "${family}" is not in the font map; falling back to ${fallback}`, {});
		}

		// Reuse a base family whose stack matches exactly. For unmapped fonts that
		// fell back to a generic, also reuse a base family with the same generic,
		// so the heuristic fallback lands on a curated family rather than a
		// near-duplicate. Mapped fonts keep their own family unless the stack
		// matches a base exactly.
		const baseMatch = baseFontFamilies.find((b) => normalizeStack(b.fontFamily) === normalizeStack(stack))
			?? (mapped ? undefined : baseFontFamilies.find((b) => lastFamily(b.fontFamily) === fallback));

		let slug;
		if (baseMatch) {
			slug = baseMatch.slug;
		} else {
			slug = namespacedSlug(family, namespace, used, 'font');
			used.add(slug);
			fontFamilies.push({ slug, name: family, fontFamily: stack });
			if (source === 'google' && googleName) googleFonts.push({ slug, name: googleName });
		}
		familyToSlug.set(family, slug);
		fontToSlug[font.id] = slug;
	}

	return { fontFamilies, fontToSlug, googleFonts };
}
