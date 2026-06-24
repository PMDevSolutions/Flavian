// Ingest stage: a source document (.idml/.pdf) → a generator-ready bundle on
// disk. It sits between parsing and generation and does the one thing neither
// end did before: resolve a document's *image bytes* (embedded in the IDML zip,
// or decoded out of a PDF) and stage them under the exact filenames the theme
// generator will reference.
//
//   Extract   parse the source to the IR; pull image bytes from the package.
//   Transform join image frames ↔ bytes by href; compute staged paths via the
//             generator's own planAssets() so the names line up byte-for-byte;
//             synthesise a manifest with provenance + unresolved warnings.
//   Load      write ir.json, assets/<staged files>, assets.manifest.json.
//
// The result is directly consumable downstream:
//   flavian pipeline indesign <bundle>/ir.json --asset-dir <bundle>/assets
//
// The pure pieces (resolveAssets, buildIngestBundle) take an href→bytes Map so
// they're source-agnostic and trivially testable; runIngest wires in the
// format-specific extraction.

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseIdmlBuffer } from '../parse-idml.js';
import { parsePdfBuffer } from '../parse-pdf.js';
import { extractIdmlAssets } from '../assets/idml-assets.js';
import { planAssets } from '../generate/media.js';

const INGEST_VERSION = 1;

/**
 * @typedef {Object} ResolvedAsset
 * @property {string} frameId
 * @property {string} [href]
 * @property {boolean} embedded
 * @property {string} name      Staged filename, e.g. "spread-1-image-1.jpg".
 * @property {string} relPath   Theme-relative path, e.g. "assets/spread-1-image-1.jpg".
 * @property {boolean} resolved
 * @property {Uint8Array} [bytes]  Present only when resolved.
 */

/**
 * Join the IR's planned image assets to source bytes from a resolver.
 *
 * planAssets() is the generator's own naming pass, so the staged filenames here
 * are byte-for-byte what generateTheme() will reference — which is what makes
 * the emitted bundle directly consumable downstream.
 *
 * @param {import('../ir.js').DocumentIR} ir
 * @param {Map<string, { bytes: Uint8Array, ext: string }>} [resolver]  href → bytes
 * @returns {{ assets: ResolvedAsset[], counts: { resolved: number, unresolved: number }, warnings: import('../ir.js').ParseWarningIR[] }}
 */
export function resolveAssets(ir, resolver = new Map()) {
	const { assets } = planAssets(ir);
	const warnings = [];
	let resolved = 0;

	const out = assets.map((a) => {
		const base = { frameId: a.frameId, href: a.href, embedded: a.embedded, name: a.name, relPath: a.relPath };
		const hit = a.href ? resolver.get(a.href) : undefined;
		if (hit) {
			resolved += 1;
			return { ...base, resolved: true, bytes: hit.bytes };
		}
		warnings.push({
			code: 'asset-unresolved',
			message: `Image frame ${a.frameId} (${a.href ?? 'no href'}) had no resolvable bytes; staged path ${a.relPath} reserved but no file written`,
			context: { id: a.frameId },
		});
		return { ...base, resolved: false };
	});

	return { assets: out, counts: { resolved, unresolved: out.length - resolved }, warnings };
}

/**
 * Build the in-memory ingest bundle: the validated IR, the resolved assets
 * (with bytes), and a JSON-serialisable manifest (provenance only, no bytes).
 *
 * @param {{ ir: import('../ir.js').DocumentIR, resolver?: Map<string, { bytes: Uint8Array, ext: string }>, format?: string }} input
 * @returns {{ ir: import('../ir.js').DocumentIR, assets: ResolvedAsset[], manifest: object }}
 */
export function buildIngestBundle({ ir, resolver = new Map(), format = 'unknown' }) {
	const { assets, counts, warnings } = resolveAssets(ir, resolver);

	const manifest = {
		ingestVersion: INGEST_VERSION,
		irVersion: ir.irVersion ?? 1,
		source: { format, name: ir.meta?.name },
		irPath: 'ir.json',
		assetDir: 'assets',
		counts: {
			spreads: (ir.spreads ?? []).length,
			imageFrames: assets.length,
			assetsResolved: counts.resolved,
			assetsUnresolved: counts.unresolved,
		},
		// Provenance only — raw bytes are staged as files, never inlined here.
		assets: assets.map(({ frameId, href, embedded, relPath, resolved }) => ({ frameId, href, embedded, relPath, resolved })),
		// IR parse warnings + asset-resolution warnings together, so the manifest
		// is the single place a caller has to look.
		warnings: [...(ir.warnings ?? []), ...warnings],
	};

	return { ir, assets, manifest };
}

