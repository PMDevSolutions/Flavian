// Output generator: a validated InDesign IR (+ mapped design tokens) → a
// complete, installable Flavian-compatible FSE theme.
//
//   generateTheme(ir, options) → { slug, name, files, assets, themeJson, tokens, report }
//
//   files   [{ path, contents, mode? }] — every text artifact, theme-relative.
//   assets  planned image assets (bytes staged by the caller / CLI).
//   report  { markdown, data } — the generation report.
//
// Pure and deterministic: no fs, no clock, no randomness. The same IR yields
// byte-identical files every run, so reruns never churn unrelated artifacts.

import { mapTokens } from '../map/index.js';
import { themeSlug, themeName, themePackage, spreadPatternSlug } from './slugs.js';
import { planAssets, buildImportScript, buildSeedScript } from './media.js';
import { buildPatternFile } from './patterns.js';
import { buildParts } from './parts.js';
import { buildIndexTemplate, buildPageTemplate, buildNotFoundTemplate } from './templates.js';
import { buildStyleCss, buildFunctionsPhp } from './theme-files.js';
import { buildGenerationReport } from './report.js';

const REPORT_FILE = 'indesign-pipeline-report.md';

function indexBy(items, key) {
	const map = new Map();
	for (const item of items ?? []) map.set(item[key], item);
	return map;
}

/**
 * @typedef {Object} GenerateThemeOptions
 * @property {string} [slug]            Theme directory slug (default: from doc name).
 * @property {string} [name]            Human theme name (default: from doc name).
 * @property {string} [version]         style.css version (default '0.1.0').
 * @property {object} [tokens]          Precomputed mapTokens() result (skips re-mapping).
 * @property {boolean} [seedContent]    Also emit bin/seed-content.sh.
 * @property {object} [base]            Token mapper: base theme (object/path).
 * @property {object} [fontMap]         Token mapper: font map (object/path).
 * @property {string} [namespace]       Token mapper: derived-token prefix.
 * @property {number} [tolerance]       Token mapper: color tolerance.
 * @property {number} [tolerancePx]     Token mapper: typography tolerance.
 * @property {number} [gridPx]          Token mapper: spacing grid.
 * @property {boolean} [fluid]          Token mapper: fluid font sizes.
 *
 * @param {import('../ir.js').DocumentIR} ir
 * @param {GenerateThemeOptions} [options]
 */
export function generateTheme(ir, options = {}) {
	const tokens = options.tokens ?? mapTokens(ir, {
		base: options.base,
		fontMap: options.fontMap,
		namespace: options.namespace,
		tolerance: options.tolerance,
		tolerancePx: options.tolerancePx,
		gridPx: options.gridPx,
		fluid: options.fluid,
	});

	const slug = themeSlug(ir, options.slug);
	const name = themeName(ir, options.name);
	const pkg = themePackage(slug);
	const version = options.version ?? '0.1.0';

	const { assets, assetPathById } = planAssets(ir);

	const ctx = {
		storiesById: indexBy(ir.stories, 'id'),
		stylesById: indexBy(ir.styles, 'id'),
		styleToSlug: tokens.report?.provenance?.styleToSlug ?? {},
		swatchToSlug: tokens.report?.provenance?.swatchToSlug ?? {},
		fontToSlug: tokens.report?.provenance?.fontToSlug ?? {},
		assetPathById,
		unmapped: [],
	};

	// One pattern per spread.
	const spreads = ir.spreads ?? [];
	const patternMeta = [];
	const patternFiles = [];
	spreads.forEach((spread, index) => {
		const patternSlug = spreadPatternSlug(slug, index);
		const title = `${name} — Spread ${index + 1}`;
		patternMeta.push({ title, slug: patternSlug });
		patternFiles.push({
			path: `patterns/spread-${index + 1}.php`,
			contents: buildPatternFile({ spread, index, themePackage: pkg, title, patternSlug, ctx }),
		});
	});

	const parts = buildParts(ir, ctx);
	const description = `FSE theme generated from an InDesign document by @flavian/pipeline.`;

	/** @type {Array<{ path: string, contents: string, mode?: string }>} */
	const files = [
		{ path: 'style.css', contents: buildStyleCss({ name, slug, description, version }) },
		{ path: 'functions.php', contents: buildFunctionsPhp({ name, slug, themePackage: pkg }) },
		{ path: 'theme.json', contents: `${JSON.stringify(tokens.merged, null, 2)}\n` },
		{ path: 'templates/index.html', contents: buildIndexTemplate(patternMeta.map((p) => p.slug)) },
		{ path: 'templates/page.html', contents: buildPageTemplate() },
		{ path: 'templates/404.html', contents: buildNotFoundTemplate() },
		{ path: 'parts/header.html', contents: parts.header },
		{ path: 'parts/footer.html', contents: parts.footer },
		...patternFiles,
		{ path: 'bin/import-media.sh', contents: buildImportScript(), mode: '755' },
	];

	if (options.seedContent) {
		files.push({ path: 'bin/seed-content.sh', contents: buildSeedScript(patternMeta), mode: '755' });
	}

	const reportMarkdown = buildGenerationReport({
		themeName: name,
		themeSlug: slug,
		files: [...files.map((f) => f.path), REPORT_FILE],
		assets,
		unmapped: ctx.unmapped,
		tokensReport: tokens.report,
		derivedFromMaster: parts.derivedFromMaster,
		spreadCount: spreads.length,
		assetsStaged: false,
	});
	files.push({ path: REPORT_FILE, contents: `${reportMarkdown}\n` });

	return {
		slug,
		name,
		package: pkg,
		files,
		assets,
		themeJson: tokens.merged,
		tokens,
		report: {
			markdown: reportMarkdown,
			data: {
				unmapped: ctx.unmapped,
				patterns: patternMeta,
				assets,
				valid: tokens.report?.valid ?? true,
			},
		},
	};
}
