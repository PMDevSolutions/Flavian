// End-to-end: the canonical Spring Brochure fixture runs through the full
// InDesign pipeline (parse → map tokens → generate) for BOTH input formats and
// produces a working FSE theme. This is the epic-level acceptance check (#61):
// a representative .idml and a representative exported PDF both yield a valid
// theme with at least one block pattern per spread and a populated theme.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseIdmlBuffer } from '../../../packages/pipeline/src/indesign/parse-idml.js';
import { parsePdfBuffer } from '../../../packages/pipeline/src/indesign/parse-pdf.js';
import { generateTheme } from '../../../packages/pipeline/src/indesign/generate/index.js';
import { buildBrochureIdml, buildBrochurePdf, BROCHURE_NAME } from './brochure.mjs';

/** Assert a generated theme is valid, has a pattern per spread, and real tokens. */
function assertWorkingTheme(result, ir) {
	assert.equal(result.report.data.valid, true, JSON.stringify(result.tokens.report.validationErrors));

	const patterns = result.files.filter((f) => /^patterns\/spread-\d+\.php$/.test(f.path));
	assert.ok(ir.spreads.length >= 1, 'fixture should have at least one spread');
	assert.equal(patterns.length, ir.spreads.length, 'one pattern per spread');
	for (const p of patterns) assert.match(p.contents, /Categories: indesign-imports/);

	// theme.json is populated with a palette and a typography scale.
	const themeJson = JSON.parse(result.files.find((f) => f.path === 'theme.json').contents);
	assert.equal(themeJson.version, 3);
	assert.ok(themeJson.settings.color.palette.length > 0, 'theme.json has colors');
	assert.ok((themeJson.settings.typography.fontSizes ?? []).length > 0, 'theme.json has font sizes');

	// Both reports are emitted.
	assert.ok(result.files.some((f) => f.path === 'indesign-pipeline-report.md'));
	assert.ok(result.files.some((f) => f.path === 'indesign-pipeline-report.json'));
}

test('IDML fixture → valid FSE theme (primary path)', () => {
	const ir = parseIdmlBuffer(buildBrochureIdml());
	assert.equal(ir.meta.name, BROCHURE_NAME);
	assert.equal(ir.spreads.length, 2);

	const result = generateTheme(ir);
	assertWorkingTheme(result, ir);

	// Master-spread chrome produced a header or footer from the document.
	assert.equal(result.report.data.derivedFromMaster, true);
});

test('PDF fixture → valid FSE theme (fallback path, with fidelity warnings)', async () => {
	const ir = await parsePdfBuffer(buildBrochurePdf());
	assert.ok(ir.spreads.length >= 1);

	const result = generateTheme(ir);
	assertWorkingTheme(result, ir);

	// A PDF parse is lossy by definition — it always carries fidelity warnings.
	assert.ok((ir.warnings ?? []).length > 0, 'PDF parse should record fidelity warnings');
});

test('both input formats import the same brochure (source-agnostic)', async () => {
	const fromIdml = generateTheme(parseIdmlBuffer(buildBrochureIdml()));
	const fromPdf = generateTheme(await parsePdfBuffer(buildBrochurePdf()));

	// Same logical document → same spread/pattern count from either source.
	const patterns = (r) => r.files.filter((f) => /^patterns\/spread-\d+\.php$/.test(f.path)).length;
	assert.equal(patterns(fromIdml), patterns(fromPdf));
	assert.equal(patterns(fromIdml), 2);
});
