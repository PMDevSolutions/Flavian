// Token mapper orchestrator: a validated InDesign IR (from either parser) →
// WordPress design tokens.
//
//   mapTokens(ir, options) → { partial, designTokens, merged, report }
//
//   partial      additive, namespaced theme.json partial
//   merged       base theme deep-merged with the partial (preview)
//   designTokens DTCG / Style Dictionary tokens
//   report       warnings, validation, provenance, font fallbacks

import { readFileSync } from 'node:fs';

import { WarningCollector } from '../warnings.js';
import { slugify } from './slug.js';
import { mapColors } from './colors.js';
import { mapFonts, loadFontMap } from './fonts.js';
import { mapTypography } from './typography.js';
import { mapSpacing } from './spacing.js';
import { assemblePartial, mergeThemeJson, validateThemeJson } from './theme-json.js';
import { toDesignTokens } from './design-tokens.js';
import { buildReport } from './report.js';

const DEFAULT_BASE_THEME_URL = new URL('../../../../../themes/flavian-shop/theme.json', import.meta.url);

/** Load a base theme from an object, a path, or the bundled default. */
function loadBaseTheme(base) {
	if (base && typeof base === 'object') return base;
	return JSON.parse(readFileSync(base ?? DEFAULT_BASE_THEME_URL, 'utf8'));
}

/**
 * @typedef {Object} MapTokensOptions
 * @property {object|string} [base]    Base theme object or path (default: bundled flavian-shop).
 * @property {object|string} [fontMap] Font map object or path (default: bundled config).
 * @property {string} [namespace]      Derived-token slug prefix (default 'id').
 * @property {number} [tolerance]      Color squared-distance tolerance.
 * @property {number} [tolerancePx]    Typography size clustering tolerance (px).
 * @property {number} [gridPx]         Spacing quantization grid (px).
 * @property {boolean} [fluid]         Emit fluid clamp() font sizes.
 *
 * @param {import('../ir.js').DocumentIR} ir
 * @param {MapTokensOptions} [options]
 * @returns {{ partial: object, designTokens: object, merged: object, report: object }}
 */
export function mapTokens(ir, options = {}) {
	const {
		base,
		fontMap,
		namespace = 'id',
		tolerance,
		tolerancePx,
		gridPx,
		fluid,
	} = options;

	const baseTheme = loadBaseTheme(base);
	const warnings = new WarningCollector();

	const basePalette = baseTheme?.settings?.color?.palette ?? [];
	const baseFontSizes = baseTheme?.settings?.typography?.fontSizes ?? [];
	const baseFontFamilies = baseTheme?.settings?.typography?.fontFamilies ?? [];

	const { palette, swatchToSlug } = mapColors(ir.swatches ?? [], {
		basePalette,
		tolerance,
		namespace,
		warnings,
	});

	const resolvedFontMap = fontMap && typeof fontMap === 'object' ? fontMap : loadFontMap(fontMap);
	const { fontFamilies, fontToSlug, googleFonts } = mapFonts(ir.fonts ?? [], {
		fontMap: resolvedFontMap,
		baseFontFamilies,
		namespace,
		warnings,
	});

	const { fontSizes, elements, blocks, styleToSlug } = mapTypography(ir.styles ?? [], {
		baseFontSizes,
		swatchToSlug,
		fontToSlug,
		tolerancePx,
		fluid,
		namespace,
	});

	const { spacingSizes } = mapSpacing(ir, { gridPx, namespace, warnings });

	const partial = assemblePartial({ palette, fontSizes, fontFamilies, spacingSizes, elements, blocks });
	const merged = mergeThemeJson(baseTheme, partial);
	const designTokens = toDesignTokens({ palette, fontSizes, fontFamilies, spacingSizes });

	const validation = validateThemeJson(merged);
	const report = buildReport({
		ir,
		warnings: warnings.list(),
		validation,
		googleFonts,
		provenance: { swatchToSlug, styleToSlug, fontToSlug },
	});

	return { partial, designTokens, merged, report };
}

// slugify is re-exported for callers that want to derive a namespace from a name.
export { slugify };
