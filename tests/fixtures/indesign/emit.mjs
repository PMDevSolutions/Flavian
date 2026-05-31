#!/usr/bin/env node
// Materialize the canonical InDesign fixtures to disk:
//
//   node tests/fixtures/indesign/emit.mjs [out-dir]
//
// Writes brochure.idml and brochure.pdf (defaults to this directory). Handy for
// running the pipeline against a real file, e.g.:
//
//   node tests/fixtures/indesign/emit.mjs /tmp/fix
//   flavian pipeline indesign /tmp/fix/brochure.idml --output themes/brochure
//
// The bytes are deterministic — re-emitting overwrites with identical content.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBrochureIdml, buildBrochurePdf } from './brochure.mjs';

const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.dirname(fileURLToPath(import.meta.url));

await fs.mkdir(outDir, { recursive: true });
const idmlPath = path.join(outDir, 'brochure.idml');
const pdfPath = path.join(outDir, 'brochure.pdf');

await fs.writeFile(idmlPath, buildBrochureIdml());
await fs.writeFile(pdfPath, buildBrochurePdf());

process.stdout.write(`wrote ${path.relative(process.cwd(), idmlPath)}\nwrote ${path.relative(process.cwd(), pdfPath)}\n`);
