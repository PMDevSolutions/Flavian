// PNG encoder (pure). We decode the output back with node:zlib to prove the
// bytes are a real, readable PNG without pulling in an image library.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePng, ImageKind } from '../../src/indesign/pdf/png.js';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readChunks(buf) {
	const chunks = {};
	let off = 8;
	while (off < buf.length) {
		const len = buf.readUInt32BE(off);
		const type = buf.toString('latin1', off + 4, off + 8);
		chunks[type] = buf.subarray(off + 8, off + 8 + len);
		off += 12 + len;
	}
	return chunks;
}

test('encodes a 2x1 RGB image with valid signature and IHDR', () => {
	const data = new Uint8Array([255, 0, 0, 0, 255, 0]); // red, green
	const png = encodePng({ width: 2, height: 1, kind: ImageKind.RGB_24BPP, data });
	assert.ok(png.subarray(0, 8).equals(SIG));
	const { IHDR, IDAT, IEND } = readChunks(png);
	assert.ok(IHDR && IDAT && IEND);
	assert.equal(IHDR.readUInt32BE(0), 2); // width
	assert.equal(IHDR.readUInt32BE(4), 1); // height
	assert.equal(IHDR[8], 8); // bit depth
	assert.equal(IHDR[9], 2); // color type RGB
});

test('IDAT decompresses to filtered scanlines that preserve pixels', () => {
	const data = new Uint8Array([10, 20, 30, 40, 50, 60]);
	const png = encodePng({ width: 2, height: 1, kind: ImageKind.RGB_24BPP, data });
	const { IDAT } = readChunks(png);
	const raw = inflateSync(IDAT);
	// One scanline: filter byte (0) + 6 pixel bytes.
	assert.equal(raw.length, 7);
	assert.equal(raw[0], 0);
	assert.deepEqual([...raw.subarray(1)], [10, 20, 30, 40, 50, 60]);
});

test('RGBA input produces a color-type-6 PNG', () => {
	const data = new Uint8Array([1, 2, 3, 255]);
	const png = encodePng({ width: 1, height: 1, kind: ImageKind.RGBA_32BPP, data });
	assert.equal(readChunks(png).IHDR[9], 6); // RGBA
});

test('grayscale 1bpp expands to RGB', () => {
	// One row, 2px, MSB-first: bits 1,0 -> white, black. Padded to a byte.
	const data = new Uint8Array([0b10000000]);
	const png = encodePng({ width: 2, height: 1, kind: ImageKind.GRAYSCALE_1BPP, data });
	const raw = inflateSync(readChunks(png).IDAT);
	assert.deepEqual([...raw], [0, 255, 255, 255, 0, 0, 0]); // filter + white + black
});
