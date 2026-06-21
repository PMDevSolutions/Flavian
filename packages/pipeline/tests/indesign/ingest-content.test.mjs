// The content-extraction transform: reading order, multi-level heading
// inference from font sizes, figure extraction, and run grouping — exercised on
// a small in-code IDML fixture whose frames are deliberately out of order.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseIdmlBuffer } from '../../src/indesign/parse-idml.js';
import { extractContent } from '../../src/indesign/ingest/content.js';
import { buildIdml } from './helpers/build-idml.js';

/** Three type sizes (36/24/12pt → 48/32/16px), one image, frames shuffled. */
function miniIr() {
	const bytes = buildIdml({
		name: 'Mini',
		fonts: [{ id: 'f', family: 'Helvetica', style: 'Regular' }],
		styles: [
			{ id: 'h1', name: 'Heading 1', kind: 'paragraph', pointSize: 36, appliedFont: 'f' },
			{ id: 'h2', name: 'Heading 2', kind: 'paragraph', pointSize: 24, appliedFont: 'f' },
			{ id: 'body', name: 'Body', kind: 'paragraph', pointSize: 12, appliedFont: 'f' },
		],
		stories: [
			{ id: 's-h1', runs: [{ text: 'Big Title', paragraphStyle: 'h1' }] },
			{ id: 's-h2', runs: [{ text: 'Subhead', paragraphStyle: 'h2' }] },
			{ id: 's-body', runs: [{ text: 'Body copy here.', paragraphStyle: 'body' }] },
		],
		spreads: [
			{
				id: 'sp1',
				pages: [{ id: 'pg1', bounds: [0, 0, 792, 612] }],
				// Source order is scrambled on purpose; reading order is by y, then x.
				frames: [
					{ kind: 'text', id: 'tf-body', bounds: [300, 60, 360, 540], parentStory: 's-body' },
					{ kind: 'text', id: 'tf-h1', bounds: [60, 60, 120, 540], parentStory: 's-h1' },
					{ kind: 'image', id: 'img', bounds: [130, 60, 280, 540], href: 'file:Links/pic.png' },
					{ kind: 'text', id: 'tf-h2', bounds: [285, 60, 320, 540], parentStory: 's-h2' },
				],
			},
		],
	});
	return parseIdmlBuffer(bytes);
}

test('builds one section per spread with reading-ordered, classified blocks', () => {
	const content = extractContent(miniIr());

	assert.equal(content.sections.length, 1);
	const { blocks, title } = content.sections[0];
	assert.equal(title, 'Big Title');

	assert.deepEqual(
		blocks.map((b) => [b.type, b.level ?? b.text]),
		[
			['heading', 1], // Big Title (largest size → h1), top of the page
			['figure', undefined], // image sits below the title
			['heading', 2], // Subhead (next size → h2)
			['paragraph', 'Body copy here.'], // smallest size = body baseline
		],
	);
	assert.equal(blocks[0].text, 'Big Title');
	assert.equal(blocks[2].text, 'Subhead');
	assert.equal(blocks[1].href, 'file:Links/pic.png');
});

test('emits a flat heading outline', () => {
	const content = extractContent(miniIr());
	assert.deepEqual(content.outline, [
		{ level: 1, text: 'Big Title' },
		{ level: 2, text: 'Subhead' },
	]);
});

test('reports accurate stats', () => {
	const content = extractContent(miniIr());
	assert.deepEqual(content.stats, {
		sections: 1,
		blocks: 4,
		headings: 2,
		paragraphs: 1,
		figures: 1,
		emptyTextFrames: 0,
		danglingStoryRefs: 0,
	});
});

test('a single type size yields no headings (everything is body)', () => {
	const bytes = buildIdml({
		name: 'Flat',
		styles: [{ id: 'body', name: 'Body', kind: 'paragraph', pointSize: 12 }],
		stories: [
			{ id: 's1', runs: [{ text: 'One.', paragraphStyle: 'body' }] },
			{ id: 's2', runs: [{ text: 'Two.', paragraphStyle: 'body' }] },
		],
		spreads: [
			{
				id: 'sp1',
				pages: [{ id: 'pg1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'f1', bounds: [60, 60, 100, 540], parentStory: 's1' },
					{ kind: 'text', id: 'f2', bounds: [120, 60, 160, 540], parentStory: 's2' },
				],
			},
		],
	});
	const content = extractContent(parseIdmlBuffer(bytes));
	assert.equal(content.stats.headings, 0);
	assert.equal(content.stats.paragraphs, 2);
	assert.equal(content.outline.length, 0);
});

test('counts a text frame with a dangling story reference', () => {
	const bytes = buildIdml({
		name: 'Dangling',
		styles: [{ id: 'body', name: 'Body', kind: 'paragraph', pointSize: 12 }],
		stories: [{ id: 's-real', runs: [{ text: 'Real.', paragraphStyle: 'body' }] }],
		spreads: [
			{
				id: 'sp1',
				pages: [{ id: 'pg1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'f-real', bounds: [60, 60, 100, 540], parentStory: 's-real' },
					{ kind: 'text', id: 'f-ghost', bounds: [120, 60, 160, 540], parentStory: 's-missing' },
				],
			},
		],
	});
	const content = extractContent(parseIdmlBuffer(bytes));
	assert.equal(content.stats.danglingStoryRefs, 1);
	assert.equal(content.stats.paragraphs, 1);
});
