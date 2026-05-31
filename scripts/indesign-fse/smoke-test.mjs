#!/usr/bin/env node
// End-to-end smoke test for the InDesign pipeline.
//
// Mirrors what the indesign-to-wordpress agent does: build a fixture document,
// run it through the real `flavian pipeline indesign` CLI, and assert the
// generated theme is valid. Fixtures are code (not committed binaries), so this
// builds a representative two-spread brochure .idml in a temp dir first.
//
//   node scripts/indesign-fse/smoke-test.mjs
//
// Exits 0 on success, non-zero with a diagnostic on any failure. Used by the
// Pipeline Tests CI workflow and runnable locally.

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildIdml } from '../../packages/pipeline/tests/indesign/helpers/build-idml.js';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

function fail(msg) {
	process.stderr.write(`✗ smoke: ${msg}\n`);
	process.exit(1);
}

/** A representative two-spread brochure: text-heavy spread + image-heavy spread. */
function brochureIdml() {
	return buildIdml({
		name: 'Smoke Brochure',
		colors: [
			{ id: 'col-brand', name: 'Brand Blue', space: 'RGB', values: [0, 102, 204] },
			{ id: 'col-ink', name: 'Ink', space: 'CMYK', values: [0, 0, 0, 100] },
		],
		fonts: [{ id: 'f-helv', family: 'Helvetica', style: 'Bold', postScriptName: 'Helvetica-Bold' }],
		styles: [
			{ id: 'p-h1', name: 'Heading 1', kind: 'paragraph', pointSize: 36, leading: 40, appliedFont: 'f-helv', fillColor: 'col-brand' },
			{ id: 'p-body', name: 'Body', kind: 'paragraph', pointSize: 12, leading: 18, fillColor: 'col-ink' },
		],
		stories: [
			{ id: 's-title', runs: [{ text: 'Welcome', paragraphStyle: 'p-h1' }] },
			{ id: 's-body', runs: [{ text: 'Body copy that introduces the brochure.', paragraphStyle: 'p-body' }] },
			{ id: 's-hero', runs: [{ text: 'On Sale Now', paragraphStyle: 'p-h1' }] },
		],
		spreads: [
			{
				id: 'spread-1',
				pages: [{ id: 'page-1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'tf-title', bounds: [60, 60, 140, 540], parentStory: 's-title' },
					{ kind: 'text', id: 'tf-body', bounds: [160, 60, 420, 540], parentStory: 's-body' },
				],
			},
			{
				id: 'spread-2',
				pages: [{ id: 'page-2', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'image', id: 'if-hero', bounds: [0, 0, 612, 792], href: 'file:Links/hero.png' },
					{ kind: 'text', id: 'if-overlay', bounds: [200, 100, 320, 500], parentStory: 's-hero' },
				],
			},
		],
	});
}

async function main() {
	const work = await fs.mkdtemp(path.join(os.tmpdir(), 'flavian-indesign-smoke-'));
	const idmlPath = path.join(work, 'brochure.idml');
	const themeDir = path.join(work, 'theme');

	try {
		await fs.writeFile(idmlPath, brochureIdml());

		// Run the real CLI exactly as a developer (or the agent) would.
		const run = spawnSync(
			process.execPath,
			[path.join(ROOT, 'bin/flavian.mjs'), 'pipeline', 'indesign', idmlPath, '--output', themeDir, '--quiet'],
			{ cwd: ROOT, encoding: 'utf8' },
		);

		if (run.status !== 0) {
			fail(`CLI exited ${run.status}\n${run.stderr || run.stdout}`);
		}

		// The generated theme must carry the files a block theme needs to load.
		for (const rel of ['style.css', 'functions.php', 'theme.json', 'templates/index.html', 'parts/header.html', 'parts/footer.html', 'indesign-pipeline-report.md', 'indesign-pipeline-report.json']) {
			try {
				await fs.access(path.join(themeDir, rel));
			} catch {
				fail(`missing generated file: ${rel}`);
			}
		}

		// theme.json must parse and be version 3.
		const themeJson = JSON.parse(await fs.readFile(path.join(themeDir, 'theme.json'), 'utf8'));
		if (themeJson.version !== 3) fail(`theme.json version is ${themeJson.version}, expected 3`);

		// The machine-readable report must mark the theme valid with one pattern per spread.
		const report = JSON.parse(await fs.readFile(path.join(themeDir, 'indesign-pipeline-report.json'), 'utf8'));
		if (report.valid !== true) fail(`report.valid is ${report.valid}\n${JSON.stringify(report.tokens?.validationErrors ?? [], null, 2)}`);
		if (report.patterns.length !== 2) fail(`expected 2 patterns, got ${report.patterns.length}`);

		// At least one pattern is filed under the InDesign Imports category.
		const pattern = await fs.readFile(path.join(themeDir, 'patterns', 'spread-1.php'), 'utf8');
		if (!/Categories:\s*indesign-imports/.test(pattern)) fail('pattern is not in the indesign-imports category');

		process.stdout.write('✓ smoke: InDesign pipeline generated a valid theme (2 spreads, theme.json v3)\n');
	} finally {
		await fs.rm(work, { recursive: true, force: true });
	}
}

main().catch((err) => fail(err.stack || err.message));
