#!/usr/bin/env node
// Flavian CLI — the first-class entry point for Flavian's conversion pipelines.
//
//   flavian pipeline indesign <input> [options]
//   flavian pipeline ingest   <input> --out-dir <dir> [options]
//
// Today it exposes the InDesign pipeline (#62–#65): parse an .idml/.pdf (or a
// pre-parsed IR JSON), map design tokens, and generate a complete FSE theme.
// More pipelines (figma, canva) can be added as sibling subcommands.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
// Dynamic import() needs a file:// URL string (Windows absolute paths aren't valid specifiers).
const PIPELINE = (p) => pathToFileURL(path.join(ROOT, 'packages/pipeline/src/indesign', p)).href;

const argv = process.argv.slice(2);

async function main() {
	const [group, command, ...rest] = argv;

	if (!group || group === '-h' || group === '--help' || group === 'help') {
		printRootUsage();
		process.exit(group ? 0 : 2);
	}

	if (group !== 'pipeline') {
		fail(`Unknown command: ${group}`);
		printRootUsage();
		process.exit(2);
	}

	if (!command || command === '-h' || command === '--help') {
		printPipelineUsage();
		process.exit(command ? 0 : 2);
	}

	if (command === 'indesign') {
		await runIndesign(rest);
		return;
	}

	if (command === 'ingest') {
		await runIngestCommand(rest);
		return;
	}

	fail(`Unknown pipeline: ${command}`);
	printPipelineUsage();
	process.exit(2);
}

async function runIndesign(args) {
	const opts = { seedContent: false, quiet: false };
	let input;

	let i = 0;
	const value = (flag) => {
		const next = args[i + 1];
		if (next === undefined || next.startsWith('-')) {
			fail(`${flag} requires a value`);
			process.exit(2);
		}
		i += 1;
		return next;
	};

	for (; i < args.length; i += 1) {
		const arg = args[i];
		switch (arg) {
			case '--output': case '-o': opts.output = value(arg); break;
			case '--config': opts.config = value(arg); break;
			case '--slug': opts.slug = value(arg); break;
			case '--name': opts.name = value(arg); break;
			case '--base': opts.base = value(arg); break;
			case '--namespace': opts.namespace = value(arg); break;
			case '--asset-dir': opts.assetDir = value(arg); break;
			case '--dpi': opts.dpi = Number(value(arg)); break;
			case '--seed-content': opts.seedContent = true; break;
			case '--no-seed-content': opts.seedContent = false; break;
			case '--fluid': opts.fluid = true; break;
			case '--quiet': case '-q': opts.quiet = true; break;
			case '-h': case '--help': printIndesignUsage(); process.exit(0); break;
			default:
				if (!input && !arg.startsWith('-')) input = arg;
				else { fail(`Unknown argument: ${arg}`); printIndesignUsage(); process.exit(2); }
		}
	}

	if (!input) {
		fail('an input is required (an .idml/.pdf file, an IR JSON, or - for stdin)');
		printIndesignUsage();
		process.exit(2);
	}

	// Lazy imports so `--help` never pays for loading the pipeline / ajv.
	const { parseIdml } = await import(PIPELINE('parse-idml.js'));
	const { parsePdf } = await import(PIPELINE('parse-pdf.js'));
	const { generateTheme } = await import(PIPELINE('generate/index.js'));

	const config = await loadConfig(opts.config);
	const cfg = config?.pipeline?.indesign ?? {};

	const ir = await loadIr(input, opts, parseIdml, parsePdf);

	const result = generateTheme(ir, {
		slug: opts.slug,
		name: opts.name,
		seedContent: opts.seedContent || Boolean(cfg.seedContent),
		base: opts.base ?? cfg.baseTheme,
		namespace: opts.namespace ?? cfg.namespace,
		fluid: opts.fluid,
	});

	const outDir = resolveOutDir(opts.output, cfg.output, result.slug);
	await writeTheme(result, outDir, opts.assetDir);

	if (!opts.quiet) {
		process.stderr.write(
			[
				`theme: ${result.name} (${result.slug}) → ${path.relative(process.cwd(), outDir) || '.'}`,
				`files: ${result.files.length}  patterns: ${result.report.data.patterns.length}  assets: ${result.assets.length}`,
				`theme.json valid: ${result.report.data.valid}`,
				`reports: indesign-pipeline-report.md, indesign-pipeline-report.json`,
				result.report.data.unmapped.length ? `unmapped IR nodes: ${result.report.data.unmapped.length}` : null,
			].filter(Boolean).join('\n') + '\n',
		);
	}

	process.exit(result.report.data.valid ? 0 : 1);
}

