#!/usr/bin/env node
// CLI: generate a WordPress FSE theme from an InDesign IR (or .idml/.pdf).
//
//   flavian-generate-theme <ir.json | doc.idml | doc.pdf | -> --out-dir <dir> [options]
//
// Reads a validated IR JSON (from parse-idml / parse-pdf) on a path or stdin, or
// parses an .idml/.pdf directly, then writes a complete theme directory: theme.json,
// patterns (one per spread), templates, parts, style.css, functions.php, an asset
// import script, and a generation report.
//
// Options:
//   --out-dir <dir>      Theme output directory (required). Created if missing.
//   --slug <str>         Theme slug (default: derived from the document name).
//   --name <str>         Theme display name (default: derived from the document name).
//   --asset-dir <dir>    Source directory of image bytes to stage into assets/.
//   --seed-content       Also emit bin/seed-content.sh.
//   --base <path>        Base theme.json to merge against (default: flavian-shop).
//   --font-map <path>    Font map JSON (default: bundled config/font-map.json).
//   --namespace <str>    Derived-token slug prefix (default: id).
//   --grid <px>          Spacing quantization grid (default: 4).
//   --tolerance <n>      Color dedupe/reuse squared-distance tolerance.
//   --type-tolerance <px>  Typography size clustering tolerance (default: 1).
//   --dpi <n>            DPI when parsing .idml/.pdf directly (default: 96).
//   --fluid              Emit fluid clamp() font sizes.
//   --quiet              Suppress the stderr summary.
//   -h, --help           Show this help.

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { parseIdml } from '../src/indesign/parse-idml.js';
import { parsePdf } from '../src/indesign/parse-pdf.js';
import { generateTheme } from '../src/indesign/generate/index.js';

const args = process.argv.slice(2);
const opts = { seedContent: false, quiet: false };
let inputPath;

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
		case '--out-dir': opts.outDir = wantsValue(arg); i += 1; break;
		case '--slug': opts.slug = wantsValue(arg); i += 1; break;
		case '--name': opts.name = wantsValue(arg); i += 1; break;
		case '--asset-dir': opts.assetDir = wantsValue(arg); i += 1; break;
		case '--seed-content': opts.seedContent = true; break;
		case '--base': opts.base = wantsValue(arg); i += 1; break;
		case '--font-map': opts.fontMap = wantsValue(arg); i += 1; break;
		case '--namespace': opts.namespace = wantsValue(arg); i += 1; break;
		case '--grid': opts.gridPx = Number(wantsValue(arg)); i += 1; break;
		case '--tolerance': opts.tolerance = Number(wantsValue(arg)); i += 1; break;
		case '--type-tolerance': opts.tolerancePx = Number(wantsValue(arg)); i += 1; break;
		case '--dpi': opts.dpi = Number(wantsValue(arg)); i += 1; break;
		case '--fluid': opts.fluid = true; break;
		case '--quiet': opts.quiet = true; break;
		case '-h': case '--help': printUsage(); process.exit(0); break;
		default:
			if (!inputPath && !arg.startsWith('-')) {
				inputPath = arg;
			} else {
				process.stderr.write(`Unknown argument: ${arg}\n`);
				printUsage();
				process.exit(2);
			}
	}
}

if (!opts.outDir) {
	process.stderr.write('--out-dir is required\n');
	printUsage();
	process.exit(2);
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf8');
}

async function loadIr() {
	const dpiOpt = opts.dpi !== undefined ? { dpi: opts.dpi } : undefined;
	if (inputPath && /\.idml$/i.test(inputPath)) return parseIdml(inputPath, dpiOpt);
	if (inputPath && /\.pdf$/i.test(inputPath)) return parsePdf(inputPath, dpiOpt);
	const text = inputPath && inputPath !== '-' ? await fs.readFile(inputPath, 'utf8') : await readStdin();
	return JSON.parse(text);
}

/** Copy bytes for a planned asset from the source dir, matched by basename. */
async function stageAsset(asset, assetDir, outDir) {
	const candidates = [];
	if (asset.href) candidates.push(path.basename(asset.href.replace(/[?#].*$/, '')));
	candidates.push(asset.name);
	for (const candidate of candidates) {
		const src = path.join(assetDir, candidate);
		try {
			await fs.access(src);
			await fs.mkdir(path.join(outDir, 'assets'), { recursive: true });
			await fs.copyFile(src, path.join(outDir, asset.relPath));
			return true;
		} catch {
			// try next candidate
		}
	}
	return false;
}

try {
	const ir = await loadIr();
	const result = generateTheme(ir, {
		slug: opts.slug,
		name: opts.name,
		seedContent: opts.seedContent,
		base: opts.base,
		fontMap: opts.fontMap,
		namespace: opts.namespace,
		tolerance: opts.tolerance,
		tolerancePx: opts.tolerancePx,
		gridPx: opts.gridPx,
		fluid: opts.fluid,
	});

	const outDir = opts.outDir;
	await fs.mkdir(outDir, { recursive: true });

	// Write every text artifact, creating subdirectories as needed.
	for (const file of result.files) {
		const dest = path.join(outDir, file.path);
		await fs.mkdir(path.dirname(dest), { recursive: true });
		await fs.writeFile(dest, file.contents);
		if (file.mode) await fs.chmod(dest, Number.parseInt(file.mode, 8)).catch(() => {});
	}

	// Stage image bytes when a source directory was supplied.
	let staged = 0;
	if (opts.assetDir && result.assets.length) {
		for (const asset of result.assets) {
			if (await stageAsset(asset, opts.assetDir, outDir)) staged += 1;
		}
	}

	if (!opts.quiet) {
		const lines = [
			`theme: ${result.name} (${result.slug}) → ${outDir}`,
			`files: ${result.files.length}  patterns: ${result.report.data.patterns.length}  assets: ${result.assets.length} (staged ${staged})`,
			`theme.json valid: ${result.report.data.valid}`,
		];
		if (result.report.data.unmapped.length) lines.push(`unmapped IR nodes: ${result.report.data.unmapped.length}`);
		process.stderr.write(`${lines.join('\n')}\n`);
	}

	process.exit(result.report.data.valid ? 0 : 1);
} catch (err) {
	process.stderr.write(`error: ${err.message}\n`);
	process.exit(1);
}

function printUsage() {
	process.stderr.write(
		[
			'Usage: flavian-generate-theme <ir.json | doc.idml | doc.pdf | -> --out-dir <dir> [options]',
			'',
			'Options:',
			'  --out-dir <dir>        Theme output directory (required)',
			'  --slug <str>           Theme slug (default: from document name)',
			'  --name <str>           Theme display name (default: from document name)',
			'  --asset-dir <dir>      Source directory of image bytes to stage into assets/',
			'  --seed-content         Also emit bin/seed-content.sh',
			'  --base <path>          Base theme.json to merge against',
			'  --font-map <path>      Font map JSON (default: bundled config/font-map.json)',
			'  --namespace <str>      Derived-token slug prefix (default: id)',
			'  --grid <px>            Spacing quantization grid (default: 4)',
			'  --tolerance <n>        Color dedupe/reuse squared-distance tolerance',
			'  --type-tolerance <px>  Typography size clustering tolerance (default: 1)',
			'  --dpi <n>              DPI when parsing .idml/.pdf directly (default: 96)',
			'  --fluid                Emit fluid clamp() font sizes',
			'  --quiet                Suppress the stderr summary',
			'  -h, --help             Show this help',
			'',
		].join('\n'),
	);
}
