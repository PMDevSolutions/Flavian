// Source-format detection for the ingest stage. Sniffs the *bytes*, not the
// filename, so the pipeline can ingest an extensionless file, a stream, or an
// in-memory upload — the per-format parse bins only dispatch on `.idml`/`.pdf`.
//
// IDML is a Zip package (PK signature) whose manifest is always `designmap.xml`.
// A Zip's entry *data* may be deflated, but its entry *filenames* are written
// verbatim into each local file header (and again into the central directory),
// so the manifest name is greppable even in a compressed package — that, not
// the easily-deflated mimetype marker, is what we key on.
//
// PDF starts with "%PDF-", which some exporters emit a few bytes in (after a
// BOM or leading whitespace), so we scan a short prefix rather than only byte 0.

const ZIP_SIG_0 = 0x50; // 'P'
const ZIP_SIG_1 = 0x4b; // 'K'
const IDML_MANIFEST = 'designmap.xml';
const PDF_HEADER = '%PDF-';
const SNIFF_BYTES = 1024;

/**
 * @param {Uint8Array|Buffer} bytes
 * @returns {'idml'|'pdf'|'unknown'}
 */
export function detectFormat(bytes) {
	const buf = toBuffer(bytes);
	if (buf.length < 5) return 'unknown';
	if (isPdf(buf)) return 'pdf';
	if (isIdml(buf)) return 'idml';
	return 'unknown';
}

function isPdf(buf) {
	const head = buf.subarray(0, SNIFF_BYTES).toString('latin1');
	return head.includes(PDF_HEADER);
}

function isIdml(buf) {
	if (buf[0] !== ZIP_SIG_0 || buf[1] !== ZIP_SIG_1) return false;
	// The manifest filename lives in a local file header near the front and in
	// the central directory at the tail, so a whole-buffer scan is reliable.
	return buf.includes(IDML_MANIFEST, 0, 'latin1');
}

/** Normalize any byte source to a Buffer view without copying when possible. */
function toBuffer(bytes) {
	if (Buffer.isBuffer(bytes)) return bytes;
	if (bytes instanceof Uint8Array) {
		return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	}
	throw new TypeError('detectFormat expects a Buffer or Uint8Array');
}