async function runIngestCommand(args) {
	const opts = { quiet: false };
	let input;

	let i = 0;
	const value = (flag) => {
		const next = args[i + 1];
		if (next === undefined || next.startsWith('-')) {
			fail(`${flag} requires a value`);
			process.exit(2);
		}
		i += 1;
		return next;
	};

	for (; i < args.length; i += 1) {
		const arg = args[i];
		switch (arg) {
			case '--out-dir': case '-o': opts.outDir = value(arg); break;
			case '--dpi': opts.dpi = Number(value(arg)); break;
			case '--name': opts.name = value(arg); break;
			case '--quiet': case '-q': opts.quiet = true; break;
			case '-h': case '--help': printIngestUsage(); process.exit(0); break;
			default:
				if (!input && !arg.startsWith('-')) input = arg;
				else { fail(`Unknown argument: ${arg}`); printIngestUsage(); process.exit(2); }
		}
	}

	if (!input) {
		fail('an input is required (an .idml/.pdf file or an IR JSON)');
		printIngestUsage();
		process.exit(2);
	}
	if (!opts.outDir) {
		fail('--out-dir is required');
		printIngestUsage();
		process.exit(2);
	}

	// Lazy import so `--help` never pays for loading the pipeline.
	const { runIngest } = await import(PIPELINE('ingest/index.js'));

	const summary = await runIngest({
		input,
		outDir: path.resolve(opts.outDir),
		dpi: opts.dpi,
		name: opts.name,
	});

	if (!opts.quiet) {
		const c = summary.counts;
		process.stderr.write(
			[
				`ingest: ${summary.format} → ${path.relative(process.cwd(), summary.dir) || '.'}`,
				`assets: ${c.assetsResolved}/${c.imageFrames} resolved (staged ${summary.assetsWritten})`,
				'bundle: ir.json, assets/, assets.manifest.json',
				summary.warnings.length ? `warnings: ${summary.warnings.length}` : null,
			].filter(Boolean).join('\n') + '\n',
		);
	}

	process.exit(0);
}

/** Resolve the theme output directory from --output, config.output, or default. */
function resolveOutDir(outputFlag, configOutput, slug) {
	if (outputFlag) return path.resolve(outputFlag);            // explicit theme dir
	if (configOutput) return path.resolve(configOutput, slug);  // parent dir + slug
	return path.resolve('themes', slug);                        // default
}

async function loadConfig(explicit) {
	const file = explicit ?? path.resolve('flavian.config.json');
	try {
		return JSON.parse(await fs.readFile(file, 'utf8'));
	} catch (err) {
		if (explicit) throw new Error(`could not read config ${file}: ${err.message}`);
		return null; // no default config present — fine
	}
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf8');
}

async function loadIr(input, opts, parseIdml, parsePdf) {
	const dpiOpt = opts.dpi !== undefined ? { dpi: opts.dpi } : undefined;
	if (/\.idml$/i.test(input)) return parseIdml(input, dpiOpt);
	if (/\.pdf$/i.test(input)) return parsePdf(input, dpiOpt);
	const text = input === '-' ? await readStdin() : await fs.readFile(input, 'utf8');
	return JSON.parse(text);
}

