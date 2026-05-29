// Thin loader around pdfjs-dist's legacy build (the one that runs in Node
// without a DOM). We import it lazily so consumers that only ever parse IDML
// don't pull pdfjs — a multi-megabyte dependency — into their bundle/startup.

let pdfjsPromise;

// pdfjs-dist 4.x calls Promise.withResolvers, which only exists on Node 22+.
// This package supports Node >=20, so polyfill it (guarded) before pdfjs loads.
if (typeof Promise.withResolvers !== 'function') {
	Promise.withResolvers = function withResolvers() {
		let resolve;
		let reject;
		const promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return { promise, resolve, reject };
	};
}

/**
 * Resolve the pdfjs module once and cache it.
 * @returns {Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>}
 */
export function loadPdfjs() {
	if (!pdfjsPromise) {
		pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
	}
	return pdfjsPromise;
}

/**
 * Open a PDF document from raw bytes with settings tuned for headless,
 * extraction-only use:
 *   - no worker / no eval (we never render to a canvas)
 *   - verbosity errors-only (base-14 fonts otherwise spam "standard font data"
 *     warnings we handle ourselves via fidelity warnings)
 *   - a private copy of the bytes, because pdfjs transfers/detaches the buffer
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy>}
 */
export async function openDocument(bytes) {
	const pdfjs = await loadPdfjs();
	// pdfjs requires a *plain* Uint8Array and detaches the buffer it's given.
	// Node's fs.readFile returns a Buffer (a Uint8Array subclass) which pdfjs
	// rejects, so always copy into a fresh Uint8Array we can safely hand over.
	const data = new Uint8Array(bytes.byteLength);
	data.set(bytes);
	return pdfjs.getDocument({
		data,
		isEvalSupported: false,
		useSystemFonts: false,
		verbosity: 0,
	}).promise;
}
