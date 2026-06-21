// Byte-sniffing format detection: real IDML/PDF fixtures (built in code) are
// recognized, and lookalikes (a plain zip, garbage, an empty buffer) are not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';

import { detectFormat } from '../../src/indesign/ingest/detect.js';
import { buildIdml } from './helpers/build-idml.js';
import { buildPdf } from './helpers/build-pdf.js';

test('detects an IDML package by its zip signature + manifest name', () => {
	const idml = buildIdml({
		name: 'Mini',
		spreads: [{ id: 'sp', pages: [{ id: 'pg', bounds: [0, 0, 100, 100] }], frames: [] }],
	});
	assert.equal(detectFormat(idml), 'idml');
});

test('detects a PDF by its header', () => {
	const pdf = buildPdf({
		title: 'Mini',
		pages: [{ width: 100, height: 100, texts: [{ text: 'hi', x: 10, y: 20, size: 12 }] }],
	});
	assert.equal(detectFormat(pdf), 'pdf');
});

test('a non-IDML zip is not mistaken for a source', () => {
	const zip = zipSync({ 'readme.txt': strToU8('hello world'), 'data/x.json': strToU8('{}') });
	assert.equal(detectFormat(zip), 'unknown');
});

test('garbage and too-short buffers are unknown', () => {
	assert.equal(detectFormat(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), 'unknown');
	assert.equal(detectFormat(new Uint8Array([0x50, 0x4b])), 'unknown'); // bare "PK", too short
	assert.equal(detectFormat(new Uint8Array([])), 'unknown');
});

test('tolerates a PDF header a few bytes in (BOM / leading whitespace)', () => {
	const pdf = Buffer.concat([Buffer.from('﻿', 'utf8'), Buffer.from('%PDF-1.7\n1 0 obj\n')]);
	assert.equal(detectFormat(pdf), 'pdf');
});

test('accepts a Buffer as well as a Uint8Array', () => {
	const idml = Buffer.from(buildIdml({ name: 'B', spreads: [] }));
	assert.equal(detectFormat(idml), 'idml');
});
