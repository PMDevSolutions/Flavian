// Resolve image-frame assets stored inside an IDML package. Image frames whose
// href uses the `file:` scheme point at a member of the IDML zip; this helper
// unzips once and returns a Map from that href to its bytes + extension, ready
// for the output generator to stage into the theme's assets/images/.
//
// Real-world IDML can also embed images as base64 inside the spread XML; that
// path is out of scope here (v1 resolves package-linked assets only).

import { unzipSync } from 'fflate';

/**
 * @param {Uint8Array|ArrayBuffer|Buffer} buffer  Raw .idml bytes.
 * @returns {Map<string, { bytes: Uint8Array, ext: string }>} href → asset.
 */
export function extractIdmlAssets(buffer) {
  const files = unzipSync(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const map = new Map();
  for (const [name, bytes] of Object.entries(files)) {
    const ext = (name.split('.').pop() ?? '').toLowerCase();
    if (/^(jpe?g|png|gif|webp|svg|tiff?)$/.test(ext)) {
      map.set(`file:${name}`, { bytes, ext });
    }
  }
  return map;
}
