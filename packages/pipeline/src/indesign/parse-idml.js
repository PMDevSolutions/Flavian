// Main entry: takes a path to an IDML file (or its raw bytes) and returns the
// validated IR. Orchestrates the per-XML-file parsers, runs the cross-ref
// resolution pass, and validates the final shape with zod.
//
// Failure mode philosophy: we throw on structural problems that make the IR
// meaningless (missing designmap.xml, malformed zip). Anything we can recover
// from — dangling references, unknown swatch color spaces, empty stories —
// goes into the warnings collector instead.

import { promises as fs } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

import { Document } from './ir.js';
import { WarningCollector } from './warnings.js';
import { parseDesignMap } from './parsers/designmap.js';
import { parseGraphic, parseFonts, parseStyles } from './parsers/resources.js';
import { parseStory } from './parsers/stories.js';
import { parseSpread, parseMasterSpread } from './parsers/spreads.js';

const DEFAULT_DPI = 96;

/**
 * @typedef {Object} ParseOptions
 * @property {number} [dpi]   Pixels-per-inch for unit normalization. Default 96.
 * @property {string} [name]  Override the document name (defaults to designmap.xml's @Name or the file basename).
 */

/**
 * Parse an IDML file from disk.
 *
 * @param {string} path
 * @param {ParseOptions} [options]
 * @returns {Promise<import('./ir.js').DocumentIR>}
 */
export async function parseIdml(path, options = {}) {
	const bytes = await fs.readFile(path);
	const fallbackName = path.split(/[\\/]/).pop()?.replace(/\.idml$/i, '');
	return parseIdmlBuffer(bytes, { ...options, name: options.name ?? fallbackName });
}

/**
 * Parse IDML bytes already in memory — used by tests and any consumer that
 * already has the package as a buffer (e.g. from an HTTP upload).
 *
 * @param {Uint8Array} bytes
 * @param {ParseOptions} [options]
 * @returns {import('./ir.js').DocumentIR}
 */
export function parseIdmlBuffer(bytes, options = {}) {
	const dpi = options.dpi ?? DEFAULT_DPI;
	const warnings = new WarningCollector();

	let entries;
	try {
		entries = unzipSync(bytes);
	} catch (err) {
		throw new Error(`IDML package is not a valid zip: ${err.message}`);
	}

	const get = (path) => {
		const buf = entries[path];
		if (!buf) return undefined;
		return strFromU8(buf);
	};

	const designMapXml = get('designmap.xml');
	if (!designMapXml) {
		throw new Error('IDML package is missing designmap.xml');
	}
	const designMap = parseDesignMap(designMapXml);

	// Resources are nominally optional — they're usually present, but a tiny
	// or hand-crafted IDML might omit one. Either case (designmap doesn't
	// declare the file, or declares it but the file isn't in the zip) fires
	// the same warning code so consumers don't have to distinguish.
	const swatches = readOptionalResource(
		designMap.graphicSrc, get, 'missing-graphic', 'Resources/Graphic.xml',
		(xml) => parseGraphic(xml, warnings),
		warnings,
	);
	const fonts = readOptionalResource(
		designMap.fontsSrc, get, 'missing-fonts', 'Resources/Fonts.xml',
		(xml) => parseFonts(xml),
		warnings,
	);
	const styles = readOptionalResource(
		designMap.stylesSrc, get, 'missing-styles', 'Resources/Styles.xml',
		(xml) => parseStyles(xml, dpi),
		warnings,
	);

	const stories = [];
	for (const src of designMap.storySrcs) {
		const xml = get(src);
		if (!xml) {
			warnings.add('missing-story', `Story file referenced but not in package: ${src}`, { file: src });
			continue;
		}
		try {
			stories.push(...parseStory(xml, src));
		} catch (err) {
			warnings.add('story-parse-error', `${src}: ${err.message}`, { file: src });
		}
	}

	const spreads = [];
	for (const src of designMap.spreadSrcs) {
		const xml = get(src);
		if (!xml) {
			warnings.add('missing-spread', `Spread file referenced but not in package: ${src}`, { file: src });
			continue;
		}
		try {
			const s = parseSpread(xml, src, dpi);
			spreads.push({ ...s, source: src });
		} catch (err) {
			warnings.add('spread-parse-error', `${src}: ${err.message}`, { file: src });
		}
	}

	const masterSpreads = [];
	for (const src of designMap.masterSpreadSrcs) {
		const xml = get(src);
		if (!xml) {
			warnings.add('missing-master', `MasterSpread file referenced but not in package: ${src}`, { file: src });
			continue;
		}
		try {
			masterSpreads.push(parseMasterSpread(xml, src, dpi));
		} catch (err) {
			warnings.add('master-parse-error', `${src}: ${err.message}`, { file: src });
		}
	}

	resolveCrossReferences({ stories, spreads, masterSpreads, styles, swatches, fonts }, warnings);

	const document = Document.parse({
		irVersion: 1,
		meta: {
			idmlVersion: designMap.idmlVersion,
			name: designMap.name ?? options.name,
		},
		dpi,
		swatches,
		fonts,
		styles,
		stories,
		spreads,
		masterSpreads,
		warnings: warnings.list(),
	});

	return document;
}

