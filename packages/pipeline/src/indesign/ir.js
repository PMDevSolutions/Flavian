// Intermediate representation for parsed IDML documents.
//
// Downstream stages (style mapper, output generator) consume this shape.
// The zod schemas serve two purposes:
//   1. Runtime validation — `Document.parse(value)` rejects malformed IRs
//      with a precise path to the bad field.
//   2. JSDoc types — `@typedef {import('./ir.js').Document}` works in
//      editors without a TS toolchain.
//
// Why zod and not hand-rolled validators: composability and free type
// inference for any future TS consumer (`z.infer<typeof Document>`).

import { z } from 'zod';

// IDML IDs ("Self" attributes) are short tokens like "u123" or
// "ParagraphStyle/$ID/[No paragraph style]". Permissive on purpose.
export const IdmlId = z.string().min(1);

export const Color = z.object({
	// "#RRGGBB" — the parse-time value (naive for CMYK; legacy black for LAB
	// when no components were captured). The mapper re-derives from `components`.
	hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
	// Source color space as declared by IDML, kept for the mapper to flag.
	space: z.enum(['RGB', 'CMYK', 'LAB', 'Spot', 'Unknown']),
	// Raw channel values in the source space's documented range, so the mapper
	// can do a proper, documented conversion to sRGB:
	//   RGB  [r,g,b]   0..255
	//   CMYK [c,m,y,k] 0..100
	//   LAB  [L,a,b]   L 0..100, a/b -128..127
	//   Gray [v]       0..255 (stored as an RGB triple)
	// Optional so older IRs still validate; the mapper falls back to `hex`.
	components: z.array(z.number()).optional(),
});

export const Swatch = z.object({
	id: IdmlId,
	name: z.string(),
	color: Color,
});

export const Font = z.object({
	id: IdmlId,
	family: z.string(),
	// e.g. "Regular", "Bold", "Italic". InDesign's PostScript-style key.
	style: z.string(),
	// Font is referenced by exact PostScript name in style declarations.
	postScriptName: z.string().optional(),
});

export const Style = z.object({
	id: IdmlId,
	name: z.string(),
	kind: z.enum(['paragraph', 'character']),
	// Captured here; the mapper decides which become block presets.
	fontSize: z.number().positive().optional(),       // px (normalized)
	leading: z.number().positive().optional(),        // px (normalized)
	tracking: z.number().optional(),                  // thousandths of an em
	fontRef: IdmlId.optional(),
	fillColorRef: IdmlId.optional(),
	// Free-form bag for properties we don't promote to first-class fields yet.
	// The mapper can promote them later without breaking the schema.
	properties: z.record(z.unknown()).default({}),
});

// Geometry is normalized to pixels at the parse-time DPI (default 96).
// Origin (0,0) is the spread's top-left.
export const Rect = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number().nonnegative(),
	height: z.number().nonnegative(),
});

// A run of text with its style references resolved later.
export const TextRun = z.object({
	text: z.string(),
	paragraphStyleRef: IdmlId.optional(),
	characterStyleRef: IdmlId.optional(),
});

export const Story = z.object({
	id: IdmlId,
	// Source XML file — kept for debugging round-trips.
	source: z.string(),
	runs: z.array(TextRun),
});

const FrameBase = z.object({
	id: IdmlId,
	bounds: Rect,
	// Frames on a master inherit this; on a spread it's the spread id.
	spreadRef: IdmlId.optional(),
	masterRef: IdmlId.optional(),
});

export const TextFrame = FrameBase.extend({
	kind: z.literal('text'),
	// Resolved by the cross-ref pass; may be undefined if the IDML had a
	// dangling reference (warning emitted).
	storyRef: IdmlId.optional(),
});

export const ImageFrame = FrameBase.extend({
	kind: z.literal('image'),
	// Path inside the IDML package for embedded resources, or the original
	// link href for linked resources. Asset resolution lives downstream.
	href: z.string().optional(),
	// true if the asset bytes are inside the IDML zip.
	embedded: z.boolean().default(false),
});

export const Frame = z.discriminatedUnion('kind', [TextFrame, ImageFrame]);

export const Page = z.object({
	id: IdmlId,
	// Page geometry in spread coordinates.
	bounds: Rect,
});

export const Spread = z.object({
	id: IdmlId,
	source: z.string(),
	pages: z.array(Page),
	frames: z.array(Frame),
	// If this spread inherits from a master, the master's id goes here.
	appliedMasterRef: IdmlId.optional(),
});

export const MasterSpread = z.object({
	id: IdmlId,
	source: z.string(),
	name: z.string(),
	pages: z.array(Page),
	frames: z.array(Frame),
});

export const ParseWarning = z.object({
	// "missing-style-ref", "unknown-element", "embedded-color-fallback", ...
	code: z.string(),
	message: z.string(),
	// Where the warning fires — file path inside the IDML, plus optional id.
	context: z.object({
		file: z.string().optional(),
		id: IdmlId.optional(),
	}).default({}),
});

export const Document = z.object({
	// Version of this IR shape. Bump when we make breaking changes downstream.
	irVersion: z.literal(1).default(1),
	// IDML metadata pulled from designmap.xml.
	meta: z.object({
		// IDML format version (e.g. "16.0").
		idmlVersion: z.string().optional(),
		// Document name if the designer set it; falls back to filename.
		name: z.string().optional(),
	}).default({}),
	// DPI used to normalize geometry. Default 96 (CSS px).
	dpi: z.number().positive(),
	swatches: z.array(Swatch),
	fonts: z.array(Font),
	styles: z.array(Style),
	stories: z.array(Story),
	spreads: z.array(Spread),
	masterSpreads: z.array(MasterSpread),
	warnings: z.array(ParseWarning).default([]),
});

/**
 * @typedef {z.infer<typeof Document>} DocumentIR
 * @typedef {z.infer<typeof Spread>} SpreadIR
 * @typedef {z.infer<typeof Frame>} FrameIR
 * @typedef {z.infer<typeof TextFrame>} TextFrameIR
 * @typedef {z.infer<typeof ImageFrame>} ImageFrameIR
 * @typedef {z.infer<typeof Story>} StoryIR
 * @typedef {z.infer<typeof Style>} StyleIR
 * @typedef {z.infer<typeof Swatch>} SwatchIR
 * @typedef {z.infer<typeof Color>} ColorIR
 * @typedef {z.infer<typeof Font>} FontIR
 * @typedef {z.infer<typeof MasterSpread>} MasterSpreadIR
 * @typedef {z.infer<typeof ParseWarning>} ParseWarningIR
 */
