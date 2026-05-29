// Assemble a theme.json partial, deep-merge with the base theme, and validate
// against the official WordPress schema (ajv) plus the emitted-subset zod schema.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assemblePartial, mergeThemeJson, validateThemeJson } from '../../src/indesign/map/theme-json.js';

const base = JSON.parse(readFileSync(new URL('../../../../themes/flavian-shop/theme.json', import.meta.url), 'utf8'));

test('assembled partial validates against the WordPress schema', () => {
	const partial = assemblePartial({
		palette: [{ slug: 'id-brand-blue', color: '#0066cc', name: 'Brand Blue' }],
		fontSizes: [{ slug: 'id-lead', size: '1.3125rem', name: 'Lead' }],
		fontFamilies: [],
		spacingSizes: [],
		elements: {},
	});
	assert.equal(partial.version, 3);
	const { valid, errors } = validateThemeJson(partial);
	assert.ok(valid, JSON.stringify(errors));
});

test('merge keeps base tokens and adds namespaced derived tokens', () => {
	const partial = assemblePartial({
		palette: [{ slug: 'id-brand-blue', color: '#0066cc', name: 'Brand Blue' }],
		fontSizes: [],
		fontFamilies: [],
		spacingSizes: [],
		elements: {},
	});
	const merged = mergeThemeJson(base, partial);
	const slugs = merged.settings.color.palette.map((p) => p.slug);
	assert.ok(slugs.includes('primary'), 'base token preserved');
	assert.ok(slugs.includes('id-brand-blue'), 'derived token added');
	assert.ok(validateThemeJson(merged).valid);
});

test('merging the same slug overrides rather than duplicating', () => {
	const partial = assemblePartial({
		palette: [{ slug: 'primary', color: '#123456', name: 'Primary' }],
		fontSizes: [], fontFamilies: [], spacingSizes: [], elements: {},
	});
	const merged = mergeThemeJson(base, partial);
	const primaries = merged.settings.color.palette.filter((p) => p.slug === 'primary');
	assert.equal(primaries.length, 1);
	assert.equal(primaries[0].color, '#123456');
});

test('validation rejects a malformed color token', () => {
	const bad = { version: 3, settings: { color: { palette: [{ slug: 'x' }] } } }; // missing color
	assert.equal(validateThemeJson(bad).valid, false);
});
