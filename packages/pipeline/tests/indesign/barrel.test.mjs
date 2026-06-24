// Guards the package barrel (src/indesign/index.js) against dangling re-exports.
//
// A static `export { x } from './m.js'` where m.js doesn't export x is a link
// error that throws the moment anything imports the barrel — but nothing in the
// suite imported it, so a bad merge once shipped a dangling re-export to main
// with CI still green. This test is the "anything": importing the namespace
// below fails to load if any advertised name is missing, and the assertions
// document the contract the barrel promises.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as api from '../../src/indesign/index.js';

test('the indesign barrel resolves every advertised function export', () => {
	const expected = [
		'parseIdml', 'parseIdmlBuffer',
		'parsePdf', 'parsePdfBuffer',
		'ingestSource', 'ingestBuffer', 'toArtifact', 'detectFormat', 'extractContent',
		'mapTokens', 'generateTheme',
		'extractIdmlAssets', 'resolveAssets', 'buildAssetBundle', 'writeAssetBundle', 'runAssetStage',
	];
	for (const name of expected) {
		assert.equal(typeof api[name], 'function', `barrel must export a live '${name}' binding`);
	}
});

test('the indesign barrel exposes the ir schema namespace', () => {
	assert.equal(typeof api.ir, 'object');
	assert.equal(typeof api.ir.Document?.parse, 'function', 'ir.Document must be the zod schema');
});
