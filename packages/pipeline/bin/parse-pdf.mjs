#!/usr/bin/env node
// CLI: print the reconstructed IR as JSON on stdout, fidelity warnings on stderr.
//
//   flavian-parse-pdf <path.pdf> [--dpi <n>] [--asset-dir <dir>] [--quiet]
//
// PDF is the fallback path. Expect fidelity warnings on every run — that's the
// parser telling you which parts are approximate.

import { parsePdf } from '../src/indesign/parse-pdf.js';

const args = process.argv.slice(2);
let inputPath;
let dpi;
let assetCacheDir;
let quiet = false;

for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];
	if (arg === '--dpi') {
		const next = args[i + 1];
		if (!next || Number.isNaN(Number(next))) {
			console.error('--dpi requires a positive number');
			process.exit(2);
		}
		dpi = Number(next);
		i += 1;
	} else if (arg === '--asset-dir') {
		const next = args[i + 1];
		if (!next) {
			console.error('--asset-dir requires a directory path');
			process.exit(2);
		}
		assetCacheDir = next;
		i += 1;
	} else if (arg === '--quiet') {
		quiet = true;
	} else if (arg === '-h' || arg === '--help') {
		printUsage();
		process.exit(0);
	} else if (!inputPath && !arg.startsWith('-')) {
		inputPath = arg;
	} else {
		console.error(`Unknown argument: ${arg}`);
		printUsage();
		process.exit(2);
	}
}

if (!inputPath) {
	printUsage();
	process.exit(2);
}

try {
	const options = {};
	if (dpi !== undefined) options.dpi = dpi;
	if (assetCacheDir !== undefined) options.assetCacheDir = assetCacheDir;
	const ir = await parsePdf(inputPath, options);
	if (!quiet && ir.warnings.length > 0) {
		for (const w of ir.warnings) {
			const where = w.context?.file ? ` (${w.context.file}${w.context.id ? `#${w.context.id}` : ''})` : '';
			process.stderr.write(`[${w.code}] ${w.message}${where}\n`);
		}
		process.stderr.write(`\n${ir.warnings.length} warning(s).\n`);
	}
	process.stdout.write(JSON.stringify(ir, null, 2) + '\n');
} catch (err) {
	process.stderr.write(`error: ${err.message}\n`);
	process.exit(1);
}

function printUsage() {
	process.stderr.write(
		[
			'Usage: flavian-parse-pdf <path.pdf> [options]',
			'',
			'Options:',
			'  --dpi <n>          Pixels per inch for unit normalization (default 96)',
			'  --asset-dir <dir>  Write extracted images (PNG) under this directory',
			'  --quiet            Suppress fidelity warnings on stderr',
			'  -h, --help         Show this help',
			'',
		].join('\n'),
	);
}
