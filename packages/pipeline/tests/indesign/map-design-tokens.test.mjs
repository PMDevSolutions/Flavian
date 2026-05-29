// Mapped token groups → Style Dictionary (DTCG) design tokens.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDesignTokens } from '../../src/indesign/map/design-tokens.js';

test('emits DTCG-shaped tokens with type, value, and provenance', () => {
	const dtcg = toDesignTokens({
		palette: [{ slug: 'id-brand', color: '#0066cc', name: 'Brand' }],
		fontSizes: [{ slug: 'id-lead', size: '1.3125rem', name: 'Lead' }],
		fontFamilies: [{ slug: 'id-merriweather', fontFamily: 'Merriweather, serif', name: 'Merriweather' }],
		spacingSizes: [{ slug: 'id-space-10', size: '1.25rem', name: 'Space 10' }],
	});
	assert.equal(dtcg.color['id-brand'].$value, '#0066cc');
	assert.equal(dtcg.color['id-brand'].$type, 'color');
	assert.equal(dtcg.color['id-brand'].$description, 'Brand');
	assert.equal(dtcg.fontSize['id-lead'].$type, 'dimension');
	assert.equal(dtcg.fontFamily['id-merriweather'].$type, 'fontFamily');
	assert.equal(dtcg.fontFamily['id-merriweather'].$value, 'Merriweather, serif');
	assert.equal(dtcg.spacing['id-space-10'].$type, 'dimension');
});

test('omits empty groups', () => {
	const dtcg = toDesignTokens({ palette: [{ slug: 'id-brand', color: '#0066cc', name: 'Brand' }] });
	assert.ok(dtcg.color);
	assert.equal(dtcg.fontSize, undefined);
	assert.equal(dtcg.spacing, undefined);
});
