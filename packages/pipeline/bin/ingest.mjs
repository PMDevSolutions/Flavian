#!/usr/bin/env node
// CLI: ingest an InDesign source into a generator-ready bundle on disk.
//
//   flavian-ingest <source.idml | doc.pdf | ir.json> --out-dir <dir> [options]
//
// Parses the source to the IR, extracts its image bytes (embedded in the IDML
// zip, or decoded from the PDF), and writes a bundle the theme generator can
// consume directly: ir.json, assets/<staged files>, assets.manifest.json. Then:
//
//   flavian-generate-theme <dir>/ir.json --asset-dir <dir>/assets --out-dir theme
//
// Options:
//   -o, --out-dir <dir>   Bundle output directory (required). Created if missing.
//       --dpi <n>         DPI for unit normalization when parsing (default 96).
//       --name <str>      Override the document name.
//   -q, --quiet           Suppress the stderr summary.
//   -h, --help            Show this help.

import { runIngest } from '../src/indesign/ingest/index.js';

const args = process.argv.slice(2);
const opts = { quiet: false };
let input;

let i = 0;
function wantsValue(flag) {
	const next = args[i + 1];
	if (next === undefined || next.startsWith('-')) {
		process.stderr.write(`${flag} requires a value\n`);
		process.exit(2);
	}
	return next;
}

for (; i < args.length; i += 1) {
	const arg = args[i];
	switch (arg) {
		case '--out-dir': case '-o': opts.outDir = wantsValue(arg); i += 1; break;
		case '--dpi': opts.dpi = Number(wantsValue(arg)); i += 1; break;
		case '--name': opts.name = wantsValue(arg); i += 1; break;
		case '--quiet': case '-q': opts.quiet = true; break;
		case '-h': case '--help': printUsage(); process.exit(0); break;
		default:
			if (!input && !arg.startsWith('-')) input = arg;
			else { process.stderr.write(`Unknown argument: ${arg}\n`); printUsage(); process.exit(2); }
	}
}

if (!input) {
	process.stderr.write('an input is required (an .idml/.pdf file or an IR JSON)\n');
	printUsage();
	process.exit(2);
}
if (!opts.outDir) {
	process.stderr.write('--out-dir is required\n');
	printUsage();
	process.exit(2);
}

try {
	const summary = await runIngest({ input, outDir: opts.outDir, dpi: opts.dpi, name: opts.name });
	if (!opts.quiet) {
		const c = summary.counts;
		process.stderr.write(
			[
				`ingest: ${summary.format} → ${opts.outDir}`,
				`assets: ${c.assetsResolved}/${c.imageFrames} resolved (staged ${summary.assetsWritten})`,
				`bundle: ir.json, assets/, assets.manifest.json`,
				summary.warnings.length ? `warnings: ${summary.warnings.length}` : null,
			]
				.filter(Boolean)
				.join('\n') + '\n',
		);
	}
	process.exit(0);
} catch (err) {
	process.stderr.write(`error: ${err.message}\n`);
	process.exit(1);
}

function printUsage() {
	process.stderr.write(
		[
			'Usage: flavian-ingest <source.idml | doc.pdf | ir.json> --out-dir <dir> [options]',
			'',
			'Options:',
			'  -o, --out-dir <dir>   Bundle output directory (required)',
			'      --dpi <n>         DPI for unit normalization when parsing (default 96)',
			'      --name <str>      Override the document name',
			'  -q, --quiet           Suppress the stderr summary',
			'  -h, --help            Show this help',
			'',
		].join('\n'),
	);
}