async function writeTheme(result, outDir, assetDir) {
	await fs.mkdir(outDir, { recursive: true });
	for (const f of result.files) {
		const dest = path.join(outDir, f.path);
		await fs.mkdir(path.dirname(dest), { recursive: true });
		await fs.writeFile(dest, f.contents);
		if (f.mode) await fs.chmod(dest, Number.parseInt(f.mode, 8)).catch(() => {});
	}
	if (assetDir && result.assets.length) {
		for (const asset of result.assets) {
			const candidates = [asset.href ? path.basename(asset.href.replace(/[?#].*$/, '')) : null, asset.name].filter(Boolean);
			for (const candidate of candidates) {
				const src = path.join(assetDir, candidate);
				try {
					await fs.access(src);
					await fs.mkdir(path.join(outDir, 'assets'), { recursive: true });
					await fs.copyFile(src, path.join(outDir, asset.relPath));
					break;
				} catch { /* try next candidate */ }
			}
		}
	}
}

function fail(msg) {
	process.stderr.write(`error: ${msg}\n`);
}

function printRootUsage() {
	process.stderr.write(
		[
			'Flavian — Claude Code-powered design-to-WordPress pipelines.',
			'',
			'Usage: flavian <command> [options]',
			'',
			'Commands:',
			'  pipeline indesign <input>   Convert an InDesign document to a WordPress FSE theme',
			'  pipeline ingest <input>     Stage an InDesign source as a generator-ready bundle',
			'',
			'Run `flavian pipeline indesign --help` for pipeline options.',
			'',
		].join('\n'),
	);
}

function printPipelineUsage() {
	process.stderr.write(
		[
			'Usage: flavian pipeline <name> [options]',
			'',
			'Pipelines:',
			'  indesign <input>   Convert an .idml/.pdf (or IR JSON) to an FSE theme',
			'  ingest <input>     Stage a source as a generator-ready bundle (ir.json + assets/)',
			'',
			'Run `flavian pipeline <name> --help` for options.',
			'',
		].join('\n'),
	);
}

function printIndesignUsage() {
	process.stderr.write(
		[
			'Usage: flavian pipeline indesign <input> [options]',
			'',
			'Convert an InDesign document into a complete WordPress FSE theme: block',
			'patterns (one per spread), templates, parts, a merged theme.json, asset',
			'import scripts, and a generation report (Markdown + JSON).',
			'',
			'Arguments:',
			'  <input>                An .idml or .pdf file, a pre-parsed IR JSON, or - for stdin',
			'',
			'Options:',
			'  -o, --output <dir>     Theme output directory (default: themes/<slug>,',
			'                         or <config.output>/<slug> when configured)',
			'      --config <path>    Flavian config (default: ./flavian.config.json if present)',
			'      --slug <str>       Theme slug (default: from the document name)',
			'      --name <str>       Theme display name (default: from the document name)',
			'      --base <path>      Base theme.json to merge against (default: flavian-shop)',
			'      --namespace <str>  Derived-token slug prefix (default: id)',
			'      --asset-dir <dir>  Source of image bytes to stage into assets/',
			'      --dpi <n>          DPI when parsing .idml/.pdf directly (default: 96)',
			'      --seed-content     Also emit bin/seed-content.sh',
			'      --fluid            Emit fluid clamp() font sizes',
			'  -q, --quiet            Suppress the stderr summary',
			'  -h, --help             Show this help',
			'',
			'Config (flavian.config.json):',
			'  { "pipeline": { "indesign": { "output", "baseTheme", "namespace", "seedContent" } } }',
			'  CLI flags override config values. See flavian.config.example.json.',
			'',
			'Examples:',
			'  flavian pipeline indesign brochure.idml',
			'  flavian pipeline indesign brochure.pdf --output themes/brochure --seed-content',
			'  flavian pipeline indesign - < ir.json --slug my-theme',
			'',
		].join('\n'),
	);
}

function printIngestUsage() {
	process.stderr.write(
		[
			'Usage: flavian pipeline ingest <input> --out-dir <dir> [options]',
			'',
			'Extract an InDesign source into a generator-ready bundle: ir.json (the',
			'intermediate IR the generator consumes), assets/ (image bytes pulled from the',
			'source, named to match the generator), and assets.manifest.json.',
			'',
			'The bundle feeds straight into generation:',
			'  flavian pipeline indesign <dir>/ir.json --asset-dir <dir>/assets',
			'',
			'Arguments:',
			'  <input>                An .idml or .pdf file (or a pre-parsed IR JSON)',
			'',
			'Options:',
			'  -o, --out-dir <dir>    Bundle output directory (required)',
			'      --dpi <n>          DPI when parsing .idml/.pdf (default 96)',
			'      --name <str>       Override the document name',
			'  -q, --quiet            Suppress the stderr summary',
			'  -h, --help             Show this help',
			'',
		].join('\n'),
	);
}

main().catch((err) => {
	fail(err.message);
	process.exit(1);
});
