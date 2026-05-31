// Output generator: a parsed IR → a complete, installable FSE theme. Covers the
// acceptance criteria for sub-issue #65 — schema-valid theme.json, one pattern
// per spread under the "InDesign Imports" category, an enumerating report, and
// snapshot coverage of the generated markup for a text-heavy and an image-heavy
// spread. Snapshots live in __snapshots__/ and update with UPDATE_SNAPSHOTS=1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { generateTheme } from '../../src/indesign/generate/index.js';
import { parseIdmlBuffer } from '../../src/indesign/parse-idml.js';
import { parsePdfBuffer } from '../../src/indesign/parse-pdf.js';
import { buildIdml } from './helpers/build-idml.js';
import { buildPdf } from './helpers/build-pdf.js';

const SNAP_DIR = fileURLToPath(new URL('./__snapshots__/', import.meta.url));

/** Compare against a committed snapshot, or write it when UPDATE_SNAPSHOTS is set. */
function matchSnapshot(name, actual) {
	const file = path.join(SNAP_DIR, name);
	if (process.env.UPDATE_SNAPSHOTS) {
		mkdirSync(SNAP_DIR, { recursive: true });
		writeFileSync(file, actual);
		return;
	}
	let expected;
	try {
		expected = readFileSync(file, 'utf8');
	} catch {
		throw new Error(`Missing snapshot ${name}. Re-run with UPDATE_SNAPSHOTS=1 to create it.`);
	}
	assert.equal(actual, expected, `snapshot ${name} drifted`);
}

/** A two-spread catalog: spread 1 is text-heavy, spread 2 is image-heavy. */
function buildCatalog() {
	return buildIdml({
		name: 'Catalog',
		colors: [
			{ id: 'col-brand', name: 'Brand', space: 'RGB', values: [10, 80, 200] },
			{ id: 'col-ink', name: 'Ink', space: 'CMYK', values: [0, 0, 0, 100] },
		],
		fonts: [{ id: 'f', family: 'Helvetica', style: 'Bold', postScriptName: 'Helvetica-Bold' }],
		styles: [
			{ id: 'p-h1', name: 'Heading 1', kind: 'paragraph', pointSize: 36, leading: 40, appliedFont: 'f', fillColor: 'col-brand' },
			{ id: 'p-h2', name: 'Heading 2', kind: 'paragraph', pointSize: 24, leading: 28, fillColor: 'col-ink' },
			{ id: 'p-body', name: 'Body', kind: 'paragraph', pointSize: 12, leading: 18, fillColor: 'col-ink' },
		],
		stories: [
			{ id: 's-title', runs: [{ text: 'Spring Catalog', paragraphStyle: 'p-h1' }] },
			{ id: 's-copy', runs: [{ text: 'Section heading', paragraphStyle: 'p-h2' }, { text: 'First paragraph of body copy.', paragraphStyle: 'p-body' }] },
			{ id: 's-hero', runs: [{ text: 'On Sale Now', paragraphStyle: 'p-h1' }] },
		],
		spreads: [
			{
				id: 'text-spread',
				pages: [{ id: 'p1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'tf-title', bounds: [60, 60, 140, 540], parentStory: 's-title' },
					{ kind: 'text', id: 'tf-copy', bounds: [160, 60, 420, 540], parentStory: 's-copy' },
				],
			},
			{
				id: 'image-spread',
				pages: [{ id: 'p2', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'image', id: 'if-hero', bounds: [0, 0, 612, 792], href: 'file:Links/hero.png' },
					{ kind: 'text', id: 'if-overlay', bounds: [200, 100, 320, 500], parentStory: 's-hero' },
				],
			},
		],
	});
}

const file = (result, p) => result.files.find((f) => f.path === p);

test('generates a schema-valid, Flavian-compatible theme', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const result = generateTheme(ir);

	assert.equal(result.report.data.valid, true, JSON.stringify(result.tokens.report.validationErrors));

	// The files a block theme needs to load in the Site Editor.
	for (const p of ['style.css', 'functions.php', 'theme.json', 'templates/index.html', 'templates/page.html', 'templates/404.html', 'parts/header.html', 'parts/footer.html', 'bin/import-media.sh', 'indesign-pipeline-report.md']) {
		assert.ok(file(result, p), `missing ${p}`);
	}

	// theme.json is the merged base + partial.
	const themeJson = JSON.parse(file(result, 'theme.json').contents);
	assert.equal(themeJson.version, 3);
	assert.ok(themeJson.settings.color.palette.length > 0);

	// functions.php registers the import category with the expected label.
	const fns = file(result, 'functions.php').contents;
	assert.match(fns, /register_block_pattern_category\(\s*'indesign-imports'/);
	assert.match(fns, /'label'\s*=>\s*__\(\s*'InDesign Imports'/);
});

test('emits one pattern per spread under the InDesign Imports category', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const result = generateTheme(ir);

	const patterns = result.files.filter((f) => /^patterns\/spread-\d+\.php$/.test(f.path));
	assert.equal(patterns.length, ir.spreads.length);

	for (const p of patterns) {
		assert.match(p.contents, /^\s*\* Categories: indesign-imports$/m);
		assert.match(p.contents, /^\s*\* Slug: catalog\/spread-\d+$/m);
	}

	// index.html references every spread pattern so the design renders.
	const index = file(result, 'templates/index.html').contents;
	assert.match(index, /<!-- wp:pattern \{"slug":"catalog\/spread-1"\} \/-->/);
	assert.match(index, /<!-- wp:pattern \{"slug":"catalog\/spread-2"\} \/-->/);
});

test('snapshot: text-heavy spread markup', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const result = generateTheme(ir);
	matchSnapshot('pattern-text-spread.php', file(result, 'patterns/spread-1.php').contents);
});

