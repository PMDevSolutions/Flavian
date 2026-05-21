#!/usr/bin/env node
// CLI: print the parsed IR as JSON on stdout, warnings on stderr.
//
//   flavian-parse-idml <path-to.idml> [--dpi <n>] [--quiet]

import { parseIdml } from '../src/indesign/parse-idml.js';

const args = process.argv.slice(2);
let inputPath;
let dpi;
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
	const ir = await parseIdml(inputPath, dpi !== undefined ? { dpi } : undefined);
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
			'Usage: flavian-parse-idml <path.idml> [options]',
			'',
			'Options:',
			'  --dpi <n>   Pixels per inch for unit normalization (default 96)',
			'  --quiet     Suppress warnings on stderr',
			'  -h, --help  Show this help',
			'',
		].join('\n'),
	);
}
