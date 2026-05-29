// Shared color conversion: RGB/CMYK/LAB → sRGB, with out-of-gamut detection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	rgbToSrgbHex,
	cmykToSrgb,
	labToSrgb,
	colorFromComponents,
} from '../../src/indesign/color.js';

test('rgbToSrgbHex formats 0..255 channels', () => {
	assert.equal(rgbToSrgbHex([0, 102, 204]), '#0066cc');
});

test('cmykToSrgb (0..100) matches the naive IDML preview', () => {
	assert.deepEqual(cmykToSrgb([0, 0, 0, 100]), { hex: '#000000', outOfGamut: false });
	assert.deepEqual(cmykToSrgb([0, 0, 0, 0]), { hex: '#ffffff', outOfGamut: false });
	// Pure cyan ink.
	assert.equal(cmykToSrgb([100, 0, 0, 0]).hex, '#00ffff');
});

test('labToSrgb converts reference values (D50)', () => {
	assert.equal(labToSrgb([100, 0, 0]).hex, '#ffffff'); // white
	assert.equal(labToSrgb([0, 0, 0]).hex, '#000000');   // black
	// Mid grey L*≈53.39 → ~#7f7f7f / #808080. Assert a neutral grey, not exact.
	const grey = labToSrgb([53.389, 0, 0]).hex;
	assert.match(grey, /^#(7[0-9a-f]|80)\1\1$/);
});

test('labToSrgb does not flag in-gamut white, flags saturated out-of-gamut color', () => {
	assert.equal(labToSrgb([100, 0, 0]).outOfGamut, false);
	// Extreme saturation well outside sRGB.
	assert.equal(labToSrgb([50, 120, -120]).outOfGamut, true);
});

test('colorFromComponents dispatches by space and falls back to hex', () => {
	assert.equal(colorFromComponents('CMYK', [0, 0, 0, 100], '#123456').hex, '#000000');
	assert.equal(colorFromComponents('RGB', [0, 102, 204], '#123456').hex, '#0066cc');
	// No components → fall back to the supplied hex.
	assert.equal(colorFromComponents('LAB', undefined, '#abcdef').hex, '#abcdef');
	// Opaque spaces fall back to hex.
	assert.equal(colorFromComponents('Spot', [1, 2, 3], '#abcdef').hex, '#abcdef');
});
