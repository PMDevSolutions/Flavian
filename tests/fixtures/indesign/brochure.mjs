// Canonical "Spring Brochure" InDesign fixture — defined as code, not committed
// as a binary blob (the pipeline's standing convention: fixtures are readable
// specs, materialized on demand).
//
// The same logical two-spread brochure is expressed in both input formats so the
// end-to-end tests can exercise the primary path (IDML) and the lossy fallback
// (PDF) against one design:
//
//   Spread 1 (text-heavy cover): a "Welcome" headline + a body paragraph.
//   Spread 2 (image-heavy):      a full-bleed hero image with an "On Sale Now"
//                                headline overlaid on it.
//
// `emit.mjs` writes these to disk (brochure.idml / brochure.pdf) for manual runs
// of `flavian pipeline indesign …`; `fixtures.test.mjs` runs them through the
// whole pipeline in CI.

import { buildIdml } from '../../../packages/pipeline/tests/indesign/helpers/build-idml.js';
import { buildPdf } from '../../../packages/pipeline/tests/indesign/helpers/build-pdf.js';

export const BROCHURE_NAME = 'Spring Brochure';

/** A solid-color raw-RGB image (width×height×3 bytes) for the PDF hero. */
function solidRgb(width, height, [r, g, b]) {
	const data = new Uint8Array(width * height * 3);
	for (let i = 0; i < width * height; i += 1) {
		data[i * 3] = r;
		data[i * 3 + 1] = g;
		data[i * 3 + 2] = b;
	}
	return { width, height, data };
}

/**
 * The primary, high-fidelity path: a full IDML package with stories, frames,
 * paragraph styles, swatches, and a master spread.
 * @returns {Uint8Array}
 */
export function buildBrochureIdml() {
	return buildIdml({
		name: BROCHURE_NAME,
		colors: [
			{ id: 'col-brand', name: 'Brand Blue', space: 'RGB', values: [0, 102, 204] },
			{ id: 'col-ink', name: 'Ink', space: 'CMYK', values: [0, 0, 0, 100] },
		],
		fonts: [
			{ id: 'f-helv', family: 'Helvetica', style: 'Bold', postScriptName: 'Helvetica-Bold' },
			{ id: 'f-helv-reg', family: 'Helvetica', style: 'Regular', postScriptName: 'Helvetica' },
		],
		styles: [
			{ id: 'p-h1', name: 'Heading 1', kind: 'paragraph', pointSize: 36, leading: 40, appliedFont: 'f-helv', fillColor: 'col-brand' },
			{ id: 'p-body', name: 'Body', kind: 'paragraph', pointSize: 12, leading: 18, appliedFont: 'f-helv-reg', fillColor: 'col-ink' },
			{ id: 'p-foot', name: 'Footer', kind: 'paragraph', pointSize: 9, leading: 12, appliedFont: 'f-helv-reg', fillColor: 'col-ink' },
		],
		stories: [
			{ id: 's-title', runs: [{ text: 'Welcome', paragraphStyle: 'p-h1' }] },
			{ id: 's-body', runs: [{ text: 'Carefully sourced, honestly priced. Browse our spring collection.', paragraphStyle: 'p-body' }] },
			{ id: 's-hero', runs: [{ text: 'On Sale Now', paragraphStyle: 'p-h1' }] },
			{ id: 's-foot', runs: [{ text: 'Spring Brochure', paragraphStyle: 'p-foot' }] },
		],
		masters: [
			{
				id: 'master-a',
				name: 'A-Master',
				pages: [{ id: 'mp-1', bounds: [0, 0, 792, 612] }],
				frames: [{ kind: 'text', id: 'mf-foot', bounds: [760, 60, 786, 540], parentStory: 's-foot' }],
			},
		],
		spreads: [
			{
				id: 'spread-cover',
				appliedMaster: 'master-a',
				pages: [{ id: 'page-1', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'text', id: 'tf-title', bounds: [60, 60, 150, 540], parentStory: 's-title' },
					{ kind: 'text', id: 'tf-body', bounds: [170, 60, 320, 540], parentStory: 's-body' },
				],
			},
			{
				id: 'spread-hero',
				appliedMaster: 'master-a',
				pages: [{ id: 'page-2', bounds: [0, 0, 792, 612] }],
				frames: [
					{ kind: 'image', id: 'if-hero', bounds: [0, 0, 612, 792], href: 'file:Links/hero.png' },
					{ kind: 'text', id: 'if-overlay', bounds: [240, 100, 330, 500], parentStory: 's-hero' },
				],
			},
		],
	});
}

/**
 * The lossy fallback path: the same logical brochure exported as a PDF. Text is
 * positioned in base-14 fonts; the hero is a placed RGB image. The parser
 * reconstructs spreads/frames/styles from this and emits fidelity warnings.
 * @returns {Uint8Array}
 */
export function buildBrochurePdf() {
	const toUnit = ([r, g, b]) => [r / 255, g / 255, b / 255];
	return buildPdf({
		title: BROCHURE_NAME,
		pages: [
			{
				width: 612,
				height: 792,
				texts: [
					{ text: 'Welcome', x: 60, y: 96, size: 36, font: 'Helvetica-Bold', color: toUnit([0, 102, 204]) },
					{ text: 'Carefully sourced, honestly priced. Browse our spring collection.', x: 60, y: 150, size: 12, font: 'Helvetica', color: toUnit([0, 0, 0]) },
				],
			},
			{
				width: 612,
				height: 792,
				images: [
					{ x: 0, y: 0, width: 612, height: 792, rgb: solidRgb(16, 16, [0, 102, 204]) },
				],
				texts: [
					{ text: 'On Sale Now', x: 80, y: 420, size: 36, font: 'Helvetica-Bold', color: toUnit([255, 255, 255]) },
				],
			},
		],
	});
}
