// Aggregate the generator report: IR + mapper warnings, validation result,
// provenance maps, font fallbacks, out-of-gamut colors, and Google fonts to
// enqueue downstream.

/**
 * @param {Object} input
 * @param {import('../ir.js').DocumentIR} [input.ir]
 * @param {Array<import('../ir.js').ParseWarningIR>} [input.warnings]  Mapper warnings.
 * @param {{ valid: boolean, errors: Array<object> }} [input.validation]
 * @param {Array<{ slug: string, name: string }>} [input.googleFonts]
 * @param {{ swatchToSlug?: object, styleToSlug?: object, fontToSlug?: object }} [input.provenance]
 * @returns {object}
 */
export function buildReport({ ir = {}, warnings = [], validation = { valid: true, errors: [] }, googleFonts = [], provenance = {} } = {}) {
	const all = [...(ir.warnings ?? []), ...warnings];
	const byCode = (code) => all.filter((w) => w.code === code);

	return {
		valid: validation.valid,
		validationErrors: validation.errors ?? [],
		warnings: all,
		fontFallbacks: byCode('font-fallback').map((w) => w.message),
		outOfGamut: byCode('color-out-of-gamut').map((w) => w.message),
		approximations: [...byCode('swatch-approximated'), ...byCode('spacing-approximate'), ...byCode('pdf-fallback')].map((w) => w.message),
		googleFonts,
		provenance: {
			swatchToSlug: provenance.swatchToSlug ?? {},
			styleToSlug: provenance.styleToSlug ?? {},
			fontToSlug: provenance.fontToSlug ?? {},
		},
		counts: {
			swatches: (ir.swatches ?? []).length,
			fonts: (ir.fonts ?? []).length,
			styles: (ir.styles ?? []).length,
			warnings: all.length,
		},
	};
}
