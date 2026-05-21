// Resources/Graphic.xml — swatches and colors
// Resources/Fonts.xml    — font families
// Resources/Styles.xml   — paragraph + character styles
//
// Each is a separate parse so callers can short-circuit if any file is
// missing (warn + continue, don't abort).

import { parseXml, asArray } from './xml.js';
import { lengthToPx, roundPx } from '../units.js';

/**
 * @param {string|Uint8Array} input
 * @param {import('../warnings.js').WarningCollector} warnings
 * @returns {Array<import('../ir.js').SwatchIR>}
 */
export function parseGraphic(input, warnings) {
	const tree = parseXml(input);
	const root = tree?.['idPkg:Graphic'] ?? tree;

	/** @type {Array<import('../ir.js').SwatchIR>} */
	const swatches = [];

	for (const color of asArray(root?.['Color'])) {
		const id = color?.['@Self'];
		if (!id) continue;
		const name = color?.['@Name'] ?? id;
		const spaceRaw = String(color?.['@Space'] ?? 'Unknown');
		const values = String(color?.['@ColorValue'] ?? '').trim().split(/\s+/).map(Number);
		swatches.push({
			id,
			name,
			color: toIrColor(spaceRaw, values, warnings, id),
		});
	}

	// IDML also wraps colors in <Swatch> elements that point at the color by id.
	// For the IR we only emit one swatch per *named* entry; the redirection
	// happens in the mapper.
	return swatches;
}

/**
 * @param {string} spaceRaw
 * @param {number[]} values
 * @param {import('../warnings.js').WarningCollector} warnings
 * @param {string} id
 * @returns {import('../ir.js').SwatchIR['color']}
 */
function toIrColor(spaceRaw, values, warnings, id) {
	const space = normalizeColorSpace(spaceRaw);
	if (space === 'RGB' && values.length === 3) {
		return { hex: rgbToHex(values), space };
	}
	if (space === 'CMYK' && values.length === 4) {
		return { hex: cmykToHexApprox(values), space };
	}
	warnings.add(
		'color-fallback',
		`Swatch ${id} has unsupported color space "${spaceRaw}" with ${values.length} values; defaulted to black`,
		{ file: 'Resources/Graphic.xml', id },
	);
	return { hex: '#000000', space: 'Unknown' };
}

function normalizeColorSpace(raw) {
	const v = raw.trim();
	if (v === 'RGB' || v === 'CMYK' || v === 'LAB' || v === 'Spot') return v;
	return 'Unknown';
}

function rgbToHex([r, g, b]) {
	// IDML RGB is in 0-255 already.
	return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

function cmykToHexApprox([c, m, y, k]) {
	// IDML CMYK is in 0-100. Naive conversion; a real ICC profile pass is
	// the mapper's job. This is enough to produce a recognisable preview.
	const cv = c / 100, mv = m / 100, yv = y / 100, kv = k / 100;
	const r = Math.round(255 * (1 - cv) * (1 - kv));
	const g = Math.round(255 * (1 - mv) * (1 - kv));
	const b = Math.round(255 * (1 - yv) * (1 - kv));
	return rgbToHex([r, g, b]);
}

/**
 * @param {string|Uint8Array} input
 * @returns {Array<import('../ir.js').FontIR>}
 */
export function parseFonts(input) {
	const tree = parseXml(input);
	const root = tree?.['idPkg:Fonts'] ?? tree;

	/** @type {Array<import('../ir.js').FontIR>} */
	const fonts = [];

	for (const family of asArray(root?.['FontFamily'])) {
		const familyName = family?.['@Name'] ?? '';
		for (const font of asArray(family?.['Font'])) {
			const id = font?.['@Self'];
			if (!id) continue;
			fonts.push({
				id,
				family: familyName,
				style: font?.['@FontStyleName'] ?? 'Regular',
				postScriptName: font?.['@PostScriptName'],
			});
		}
	}
	return fonts;
}

/**
 * @param {string|Uint8Array} input
 * @param {number} dpi
 * @returns {Array<import('../ir.js').StyleIR>}
 */
export function parseStyles(input, dpi) {
	const tree = parseXml(input);
	const root = tree?.['idPkg:Styles'] ?? tree;

	/** @type {Array<import('../ir.js').StyleIR>} */
	const styles = [];

	const collect = (key, kind) => {
		for (const group of asArray(root?.[key])) {
			// IDML wraps individual styles inside the group element. The single
			// style case is also handled by `asArray`.
			for (const style of asArray(group?.[kind === 'paragraph' ? 'ParagraphStyle' : 'CharacterStyle'])) {
				styles.push(buildStyle(style, kind, dpi));
			}
		}
		// Some files store styles directly under root without a group wrapper.
		for (const style of asArray(root?.[kind === 'paragraph' ? 'ParagraphStyle' : 'CharacterStyle'])) {
			styles.push(buildStyle(style, kind, dpi));
		}
	};

	collect('RootParagraphStyleGroup', 'paragraph');
	collect('RootCharacterStyleGroup', 'character');

	// Deduplicate by id (some IDMLs duplicate the root group + a flat list).
	const seen = new Set();
	return styles.filter((s) => {
		if (seen.has(s.id)) return false;
		seen.add(s.id);
		return true;
	});
}

/**
 * @param {Record<string, unknown>} node
 * @param {'paragraph'|'character'} kind
 * @param {number} dpi
 * @returns {import('../ir.js').StyleIR}
 */
function buildStyle(node, kind, dpi) {
	const id = String(node['@Self'] ?? '');
	const name = String(node['@Name'] ?? id);
	const properties = {};
	for (const [key, value] of Object.entries(node)) {
		// fast-xml-parser stores attributes with our `@` prefix; the bare
		// element children are the rest. We keep both in `properties` so
		// downstream mappers can pluck anything they need without us having to
		// promote every IDML attribute to a typed field.
		if (key === '@Self' || key === '@Name') continue;
		properties[key] = value;
	}

	const pointSize = readNumber(node['@PointSize']);
	const leading = readNumber(node['@Leading']);
	const tracking = readNumber(node['@Tracking']);

	return {
		id,
		name,
		kind,
		fontSize: pointSize !== undefined ? roundPx(lengthToPx(pointSize, dpi)) : undefined,
		leading: leading !== undefined ? roundPx(lengthToPx(leading, dpi)) : undefined,
		tracking,
		fontRef: typeof node['@AppliedFont'] === 'string' ? node['@AppliedFont'] : undefined,
		fillColorRef: typeof node['@FillColor'] === 'string' ? node['@FillColor'] : undefined,
		properties,
	};
}

function readNumber(v) {
	if (v === undefined || v === null) return undefined;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
}
