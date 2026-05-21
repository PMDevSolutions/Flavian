import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ptToPx, lengthToPx, roundPx } from '../../src/indesign/units.js';

test('ptToPx converts at 96 dpi (CSS default)', () => {
	// 72pt = 1 inch = 96px at 96 dpi
	assert.equal(ptToPx(72, 96), 96);
	// 12pt body text → 16px
	assert.equal(ptToPx(12, 96), 16);
});

test('ptToPx scales linearly with dpi', () => {
	assert.equal(ptToPx(72, 72), 72);
	assert.equal(ptToPx(72, 144), 144);
});

test('lengthToPx accepts bare numbers as points', () => {
	assert.equal(lengthToPx(72, 96), 96);
});

test('lengthToPx accepts unit suffixes', () => {
	assert.equal(lengthToPx('1in', 96), 96);
	assert.equal(lengthToPx('1pc', 96), 16);                 // 1 pica = 12pt
	assert.equal(lengthToPx('25.4mm', 96), 96);              // 25.4mm = 1in
	assert.equal(lengthToPx('2.54cm', 96), 96);
	assert.equal(lengthToPx('100px', 96), 100);              // px passes through
});

test('lengthToPx returns NaN for garbage', () => {
	assert.ok(Number.isNaN(lengthToPx('not-a-number', 96)));
	assert.ok(Number.isNaN(lengthToPx('5furlongs', 96)));
});

test('roundPx caps at 3 decimal places', () => {
	assert.equal(roundPx(1.2345678), 1.235);
	assert.equal(roundPx(96), 96);
});
