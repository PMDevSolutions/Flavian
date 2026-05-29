// Positional clustering heuristics (pure, no pdfjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupLines, clusterIntoFrames, detectColumns } from '../../src/indesign/pdf/cluster.js';

function item(text, x, baseline, { width = 50, fontSize = 12, fontKey = 'f1' } = {}) {
	return { text, x, baseline, width, fontSize, fontKey };
}

test('groupLines merges runs sharing a baseline', () => {
	const lines = groupLines([
		item('Hello', 72, 100),
		item('World', 130, 100.2), // within baseline tolerance
		item('Next', 72, 130), // new line
	]);
	assert.equal(lines.length, 2);
	assert.equal(lines[0].items.length, 2);
	assert.equal(lines[0].items[0].text, 'Hello'); // sorted by x
	assert.equal(lines[1].items.length, 1);
});

test('clusterIntoFrames keeps adjacent body lines in one frame', () => {
	const frames = clusterIntoFrames([
		item('Line one of the paragraph', 72, 100),
		item('Line two of the paragraph', 72, 116),
		item('Line three of the paragraph', 72, 132),
	]);
	assert.equal(frames.length, 1);
	assert.equal(frames[0].lines.length, 3);
});

test('clusterIntoFrames splits a far-apart block into a second frame', () => {
	const frames = clusterIntoFrames([
		item('Top block', 72, 100),
		item('Bottom block far below', 72, 500),
	]);
	assert.equal(frames.length, 2);
});

test('clusterIntoFrames separates side-by-side columns', () => {
	const left = [item('L1', 72, 100), item('L2', 72, 116), item('L3', 72, 132)];
	const right = [item('R1', 340, 100), item('R2', 340, 116), item('R3', 340, 132)];
	const frames = clusterIntoFrames([...left, ...right]);
	assert.equal(frames.length, 2);
	assert.equal(detectColumns(frames), 2);
	// Frames don't horizontally overlap.
	const [a, b] = frames.sort((x, y) => x.bounds.minX - y.bounds.minX);
	assert.ok(a.bounds.maxX <= b.bounds.minX);
});

test('detectColumns is 1 for a single column', () => {
	const frames = clusterIntoFrames([item('A', 72, 100), item('B', 72, 120)]);
	assert.equal(detectColumns(frames), 1);
});

test('clusterIntoFrames ignores whitespace-only runs', () => {
	const frames = clusterIntoFrames([item('   ', 72, 100), item('', 80, 100)]);
	assert.equal(frames.length, 0);
});
