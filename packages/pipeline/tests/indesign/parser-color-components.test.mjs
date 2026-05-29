// The IDML graphic parser attaches raw color components and converts LAB
// through the shared module (no longer collapsing LAB to black).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGraphic } from '../../src/indesign/parsers/resources.js';
import { WarningCollector } from '../../src/indesign/warnings.js';

test('IDML LAB swatch converts to a real (non-black) color with components', () => {
	const warnings = new WarningCollector();
	const xml = '<idPkg:Graphic><Color Self="c1" Name="Lab Red" Space="LAB" ColorValue="54 81 70"/></idPkg:Graphic>';
	const [sw] = parseGraphic(xml, warnings);
	assert.equal(sw.color.space, 'LAB');
	assert.deepEqual(sw.color.components, [54, 81, 70]);
	assert.notEqual(sw.color.hex, '#000000');
});

test('IDML CMYK swatch keeps components in 0..100 and converts to hex', () => {
	const warnings = new WarningCollector();
	const xml = '<idPkg:Graphic><Color Self="c2" Name="Ink" Space="CMYK" ColorValue="0 0 0 100"/></idPkg:Graphic>';
	const [sw] = parseGraphic(xml, warnings);
	assert.deepEqual(sw.color.components, [0, 0, 0, 100]);
	assert.equal(sw.color.hex, '#000000');
});

test('IDML RGB swatch carries components', () => {
	const warnings = new WarningCollector();
	const xml = '<idPkg:Graphic><Color Self="c3" Name="Brand" Space="RGB" ColorValue="0 102 204"/></idPkg:Graphic>';
	const [sw] = parseGraphic(xml, warnings);
	assert.deepEqual(sw.color.components, [0, 102, 204]);
	assert.equal(sw.color.hex, '#0066cc');
});