/**
 * Persist a bundle to disk: ir.json, assets/<staged files>, assets.manifest.json.
 *
 * @param {{ ir: object, assets: ResolvedAsset[], manifest: object }} bundle
 * @param {string} outDir
 * @returns {Promise<{ dir: string, irPath: string, manifestPath: string, assetDir: string, assetsWritten: number }>}
 */
export async function writeIngestBundle(bundle, outDir) {
	await fs.mkdir(outDir, { recursive: true });

	const irPath = path.join(outDir, 'ir.json');
	await fs.writeFile(irPath, `${JSON.stringify(bundle.ir, null, 2)}\n`);

	let assetsWritten = 0;
	for (const asset of bundle.assets) {
		if (!asset.resolved || !asset.bytes) continue;
		const dest = path.join(outDir, asset.relPath);
		await fs.mkdir(path.dirname(dest), { recursive: true });
		await fs.writeFile(dest, asset.bytes);
		assetsWritten += 1;
	}

	const manifestPath = path.join(outDir, 'assets.manifest.json');
	await fs.writeFile(manifestPath, `${JSON.stringify(bundle.manifest, null, 2)}\n`);

	return { dir: outDir, irPath, manifestPath, assetDir: path.join(outDir, 'assets'), assetsWritten };
}

/**
 * Orchestrate a full ingest from a source file path to a bundle on disk.
 * Detects .idml/.pdf by extension; anything else is treated as pre-parsed IR JSON.
 *
 * @param {{ input: string, outDir: string, dpi?: number, name?: string }} opts
 * @returns {Promise<{ format: string, dir: string, irPath: string, manifestPath: string, assetDir: string, assetsWritten: number, counts: object, warnings: object[] }>}
 */
export async function runIngest({ input, outDir, dpi, name } = {}) {
	if (!input) throw new Error('runIngest: an input path is required');
	if (!outDir) throw new Error('runIngest: an outDir is required');

	const parseOpts = {};
	if (dpi !== undefined) parseOpts.dpi = dpi;
	if (name !== undefined) parseOpts.name = name;

	let ir;
	let resolver = new Map();
	let format;

	if (/\.idml$/i.test(input)) {
		format = 'idml';
		const bytes = await fs.readFile(input);
		ir = parseIdmlBuffer(bytes, parseOpts);
		resolver = extractIdmlAssets(bytes);
	} else if (/\.pdf$/i.test(input)) {
		format = 'pdf';
		const bytes = await fs.readFile(input);
		// parse-pdf only decodes image bytes when given a cache dir; round-trip
		// through a temp dir, then read them back keyed by the same href.
		const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flavian-ingest-pdf-'));
		try {
			ir = await parsePdfBuffer(bytes, { ...parseOpts, assetCacheDir: cacheDir });
			resolver = await resolverFromCacheDir(ir, cacheDir);
		} finally {
			await fs.rm(cacheDir, { recursive: true, force: true });
		}
	} else {
		format = 'ir';
		ir = JSON.parse(await fs.readFile(input, 'utf8'));
	}

	const bundle = buildIngestBundle({ ir, resolver, format });
	const written = await writeIngestBundle(bundle, outDir);

	return { format, ...written, counts: bundle.manifest.counts, warnings: bundle.manifest.warnings };
}

/**
 * Build an href→bytes resolver from a directory the parser persisted images
 * into. parse-pdf writes each image to <cacheDir>/<frame.href>, so we read them
 * back keyed by that same href.
 *
 * @param {import('../ir.js').DocumentIR} ir
 * @param {string} cacheDir
 * @returns {Promise<Map<string, { bytes: Uint8Array, ext: string }>>}
 */
async function resolverFromCacheDir(ir, cacheDir) {
	const map = new Map();
	for (const spread of ir.spreads ?? []) {
		for (const frame of spread.frames ?? []) {
			if (frame.kind !== 'image' || !frame.href) continue;
			try {
				const bytes = await fs.readFile(path.join(cacheDir, frame.href));
				const ext = (frame.href.split('.').pop() ?? 'png').toLowerCase();
				map.set(frame.href, { bytes: new Uint8Array(bytes), ext });
			} catch {
				// Not every image frame is persisted (e.g. decode failures); skip it
				// and let the frame fall through to 'unresolved'.
			}
		}
	}
	return map;
}
