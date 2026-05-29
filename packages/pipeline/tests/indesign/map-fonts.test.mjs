// InDesign fonts → theme.json font families, via a configurable fallback table.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapFonts, loadFontMap } from '../../src/indesign/map/fonts.js';

const baseFamilies = [
	{ slug: 'sans', name: 'Sans', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
	{ slug: 'serif', name: 'Serif', fontFamily: "Georgia, 'Times New Roman', serif" },
];
const fontMap = { Georgia: { fontFamily: "Georgia, 'Times New Roman', serif", source: 'system', fallback: 'serif' } };

test('maps a known family and warns + falls back for an unknown one', () => {
	const warnings = [];
	const fonts = [
		{ id: 'f1', family: 'Georgia', style: 'Regular' },
		{ id: 'f2', family: 'Bell Gothic', style: 'Bold' },
	];
	const { fontToSlug } = mapFonts(fonts, {
		fontMap,
		baseFontFamilies: baseFamilies,
		warnings: { add: (code, msg) => warnings.push({ code, msg }) },
	});
	assert.equal(fontToSlug.f1, 'serif'); // Georgia's mapped stack matches base serif
	assert.ok(warnings.some((w) => w.code === 'font-fallback' && /Bell Gothic/.test(w.msg)));
	assert.equal(fontToSlug.f2, 'sans'); // heuristic generic → base sans
});

test('deduplicates fonts that share a family and records google fonts', () => {
	const fonts = [
		{ id: 'f1', family: 'Merriweather', style: 'Regular' },
		{ id: 'f2', family: 'Merriweather', style: 'Bold' },
	];
	const map = { Merriweather: { fontFamily: 'Merriweather, Georgia, serif', source: 'google', googleFontName: 'Merriweather', fallback: 'serif' } };
	const { fontFamilies, fontToSlug, googleFonts } = mapFonts(fonts, { fontMap: map, baseFontFamilies: baseFamilies, namespace: 'id' });
	assert.equal(fontToSlug.f1, fontToSlug.f2); // same family → same slug
	assert.equal(fontFamilies.length, 1);
	assert.equal(fontFamilies[0].slug, 'id-merriweather');
	assert.ok(googleFonts.some((g) => g.name === 'Merriweather'));
});

test('ships a default font map with common families', () => {
	const map = loadFontMap();
	assert.ok(map.Helvetica, 'expected Helvetica in the default map');
	assert.ok(map.Georgia, 'expected Georgia in the default map');
});
