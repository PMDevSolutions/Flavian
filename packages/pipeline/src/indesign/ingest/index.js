// Ingest stage: a single, format-detecting front door for the pipeline. It
// turns a source asset (IDML or PDF) into the canonical IR the mapper and
// generator consume, enriched with a derived semantic content model.
//
// Where the per-format parse bins each handle one extension and print to
// stdout, this stage sniffs the bytes (so extensionless files, streams, and
// uploads all work), re-asserts the IR contract, and emits one validated,
// content-bearing artifact that downstream stages accept unchanged.
//
//   ingestBuffer(bytes, opts) → { format, ir, content }
//   ingestSource(pathOrBytes, opts) → same, reading a file path when given one
//   toArtifact(result) → the single JSON object written to disk

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { Document } from '../ir.js';
import { parseIdmlBuffer } from '../parse-idml.js';
import { parsePdfBuffer } from '../parse-pdf.js';
import { detectFormat } from './detect.js';
import { extractContent } from './content.js';

export { detectFormat } from './detect.js';
export { extractContent, ContentModel } from './content.js';

/**
 * @typedef {Object} IngestOptions
 * @property {'auto'|'idml'|'pdf'} [format]  Force a parser; default 'auto' (sniff bytes).
 * @property {number} [dpi]                  Unit-normalization DPI (default 96).
 * @property {string} [name]                 Override the document name.
 * @property {boolean} [content]             Derive the content model (default true).
 *
 * @typedef {Object} IngestResult
 * @property {'idml'|'pdf'} format
 * @property {import('../ir.js').DocumentIR} ir
 * @property {import('./content.js').ContentModelData|null} content
 */

/**
 * Ingest in-memory source bytes.
 *
 * @param {Uint8Array} bytes
 * @param {IngestOptions} [options]
 * @returns {Promise<IngestResult>}
 */
export async function ingestBuffer(bytes, options = {}) {
	const requested = options.format ?? 'auto';
	const format = requested === 'auto' ? detectFormat(bytes) : requested;

	let parsed;
	if (format === 'idml') {
		parsed = parseIdmlBuffer(bytes, parseOptions(options));
	} else if (format === 'pdf') {
		parsed = await parsePdfBuffer(bytes, parseOptions(options));
	} else {
		throw new Error('Unrecognized source: expected an IDML package or a PDF document');
	}

	// Re-assert the IR contract before downstream stages build on it.
	const ir = Document.parse(parsed);
	const content = options.content === false ? null : extractContent(ir);
	return { format, ir, content };
}

/**
 * Ingest from a file path (or delegate to {@link ingestBuffer} for raw bytes).
 *
 * @param {string|Uint8Array} input
 * @param {IngestOptions} [options]
 * @returns {Promise<IngestResult>}
 */
export async function ingestSource(input, options = {}) {
	if (typeof input !== 'string') return ingestBuffer(input, options);
	const bytes = await fs.readFile(input);
	const name = options.name ?? path.basename(input).replace(/\.(idml|pdf)$/i, '');
	return ingestBuffer(bytes, { ...options, name });
}

/**
 * Combine an ingest result into the single artifact written to disk: a valid
 * `Document` (exactly what the generator reads) plus an additive `content` key
 * downstream stages ignore. Keeping content as a sibling key — not folded into
 * the IR — means the artifact still round-trips through the existing schema.
 *
 * @param {IngestResult} result
 * @returns {object}
 */
export function toArtifact(result) {
	return result.content ? { ...result.ir, content: result.content } : result.ir;
}

function parseOptions(options) {
	const opts = {};
	if (options.dpi !== undefined) opts.dpi = options.dpi;
	if (options.name !== undefined) opts.name = options.name;
	return opts;
}
