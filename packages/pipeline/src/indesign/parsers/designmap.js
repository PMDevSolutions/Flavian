// designmap.xml is the IDML manifest: it lists the document's stories,
// spreads, master spreads, and resource files. The root element is
// <Document>, with <idPkg:Story src="Stories/Story_x.xml"/> etc. children.

import { parseXml, asArray } from './xml.js';

/**
 * @typedef {Object} DesignMap
 * @property {string=} idmlVersion
 * @property {string=} name
 * @property {string[]} storySrcs
 * @property {string[]} spreadSrcs
 * @property {string[]} masterSpreadSrcs
 * @property {string=} graphicSrc
 * @property {string=} fontsSrc
 * @property {string=} stylesSrc
 */

/**
 * @param {string|Uint8Array} input
 * @returns {DesignMap}
 */
export function parseDesignMap(input) {
	const tree = parseXml(input);
	const doc = tree?.['Document'] ?? tree?.['document'];
	if (!doc) {
		throw new Error('designmap.xml has no <Document> root');
	}

	const collectSrcs = (key) =>
		asArray(doc[key])
			.map((node) => node?.['@src'])
			.filter((src) => typeof src === 'string');

	return {
		idmlVersion: doc['@DOMVersion'],
		name: doc['@Name'],
		storySrcs: collectSrcs('idPkg:Story'),
		spreadSrcs: collectSrcs('idPkg:Spread'),
		masterSpreadSrcs: collectSrcs('idPkg:MasterSpread'),
		graphicSrc: asArray(doc['idPkg:Graphic'])[0]?.['@src'],
		fontsSrc: asArray(doc['idPkg:Fonts'])[0]?.['@src'],
		stylesSrc: asArray(doc['idPkg:Styles'])[0]?.['@src'],
	};
}
