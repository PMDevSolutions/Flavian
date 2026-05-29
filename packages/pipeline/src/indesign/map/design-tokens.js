// Emit Style Dictionary (DTCG) design tokens from the mapped token groups.
//
// Uses the Design Tokens Community Group draft format ($value/$type/$description)
// which Style Dictionary v4 reads natively. $description carries the original
// InDesign swatch/style name as provenance.

/**
 * @param {Object} groups
 * @param {Array<{ slug: string, color: string, name?: string }>} [groups.palette]
 * @param {Array<{ slug: string, size: string|number, name?: string }>} [groups.fontSizes]
 * @param {Array<{ slug: string, fontFamily: string, name?: string }>} [groups.fontFamilies]
 * @param {Array<{ slug: string, size: string|number, name?: string }>} [groups.spacingSizes]
 * @returns {Record<string, Record<string, { $value: string|number, $type: string, $description: string }>>}
 */
export function toDesignTokens(groups = {}) {
	const {
		palette = [],
		fontSizes = [],
		fontFamilies = [],
		spacingSizes = [],
	} = groups;

	const dtcg = {};

	const group = (key, items, type, valueOf) => {
		if (!items.length) return;
		dtcg[key] = {};
		for (const item of items) {
			dtcg[key][item.slug] = {
				$value: valueOf(item),
				$type: type,
				$description: item.name ?? item.slug,
			};
		}
	};

	group('color', palette, 'color', (t) => t.color);
	group('fontSize', fontSizes, 'dimension', (t) => t.size);
	group('fontFamily', fontFamilies, 'fontFamily', (t) => t.fontFamily);
	group('spacing', spacingSizes, 'dimension', (t) => t.size);

	return dtcg;
}
