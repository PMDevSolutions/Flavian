// Assemble, deep-merge, and validate theme.json output.
//
// The mapper emits an additive, namespaced *partial*. mergeThemeJson folds it
// into a base theme (token arrays merge by slug, so namespaced derived tokens
// extend the curated base without clobbering it). validateThemeJson checks the
// result against the official WordPress block-theme schema (ajv) and the
// emitted-subset zod schema.
//
// The vendored schema in ./schema/theme-json.schema.json is the published
// WordPress theme.json schema (draft-07) from https://schemas.wp.org/trunk/theme.json.

import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { partialThemeSchema } from './schema/partial.zod.js';

const wpSchema = JSON.parse(readFileSync(new URL('./schema/theme-json.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateAgainstWpSchema = ajv.compile(wpSchema);

/**
 * Build an additive theme.json partial from mapped token groups. Empty groups
 * are omitted so the partial stays minimal and schema-clean.
 *
 * @param {Object} groups
 * @param {Array<object>} [groups.palette]
 * @param {Array<object>} [groups.fontSizes]
 * @param {Array<object>} [groups.fontFamilies]
 * @param {Array<object>} [groups.spacingSizes]
 * @param {Record<string, object>} [groups.elements]  styles.elements (h1–h6, caption…)
 * @param {Record<string, object>} [groups.blocks]    styles.blocks (e.g. core/paragraph)
 * @returns {object}
 */
export function assemblePartial(groups = {}) {
	const {
		palette = [],
		fontSizes = [],
		fontFamilies = [],
		spacingSizes = [],
		elements = {},
		blocks = {},
	} = groups;

	const settings = {};
	if (palette.length) settings.color = { palette };
	const typography = {};
	if (fontSizes.length) typography.fontSizes = fontSizes;
	if (fontFamilies.length) typography.fontFamilies = fontFamilies;
	if (Object.keys(typography).length) settings.typography = typography;
	if (spacingSizes.length) settings.spacing = { spacingSizes };

	const styles = {};
	if (elements && Object.keys(elements).length) styles.elements = elements;
	if (blocks && Object.keys(blocks).length) styles.blocks = blocks;

	/** @type {{ version: number, settings?: object, styles?: object }} */
	const partial = { version: 3 };
	if (Object.keys(settings).length) partial.settings = settings;
	if (Object.keys(styles).length) partial.styles = styles;
	return partial;
}

function isPlainObject(v) {
	return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Merge two token arrays by `slug`; partial entries override/extend base. */
function mergeBySlug(baseArr, partialArr) {
	const bySlug = new Map();
	for (const item of baseArr) bySlug.set(item.slug, item);
	for (const item of partialArr) bySlug.set(item.slug, { ...(bySlug.get(item.slug) ?? {}), ...item });
	return [...bySlug.values()];
}

function deepMerge(base, partial) {
	if (Array.isArray(base) && Array.isArray(partial)) {
		const allSlugged = [...base, ...partial].every((x) => isPlainObject(x) && 'slug' in x);
		return allSlugged ? mergeBySlug(base, partial) : [...partial];
	}
	if (isPlainObject(base) && isPlainObject(partial)) {
		const out = { ...base };
		for (const key of Object.keys(partial)) {
			out[key] = key in base ? deepMerge(base[key], partial[key]) : partial[key];
		}
		return out;
	}
	return partial;
}

/**
 * Deep-merge a partial into a base theme. Token arrays merge by slug.
 * @param {object} base
 * @param {object} partial
 * @returns {object}
 */
export function mergeThemeJson(base, partial) {
	return deepMerge(base, partial);
}

/**
 * Validate a theme.json object against the official schema (ajv) and the
 * emitted-subset zod schema.
 * @param {object} themeJson
 * @returns {{ valid: boolean, errors: Array<object> }}
 */
export function validateThemeJson(themeJson) {
	const ajvValid = validateAgainstWpSchema(themeJson);
	const zodResult = partialThemeSchema.safeParse(themeJson);
	const errors = [];
	if (!ajvValid) errors.push(...(validateAgainstWpSchema.errors ?? []));
	if (!zodResult.success) errors.push(...zodResult.error.issues);
	return { valid: ajvValid && zodResult.success, errors };
}