/**
 * @template T
 * @param {string|undefined} src
 * @param {(path: string) => string|undefined} get
 * @param {string} code
 * @param {string} defaultPath
 * @param {(xml: string) => T[]} parse
 * @param {WarningCollector} warnings
 * @returns {T[]}
 */
function readOptionalResource(src, get, code, defaultPath, parse, warnings) {
	if (!src) {
		warnings.add(code, `designmap omits ${defaultPath}`);
		return [];
	}
	const xml = get(src);
	if (!xml) {
		warnings.add(code, `${src} referenced by designmap but missing from package`, { file: src });
		return [];
	}
	return parse(xml);
}

/**
 * Walk frames + style references and warn about anything pointing at an id
 * that didn't come back from the parsers. Doesn't drop the reference — the
 * mapper might still recognise the well-known IDML defaults (e.g. "n" for
 * "none").
 *
 * @param {{stories: import('./ir.js').StoryIR[], spreads: import('./ir.js').SpreadIR[], masterSpreads: import('./ir.js').MasterSpreadIR[], styles: import('./ir.js').StyleIR[], swatches: import('./ir.js').SwatchIR[], fonts: import('./ir.js').FontIR[]}} data
 * @param {WarningCollector} warnings
 */
function resolveCrossReferences(data, warnings) {
	const storyIds = new Set(data.stories.map((s) => s.id));
	const styleIds = new Set(data.styles.map((s) => s.id));
	const swatchIds = new Set(data.swatches.map((s) => s.id));
	const fontIds = new Set(data.fonts.map((f) => f.id));

	for (const spread of [...data.spreads, ...data.masterSpreads]) {
		for (const frame of spread.frames) {
			if (frame.kind === 'text' && frame.storyRef && !storyIds.has(frame.storyRef)) {
				warnings.add(
					'missing-story-ref',
					`TextFrame ${frame.id} references unknown story ${frame.storyRef}`,
					{ file: spread.source, id: frame.id },
				);
			}
		}
	}

	for (const story of data.stories) {
		for (const run of story.runs) {
			if (run.paragraphStyleRef && !styleIds.has(run.paragraphStyleRef) && !isWellKnown(run.paragraphStyleRef)) {
				warnings.add(
					'missing-paragraph-style-ref',
					`Story ${story.id} references unknown paragraph style ${run.paragraphStyleRef}`,
					{ file: story.source, id: story.id },
				);
			}
			if (run.characterStyleRef && !styleIds.has(run.characterStyleRef) && !isWellKnown(run.characterStyleRef)) {
				warnings.add(
					'missing-character-style-ref',
					`Story ${story.id} references unknown character style ${run.characterStyleRef}`,
					{ file: story.source, id: story.id },
				);
			}
		}
	}

	for (const style of data.styles) {
		if (style.fillColorRef && !swatchIds.has(style.fillColorRef) && !isWellKnown(style.fillColorRef)) {
			warnings.add(
				'missing-swatch-ref',
				`Style ${style.id} references unknown swatch ${style.fillColorRef}`,
				{ id: style.id },
			);
		}
		if (style.fontRef && !fontIds.has(style.fontRef) && !isWellKnown(style.fontRef)) {
			warnings.add(
				'missing-font-ref',
				`Style ${style.id} references unknown font ${style.fontRef}`,
				{ id: style.id },
			);
		}
	}
}

function isWellKnown(ref) {
	// IDML uses "n" for "none" and several "[No paragraph style]" / "$ID" tokens
	// that are valid references to built-ins rather than missing.
	if (ref === 'n') return true;
	if (ref.startsWith('$ID/')) return true;
	if (ref.includes('[No ')) return true;
	return false;
}
