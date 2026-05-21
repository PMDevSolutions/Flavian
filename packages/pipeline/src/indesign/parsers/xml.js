// Thin wrapper over fast-xml-parser tuned for IDML's element-heavy XML.
//
// IDML elements rely on attributes (`Self`, `ParentStory`, `AppliedFont`)
// rather than text content for almost every cross-reference, so the parser
// is configured to surface attributes alongside child elements.

import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@',
	// Keep arrays even when there's one child — saves the consumer doing
	// `Array.isArray(x) ? x : [x]` everywhere.
	isArray: () => false, // overridden per-call below
	allowBooleanAttributes: true,
	parseAttributeValue: false,
	trimValues: true,
});

/**
 * Parse an IDML XML buffer/string into a plain JS tree.
 *
 * @param {string|Uint8Array} input
 * @returns {Record<string, unknown>}
 */
export function parseXml(input) {
	const text = typeof input === 'string' ? input : new TextDecoder('utf-8').decode(input);
	return parser.parse(text);
}

/**
 * Normalize a "this might be one element or an array of them" shape into a
 * proper array. fast-xml-parser hands back the raw thing.
 *
 * @template T
 * @param {T | T[] | undefined | null} value
 * @returns {T[]}
 */
export function asArray(value) {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}