test('snapshot: image-heavy spread markup', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const result = generateTheme(ir);
	matchSnapshot('pattern-image-spread.php', file(result, 'patterns/spread-2.php').contents);
});

test('patterns use design tokens, never inline colors or font sizes', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const result = generateTheme(ir);
	const patterns = result.files.filter((f) => f.path.startsWith('patterns/'));
	for (const p of patterns) {
		// References preset slugs.
		assert.match(p.contents, /"fontSize":"/);
		// No hardcoded hex colors or inline font-size declarations.
		assert.doesNotMatch(p.contents, /#[0-9a-fA-F]{6}\b/, `${p.path} has a hardcoded color`);
		assert.doesNotMatch(p.contents, /font-size:\s*\d/, `${p.path} has an inline font-size`);
	}
});

test('every token slug referenced in patterns exists in the merged theme.json', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const result = generateTheme(ir);

	const fontSizes = new Set((result.themeJson.settings.typography.fontSizes ?? []).map((s) => s.slug));
	const colors = new Set((result.themeJson.settings.color.palette ?? []).map((s) => s.slug));

	const body = result.files.filter((f) => f.path.startsWith('patterns/')).map((f) => f.contents).join('\n');
	for (const [, slug] of body.matchAll(/"fontSize":"([^"]+)"/g)) {
		assert.ok(fontSizes.has(slug), `font-size slug "${slug}" not in theme.json`);
	}
	for (const [, slug] of body.matchAll(/"textColor":"([^"]+)"/g)) {
		assert.ok(colors.has(slug), `color slug "${slug}" not in theme.json`);
	}
});

test('report enumerates produced files and unmapped IR nodes', () => {
	// A spread with a text frame whose story is missing → unmapped.
	const idml = buildIdml({
		name: 'Partial',
		styles: [{ id: 'p-body', name: 'Body', kind: 'paragraph', pointSize: 12 }],
		stories: [{ id: 's-ok', runs: [{ text: 'Mapped text.', paragraphStyle: 'p-body' }] }],
		spreads: [
			{
				id: 'spread-1',
				pages: [{ id: 'p1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'good', bounds: [60, 60, 120, 540], parentStory: 's-ok' },
					{ kind: 'text', id: 'orphan', bounds: [200, 60, 260, 540] }, // no parentStory
				],
			},
		],
	});
	const ir = parseIdmlBuffer(idml);
	const result = generateTheme(ir);

	const md = file(result, 'indesign-pipeline-report.md').contents;
	assert.match(md, /## Produced artifacts/);
	assert.match(md, /`patterns\/spread-1\.php`/);
	assert.match(md, /`theme\.json`/);

	// The orphan text frame is reported as unmapped.
	assert.match(md, /## Unmapped IR nodes/);
	assert.match(md, /`orphan`/);
	assert.ok(result.report.data.unmapped.some((u) => u.id === 'orphan'));
});

test('emits a machine-readable JSON report alongside the Markdown one', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const result = generateTheme(ir);

	const json = file(result, 'indesign-pipeline-report.json');
	assert.ok(json, 'missing indesign-pipeline-report.json');
	const data = JSON.parse(json.contents);

	assert.equal(data.theme.slug, 'catalog');
	assert.equal(data.valid, true);
	assert.equal(data.spreadCount, ir.spreads.length);
	assert.equal(data.patterns.length, ir.spreads.length);
	assert.ok(Array.isArray(data.files) && data.files.includes('theme.json'));
	assert.ok(data.files.includes('indesign-pipeline-report.json'));
	assert.ok(data.tokens && data.tokens.counts);
});

test('output is deterministic across runs', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const a = generateTheme(ir);
	const b = generateTheme(ir);
	assert.deepEqual(a.files, b.files);
});

test('plans staged assets and emits an import script', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	const result = generateTheme(ir);

	assert.equal(result.assets.length, 1);
	assert.equal(result.assets[0].relPath, 'assets/spread-2-image-1.png');

	const script = file(result, 'bin/import-media.sh');
	assert.ok(script);
	assert.equal(script.mode, '755');
	assert.match(script.contents, /wp media import/);
});

test('--seed-content adds a seeding script; default omits it', () => {
	const ir = parseIdmlBuffer(buildCatalog());
	assert.ok(!file(generateTheme(ir), 'bin/seed-content.sh'));

	const seeded = generateTheme(ir, { seedContent: true });
	const script = file(seeded, 'bin/seed-content.sh');
	assert.ok(script);
	assert.match(script.contents, /wp post create/);
	assert.match(script.contents, /wp:pattern \{"slug":"catalog\/spread-1"\}/);
});

test('works on a PDF-derived IR (source-agnostic)', async () => {
	const toUnit = ([r, g, b]) => [r / 255, g / 255, b / 255];
	const pdf = buildPdf({
		title: 'Flyer',
		pages: [
			{
				width: 612,
				height: 792,
				texts: [
					{ text: 'Big Sale', x: 72, y: 96, size: 36, font: 'Helvetica-Bold', color: toUnit([20, 184, 166]) },
					{ text: 'Everything must go this weekend only.', x: 72, y: 150, size: 12, font: 'Helvetica', color: toUnit([0, 0, 0]) },
				],
			},
		],
	});
	const ir = await parsePdfBuffer(pdf);
	const result = generateTheme(ir);

	assert.equal(result.report.data.valid, true);
	const patterns = result.files.filter((f) => f.path.startsWith('patterns/'));
	assert.equal(patterns.length, ir.spreads.length);
	assert.ok(patterns.length >= 1);
});
