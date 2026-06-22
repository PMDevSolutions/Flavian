// Regression tests for issue #148 — bare "-" accepted as stdin sentinel.
//
// Each affected CLI entry point is invoked as a child process with "-" as the
// positional argument and a minimal IR JSON piped on stdin. The process must
// NOT exit 2 (unknown-argument error) and must not print "Unknown argument: -".
//
// Reference: the fix mirrors packages/pipeline/bin/ingest.mjs:53 which already
// handles "-" correctly and serves as the canonical pattern.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ingestBuffer, toArtifact } from '../../src/indesign/ingest/index.js';
import { buildIdml } from './helpers/build-idml.js';

const ROOT = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

// Build a minimal but valid IR JSON to pipe into each bin.
async function makeIrJson() {
	const bytes = buildIdml({
		name: 'Stdin Sentinel Test',
		colors: [],
		fonts: [{ id: 'f', family: 'Helvetica', style: 'Regular', postScriptName: 'Helvetica' }],
		styles: [{ id: 'h1', name: 'Heading 1', kind: 'paragraph', pointSize: 24, appliedFont: 'f' }],
		stories: [{ id: 's1', runs: [{ text: 'Hello', paragraphStyle: 'h1' }] }],
		spreads: [{
			id: 'sp1',
			pages: [{ id: 'p1', bounds: [0, 0, 792, 612] }],
			frames: [{ kind: 'text', id: 'tf1', bounds: [60, 60, 150, 540], parentStory: 's1' }],
		}],
	});
	const result = await ingestBuffer(bytes);
	return JSON.stringify(toArtifact(result));
}

// Spawn a bin with args, write stdin, collect exit code + output.
function run(binRelPath, args, stdinData) {
	return new Promise((resolve) => {
		const bin = path.join(ROOT, binRelPath);
		const child = spawn(process.execPath, [bin, ...args], {
			stdio: ['pipe', 'pipe', 'pipe'],
			cwd: ROOT,
		});
		if (stdinData) {
			child.stdin.write(stdinData);
		}
		child.stdin.end();
		const out = [];
		const err = [];
		child.stdout.on('data', (d) => out.push(d));
		child.stderr.on('data', (d) => err.push(d));
		child.on('close', (code) => resolve({
			code,
			stdout: Buffer.concat(out).toString(),
			stderr: Buffer.concat(err).toString(),
		}));
	});
}

// ── generate-theme ────────────────────────────────────────────────────────────

test('generate-theme: "-" is accepted as the stdin sentinel', async () => {
	const ir = await makeIrJson();
	const outDir = await mkdtemp(path.join(tmpdir(), 'flavian-gt-stdin-'));
	try {
		const { code, stderr } = await run(
			'packages/pipeline/bin/generate-theme.mjs',
			['-', '--out-dir', outDir, '--quiet'],
			ir,
		);
		assert.ok(
			!stderr.includes('Unknown argument: -'),
			`should not reject "-" — stderr: ${stderr}`,
		);
		assert.notEqual(code, 2, `exited 2 (argument error) — stderr: ${stderr}`);
	} finally {
		await rm(outDir, { recursive: true, force: true });
	}
});

test('generate-theme: omitting the positional still reads stdin (existing workaround)', async () => {
	const ir = await makeIrJson();
	const outDir = await mkdtemp(path.join(tmpdir(), 'flavian-gt-nostdin-'));
	try {
		const { code, stderr } = await run(
			'packages/pipeline/bin/generate-theme.mjs',
			['--out-dir', outDir, '--quiet'],
			ir,
		);
		assert.notEqual(code, 2, `exited 2 — stderr: ${stderr}`);
	} finally {
		await rm(outDir, { recursive: true, force: true });
	}
});

test('generate-theme: still rejects a genuinely unknown flag', async () => {
	const { code, stderr } = await run(
		'packages/pipeline/bin/generate-theme.mjs',
		['--unknown-flag', '--out-dir', '/tmp/x', '--quiet'],
		'',
	);
	assert.equal(code, 2, 'should exit 2 for an unknown flag');
	assert.ok(stderr.includes('Unknown argument: --unknown-flag'));
});

// ── map-tokens ────────────────────────────────────────────────────────────────

test('map-tokens: "-" is accepted as the stdin sentinel', async () => {
	const ir = await makeIrJson();
	const { code, stderr, stdout } = await run(
		'packages/pipeline/bin/map-tokens.mjs',
		['-', '--quiet'],
		ir,
	);
	assert.ok(
		!stderr.includes('Unknown argument: -'),
		`should not reject "-" — stderr: ${stderr}`,
	);
	assert.notEqual(code, 2, `exited 2 (argument error) — stderr: ${stderr}`);
	// stdout should be valid JSON (the theme.json partial)
	assert.doesNotThrow(
		() => JSON.parse(stdout),
		'stdout should be a valid JSON theme partial',
	);
});

test('map-tokens: omitting the positional still reads stdin (existing workaround)', async () => {
	const ir = await makeIrJson();
	const { code, stderr } = await run(
		'packages/pipeline/bin/map-tokens.mjs',
		['--quiet'],
		ir,
	);
	assert.notEqual(code, 2, `exited 2 — stderr: ${stderr}`);
});

test('map-tokens: still rejects a genuinely unknown flag', async () => {
	const { code, stderr } = await run(
		'packages/pipeline/bin/map-tokens.mjs',
		['--unknown-flag', '--quiet'],
		'',
	);
	assert.equal(code, 2, 'should exit 2 for an unknown flag');
	assert.ok(stderr.includes('Unknown argument: --unknown-flag'));
});

// ── flavian pipeline indesign ─────────────────────────────────────────────────

test('flavian pipeline indesign: "-" is accepted as the stdin sentinel', async () => {
	const ir = await makeIrJson();
	const outDir = await mkdtemp(path.join(tmpdir(), 'flavian-id-stdin-'));
	try {
		const { code, stderr } = await run(
			'bin/flavian.mjs',
			['pipeline', 'indesign', '-', '--output', outDir, '--quiet'],
			ir,
		);
		assert.ok(
			!stderr.includes('Unknown argument: -'),
			`should not reject "-" — stderr: ${stderr}`,
		);
		assert.notEqual(code, 2, `exited 2 (argument error) — stderr: ${stderr}`);
	} finally {
		await rm(outDir, { recursive: true, force: true });
	}
});

test('flavian pipeline indesign: still rejects a genuinely unknown flag', async () => {
	const { code, stderr } = await run(
		'bin/flavian.mjs',
		['pipeline', 'indesign', '--unknown-flag', '--quiet'],
		'',
	);
	assert.equal(code, 2, 'should exit 2 for an unknown flag');
	assert.ok(stderr.includes('Unknown argument: --unknown-flag'));
});
