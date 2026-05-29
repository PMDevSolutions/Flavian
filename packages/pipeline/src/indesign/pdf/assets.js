// Asset cache writer. Extracted images are PNG-encoded and written under a
// caller-provided directory; the IR's ImageFrame.href points at the
// cache-relative path so the downstream media importer can find them.
//
// Writing is opt-in: with no assetCacheDir the parser still records image
// frames and their hrefs (so the IR is complete and addressable), it just
// doesn't persist bytes — useful for verification runs and tests that only
// assert structure.

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { encodePng } from './png.js';

/**
 * Stable, collision-free href for an extracted image.
 * @param {number} pageIndex 0-based
 * @param {number} imageIndex 0-based
 * @returns {string}
 */
export function assetHref(pageIndex, imageIndex) {
	const p = String(pageIndex + 1).padStart(3, '0');
	const n = String(imageIndex + 1).padStart(3, '0');
	return `assets/pdf-p${p}-img${n}.png`;
}

/**
 * Encode + write one image to the cache. Returns the byte length written.
 *
 * @param {string} cacheDir
 * @param {string} href cache-relative path (from assetHref)
 * @param {{ width: number, height: number, kind: number, data: Uint8Array }} image
 * @returns {Promise<number>}
 */
export async function writeAsset(cacheDir, href, image) {
	const png = encodePng(image);
	const dest = path.join(cacheDir, href);
	await fs.mkdir(path.dirname(dest), { recursive: true });
	await fs.writeFile(dest, png);
	return png.length;
}
