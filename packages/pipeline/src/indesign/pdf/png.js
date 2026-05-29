// Minimal PNG encoder for extracted image data.
//
// pdfjs hands back *decoded* pixels (RGB/RGBA/grayscale), not the original
// encoded stream, so we re-encode to a real image file the downstream media
// importer can use. PNG is lossless and dependency-free here: deflate comes
// from node:zlib, and CRC-32 is a tiny table we build once. We deliberately
// avoid pulling in an image library — a fallback parser shouldn't add weight.

import { deflateSync } from 'node:zlib';

// pdfjs ImageKind values (stable across pdfjs 4.x). Re-declared so we don't
// depend on importing the enum from the lazily-loaded pdfjs module.
export const ImageKind = {
	GRAYSCALE_1BPP: 1,
	RGB_24BPP: 2,
	RGBA_32BPP: 3,
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i += 1) {
		c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const typeBuf = Buffer.from(type, 'latin1');
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
	return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * Normalize pdfjs pixel data to packed RGB or RGBA scanlines.
 *
 * @param {{width: number, height: number, kind: number, data: Uint8Array|Uint8ClampedArray}} image
 * @returns {{channels: 3|4, pixels: Uint8Array}}
 */
function toPixels(image) {
	const { width, height, kind, data } = image;
	if (kind === ImageKind.RGBA_32BPP) {
		return { channels: 4, pixels: data instanceof Uint8Array ? data : Uint8Array.from(data) };
	}
	if (kind === ImageKind.RGB_24BPP) {
		return { channels: 3, pixels: data instanceof Uint8Array ? data : Uint8Array.from(data) };
	}
	if (kind === ImageKind.GRAYSCALE_1BPP) {
		// 1 bit per pixel, MSB-first, rows padded to whole bytes. Expand to RGB.
		const rowBytes = (width + 7) >> 3;
		const pixels = new Uint8Array(width * height * 3);
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
				const v = bit ? 255 : 0;
				const o = (y * width + x) * 3;
				pixels[o] = v;
				pixels[o + 1] = v;
				pixels[o + 2] = v;
			}
		}
		return { channels: 3, pixels };
	}
	throw new Error(`unsupported image kind ${kind}`);
}

/**
 * Encode decoded pixel data as a PNG buffer.
 *
 * @param {{width: number, height: number, kind: number, data: Uint8Array|Uint8ClampedArray}} image
 * @returns {Buffer}
 */
export function encodePng(image) {
	const { width, height } = image;
	const { channels, pixels } = toPixels(image);

	// Prefix each scanline with a filter byte (0 = none). Keeps the encoder
	// trivial; deflate still compresses solid regions well.
	const stride = width * channels;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y += 1) {
		raw[y * (stride + 1)] = 0;
		Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = channels === 4 ? 6 : 2; // color type: 6 = RGBA, 2 = RGB
	ihdr[10] = 0; // compression
	ihdr[11] = 0; // filter
	ihdr[12] = 0; // interlace

	return Buffer.concat([
		PNG_SIGNATURE,
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0)),
	]);
}
