#!/usr/bin/env node
// CLI: ingest a source asset (IDML or PDF), auto-detecting the format, and write
// the canonical IR — enriched with a derived content model — as JSON.
//
//   flavian-ingest <source.idml | source.pdf | -> [options]
//
// Reads a file path or stdin (binary-safe), writes the artifact to --out (or
// stdout), and prints a one-line summary plus parse warnings to stderr. The
// artifact is a valid IR that flavian-map-tokens / flavian-generate-theme accept
// directly.
//
// Options:
//   --out <file>     Write the artifact here (default: stdout)
//   --format <fmt>   idml | pdf | auto (default: auto — sniff the bytes)
//   --dpi <n>        Unit-normalization DPI (default 96)
//   --name <str>     Override the document name
//   --no-content     Emit the bare IR without the content model
//   --quiet          Suppress the stderr summary and parse warnings
//   -h, --help       Show this help

import { promises as fs } from 'node:fs';

import { ingestBuffer, toArtifact } from '../src/indesign/ingest/index.js';

const args = process.argv.slice(2);
const opts = { format: 'auto', content: true, quiet: false };
let inputPath;

let i = 0;
function wantsValue(flag) {
	const next = args[i + 1];
	if (next === undefined || next.startsWith('-')) {
		process.stderr.write(`${flag} requires a value\n`);
		process.exit(2);
	}
	i += 1;
	return next;
}

for (; i < args.length; i += 1) {
	const arg = args[i];
	switch (arg) {
		case '--out': opts.out = wantsValue(arg); break;
		case '--format': opts.format = wantsValue(arg); break;
		case '--dpi': opts.dpi = Number(wantsValue(arg)); break;
		case '--name': opts.name = wantsValue(arg); break;
		case '--no-content': opts.content = false; break;
		case '--quiet': opts.quiet = true; break;
		case '-h': case '--help': printUsage(); process.exit(0); break;
		default:
			// A bare "-" is the explicit stdin sentinel; any other dash-prefixed
			// token is an unknown flag.
			if (!inputPath && (arg === '-' || !arg.startsWith('-'))) {
				inputPath = arg;
			} else {
				process.stderr.write(`Unknown argument: ${arg}\n`);
				printUsage();
				process.exit(2);
			}
	}
}

if (!['auto', 'idml', 'pdf'].includes(opts.format)) {
	process.stderr.write('--format must be one of: auto, idml, pdf\n');
	process.exit(2);
}
if (opts.dpi !== undefined && (Number.isNaN(opts.dpi) || opts.dpi <= 0)) {
	process.stderr.write('--dpi must be a positive number\n');
	process.exit(2);
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks);
}

try {
	const bytes = inputPath && inputPath !== '-' ? await fs.readFile(inputPath) : await readStdin();
	if (bytes.length === 0) {
		process.stderr.write('error: empty input\n');
		process.exit(1);
	}

	const result = await ingestBuffer(bytes, {
		format: opts.format,
		dpi: opts.dpi,
		name: opts.name,
		content: opts.content,
	});

	const json = `${JSON.stringify(toArtifact(result), null, 2)}\n`;
	if (opts.out) await fs.writeFile(opts.out, json);
	else process.stdout.write(json);

	if (!opts.quiet) {
		const { ir, content } = result;
		const warnings = ir.warnings ?? [];
		for (const w of warnings) process.stderr.write(`[${w.code}] ${w.message}\n`);
		const lines = [`format: ${result.format}  spreads: ${ir.spreads.length}  warnings: ${warnings.length}`];
		if (content) {
			const s = content.stats;
			lines.push(`content: ${s.sections} sections, ${s.headings} headings, ${s.paragraphs} paragraphs, ${s.figures} figures`);
		}
		lines.push(`written: ${opts.out ?? '<stdout>'}`);
		process.stderr.write(`${lines.join('\n')}\n`);
	}

	process.exit(0);
} catch (err) {
	process.stderr.write(`error: ${err.message}\n`);
	process.exit(1);
}

function printUsage() {
	process.stderr.write(
		[
			'Usage: flavian-ingest <source.idml | source.pdf | -> [options]',
			'',
			'Options:',
			'  --out <file>     Write the artifact here (default: stdout)',
			'  --format <fmt>   idml | pdf | auto (default: auto — sniff the bytes)',
			'  --dpi <n>        Unit-normalization DPI (default 96)',
			'  --name <str>     Override the document name',
			'  --no-content     Emit the bare IR without the content model',
			'  --quiet          Suppress the stderr summary and parse warnings',
			'  -h, --help       Show this help',
			'',
		].join('\n'),
	);
}
