// Color normalization + nearest-swatch matching (pure, no pdfjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rgbToHex, grayToHex, cmykToHex, hexToRgb, colorDistance, nearestSwatch } from '../../src/indesign/pdf/color.js';

test('rgbToHex clamps and lowercases', () => {
	assert.equal(rgbToHex([0, 102, 204]), '#0066cc');
	assert.equal(rgbToHex([300, -5, 16]), '#ff0010');
});

test('grayToHex mirrors the channel', () => {
	assert.equal(grayToHex(0), '#000000');
	assert.equal(grayToHex(255), '#ffffff');
	assert.equal(grayToHex(128), '#808080');
});

test('cmykToHex matches the IDML naive conversion (0/0/0/1 = black)', () => {
	assert.equal(cmykToHex([0, 0, 0, 1]), '#000000');
	assert.equal(cmykToHex([0, 0, 0, 0]), '#ffffff');
});

test('hexToRgb round-trips', () => {
	assert.deepEqual(hexToRgb('#0066cc'), [0, 102, 204]);
	assert.deepEqual(hexToRgb('ffffff'), [255, 255, 255]);
});

test('colorDistance is zero for identical colors', () => {
	assert.equal(colorDistance('#123456', '#123456'), 0);
	assert.ok(colorDistance('#000000', '#ffffff') > 0);
});

test('nearestSwatch snaps to the closest palette entry within tolerance', () => {
	const palette = [
		{ id: 'col-brand', name: 'Brand Blue', color: { hex: '#0066cc', space: 'RGB' } },
		{ id: 'col-ink', name: 'Ink', color: { hex: '#000000', space: 'CMYK' } },
	];
	// Slightly-off brand blue should snap to the brand swatch.
	assert.equal(nearestSwatch('#0265cb', palette)?.id, 'col-brand');
	// Near-black snaps to ink.
	assert.equal(nearestSwatch('#050505', palette)?.id, 'col-ink');
});

test('nearestSwatch returns null when nothing is close enough', () => {
	const palette = [{ id: 'col-ink', name: 'Ink', color: { hex: '#000000', space: 'CMYK' } }];
	assert.equal(nearestSwatch('#00ff00', palette), null);
});
