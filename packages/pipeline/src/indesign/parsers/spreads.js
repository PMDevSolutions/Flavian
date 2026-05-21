// Spreads/Spread_<id>.xml describes one spread (one or two facing pages)
// with all the frames placed on it. Master spreads have the same shape.
//
// Geometry comes via `ItemTransform` (a 6-component affine matrix: a b c d tx ty)
// and `GeometricBounds` (top left bottom right, in spread coordinates).
// We collapse this to a simple axis-aligned rect — print designers do use
// rotation occasionally, but for FSE conversion we work in screen-space and
// rotation goes in `properties` for the mapper to handle.

import { parseXml, asArray } from './xml.js';
import { lengthToPx, roundPx } from '../units.js';

/**
 * @param {string|Uint8Array} input
 * @param {string} sourcePath
 * @param {number} dpi
 * @returns {{ id: string, pages: Array<import('../ir.js').SpreadIR['pages'][number]>, frames: Array<import('../ir.js').FrameIR>, appliedMasterRef?: string }}
 */
export function parseSpread(input, sourcePath, dpi) {
	const tree = parseXml(input);
	const root = tree?.['idPkg:Spread'] ?? tree;
	const spread = asArray(root?.['Spread'])[0];
	if (!spread) {
		throw new Error(`${sourcePath} has no <Spread> element`);
	}
	return {
		id: String(spread['@Self']),
		pages: asArray(spread['Page']).map((p) => buildPage(p, dpi)),
		frames: collectFrames(spread, dpi, /* masterRef */ undefined),
		appliedMasterRef:
			typeof spread['@AppliedMaster'] === 'string' && spread['@AppliedMaster'] !== 'n'
				? spread['@AppliedMaster']
				: undefined,
	};
}

/**
 * @param {string|Uint8Array} input
 * @param {string} sourcePath
 * @param {number} dpi
 * @returns {import('../ir.js').MasterSpreadIR}
 */
export function parseMasterSpread(input, sourcePath, dpi) {
	const tree = parseXml(input);
	const root = tree?.['idPkg:MasterSpread'] ?? tree;
	const master = asArray(root?.['MasterSpread'])[0];
	if (!master) {
		throw new Error(`${sourcePath} has no <MasterSpread> element`);
	}
	const id = String(master['@Self']);
	return {
		id,
		source: sourcePath,
		name: master['@Name'] ?? id,
		pages: asArray(master['Page']).map((p) => buildPage(p, dpi)),
		frames: collectFrames(master, dpi, id),
	};
}

function buildPage(node, dpi) {
	return {
		id: String(node['@Self']),
		bounds: parseBounds(node['@GeometricBounds'], dpi),
	};
}

function collectFrames(parent, dpi, masterRef) {
	const frames = [];
	for (const tf of asArray(parent['TextFrame'])) {
		frames.push({
			kind: 'text',
			id: String(tf['@Self']),
			bounds: parseBounds(tf['@GeometricBounds'], dpi),
			masterRef,
			storyRef: typeof tf['@ParentStory'] === 'string' ? tf['@ParentStory'] : undefined,
		});
	}
	for (const rect of asArray(parent['Rectangle'])) {
		// A <Rectangle> with a placed image holds it in <Image> or <EPS> children.
		const placed = asArray(rect['Image'])[0] ?? asArray(rect['EPS'])[0] ?? asArray(rect['PDF'])[0];
		if (!placed) continue;
		const link = asArray(placed['Link'])[0];
		const href = link?.['@LinkResourceURI'] ?? placed?.['@Href'];
		// IDML "embedded state" lives on the Link. A Link with no LinkResourceURI
		// (or with a `file:` scheme that points inside the package) is embedded.
		const embedded = !href || /^file:/.test(String(href));
		frames.push({
			kind: 'image',
			id: String(rect['@Self']),
			bounds: parseBounds(rect['@GeometricBounds'], dpi),
			masterRef,
			href: typeof href === 'string' ? href : undefined,
			embedded,
		});
	}
	return frames;
}

/**
 * IDML GeometricBounds: "top left bottom right" as 4 space-separated numbers
 * in points. Returns the rect in normalized px.
 *
 * @param {unknown} raw
 * @param {number} dpi
 */
function parseBounds(raw, dpi) {
	if (typeof raw !== 'string') {
		return { x: 0, y: 0, width: 0, height: 0 };
	}
	const parts = raw.trim().split(/\s+/).map(Number);
	if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
		return { x: 0, y: 0, width: 0, height: 0 };
	}
	const [top, left, bottom, right] = parts;
	return {
		x: roundPx(lengthToPx(left, dpi)),
		y: roundPx(lengthToPx(top, dpi)),
		width: roundPx(lengthToPx(right - left, dpi)),
		height: roundPx(lengthToPx(bottom - top, dpi)),
	};
}
