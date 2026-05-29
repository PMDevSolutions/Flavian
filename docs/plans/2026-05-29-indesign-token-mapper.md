# InDesign Token Mapper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Map a validated InDesign IR (from the IDML or PDF parser) to WordPress design tokens — a `theme.json` partial, a DTCG `design-tokens.json`, and a generator report.

**Architecture:** A new `map/` stage under `packages/pipeline/src/indesign/`. Color conversion is centralized in a shared `color.js` the parsers also use; the IR `Color` gains an optional `components` field so the mapper can convert CMYK/LAB→sRGB with out-of-gamut warnings. Output is an additive, namespaced partial deep-merged into Flavian's base theme. Full rationale: `docs/plans/2026-05-29-indesign-token-mapper-design.md`.

**Tech Stack:** Node ≥20 ESM, Zod (validation), ajv + ajv-formats (theme.json schema), `node:test`, pnpm.

**Conventions (match existing code):** tabs for indentation; JSDoc typedefs (no TS); pure, unit-testable functions; warnings via the `WarningCollector` pattern; tests in `packages/pipeline/tests/indesign/*.test.mjs` using `node:test` + `node:assert/strict`; run tests from `packages/pipeline` with `pnpm test` or a single file via `node --test tests/indesign/<file>.test.mjs`.

**Commit style:** Conventional Commits, professional tone, trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commit after each task.

---

## Task 1: Tooling — add ajv and vendor the theme.json schema

**Files:**
- Modify: `packages/pipeline/package.json` (add devDependencies)
- Create: `packages/pipeline/src/indesign/map/schema/theme-json.schema.json` (vendored, pinned)

**Step 1: Add dev dependencies**

From `packages/pipeline`:
```bash
pnpm add -D ajv ajv-formats
```
Expected: `ajv` and `ajv-formats` appear under `devDependencies`.

**Step 2: Vendor the official schema**

Download the published WordPress theme.json schema (the one the base theme references) and pin it locally:
```bash
curl -fsSL https://schemas.wp.org/trunk/theme.json -o packages/pipeline/src/indesign/map/schema/theme-json.schema.json
```
Then open the file and note its `$schema` dialect.
- If it declares draft-07 (or no `$schema`): ajv v8 handles it directly.
- If it declares draft-04: also `pnpm add -D ajv-draft-04` and use that constructor in Task 7.

Record the source URL and retrieval date in a top-of-file comment is not possible in JSON; instead add a sibling note in the Task 7 validator module.

**Step 3: Commit**
```bash
git add packages/pipeline/package.json packages/pipeline/pnpm-lock.yaml packages/pipeline/src/indesign/map/schema/theme-json.schema.json
git commit -m "build(pipeline): add ajv and vendor theme.json schema for the token mapper"
```

---

## Task 2: Extend the IR `Color` with optional `components`

**Files:**
- Modify: `packages/pipeline/src/indesign/ir.js:19-24`
- Test: `packages/pipeline/tests/indesign/ir-color.test.mjs` (new)

**Step 1: Write the failing test**

`tests/indesign/ir-color.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Color } from '../../src/indesign/ir.js';

test('Color accepts optional raw components', () => {
	const c = Color.parse({ hex: '#0066cc', space: 'RGB', components: [0, 102, 204] });
	assert.deepEqual(c.components, [0, 102, 204]);
});

test('Color still validates without components (backward compatible)', () => {
	const c = Color.parse({ hex: '#000000', space: 'CMYK' });
	assert.equal(c.components, undefined);
});
```

**Step 2: Run, expect failure**
```bash
node --test tests/indesign/ir-color.test.mjs
```
Expected: FAIL — `components` rejected as an unknown key is not the failure (zod ignores unknowns by default); the first test fails because `c.components` is `undefined`.

**Step 3: Implement**

Replace the `Color` schema body:
```js
export const Color = z.object({
	// "#RRGGBB" — the parse-time value (naive for CMYK; black for legacy LAB).
	hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
	// Source color space as declared by the document.
	space: z.enum(['RGB', 'CMYK', 'LAB', 'Spot', 'Unknown']),
	// Raw channel values in the source space's documented range, so the mapper
	// can do a proper, documented conversion to sRGB:
	//   RGB  [r,g,b]   0..255
	//   CMYK [c,m,y,k] 0..100
	//   LAB  [L,a,b]   L 0..100, a/b -128..127
	//   Gray [v]       0..255 (stored as RGB triple)
	// Optional so older IRs still validate; the mapper falls back to `hex`.
	components: z.array(z.number()).optional(),
});
```

**Step 4: Run, expect pass**
```bash
node --test tests/indesign/ir-color.test.mjs
```
Expected: PASS (2/2).

**Step 5: Commit**
```bash
git add packages/pipeline/src/indesign/ir.js packages/pipeline/tests/indesign/ir-color.test.mjs
git commit -m "feat(pipeline): add optional raw components to IR Color"
```

---

## Task 3: Shared `color.js` with documented sRGB conversion

**Files:**
- Create: `packages/pipeline/src/indesign/color.js`
- Test: `packages/pipeline/tests/indesign/color.test.mjs` (new)

This module is the single source of truth for color math. It hosts the existing primitives (moved from `pdf/color.js`) **plus** `cmykToSrgb`, `labToSrgb`, `rgbToSrgbHex`, and a `colorFromComponents` dispatcher.

**Step 1: Write the failing tests** (`tests/indesign/color.test.mjs`)
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	rgbToHex, cmykToSrgb, labToSrgb, rgbToSrgbHex, colorFromComponents,
} from '../../src/indesign/color.js';

test('rgbToSrgbHex formats 0..255 channels', () => {
	assert.equal(rgbToSrgbHex([0, 102, 204]), '#0066cc');
});

test('cmykToSrgb (0..100) matches the naive IDML preview', () => {
	// Pure black ink, no other channels.
	assert.deepEqual(cmykToSrgb([0, 0, 0, 100]), { hex: '#000000', outOfGamut: false });
	assert.deepEqual(cmykToSrgb([0, 0, 0, 0]), { hex: '#ffffff', outOfGamut: false });
	// Pure cyan.
	assert.equal(cmykToSrgb([100, 0, 0, 0]).hex, '#00ffff');
});

test('labToSrgb converts reference values (D50) within tolerance', () => {
	// L*=100,a*=0,b*=0 is white; L*=0 is black.
	assert.equal(labToSrgb([100, 0, 0]).hex, '#ffffff');
	assert.equal(labToSrgb([0, 0, 0]).hex, '#000000');
	// Mid grey L*≈53.39 → ~#777777..#808080. Assert near-grey, not exact.
	const grey = labToSrgb([53.389, 0, 0]).hex;
	assert.match(grey, /^#(7[0-9a-f]|80)\1\1$/);
});

test('labToSrgb flags out-of-gamut colors', () => {
	// A highly saturated Lab green that exceeds the sRGB gamut.
	const res = labToSrgb([87.737, -86.185, 83.181]); // sRGB green-ish, in gamut
	assert.equal(typeof res.outOfGamut, 'boolean');
	const wide = labToSrgb([50, 120, -120]); // saturated blue-magenta, out of gamut
	assert.equal(wide.outOfGamut, true);
});

test('colorFromComponents dispatches by space and falls back to hex', () => {
	assert.equal(colorFromComponents('CMYK', [0, 0, 0, 100], '#123456').hex, '#000000');
	assert.equal(colorFromComponents('RGB', [0, 102, 204], '#123456').hex, '#0066cc');
	// No components → fall back to the supplied hex.
	assert.equal(colorFromComponents('LAB', undefined, '#abcdef').hex, '#abcdef');
});
```

**Step 2: Run, expect failure** (`Cannot find module ... color.js`)
```bash
node --test tests/indesign/color.test.mjs
```

**Step 3: Implement** (`src/indesign/color.js`)

Move the existing functions from `pdf/color.js` (`hexByte`, `rgbToHex`, `grayToHex`, `cmykToHex`, `hexToRgb`, `colorDistance`, `nearestSwatch`) into this file verbatim, then add:

```js
// rgbToSrgbHex: alias of rgbToHex for callers that think in "source space".
export const rgbToSrgbHex = rgbToHex;

/**
 * Naive, profile-free CMYK→sRGB. Components in 0..100 (IDML's range).
 * Matches the parser's existing preview conversion so the same swatch lands on
 * the same hex in IR and tokens. Without an ICC profile this never clips, so
 * outOfGamut is always false (documented, not faked).
 * @param {[number, number, number, number]} cmyk
 * @returns {{ hex: string, outOfGamut: boolean }}
 */
export function cmykToSrgb([c, m, y, k]) {
	const cv = c / 100, mv = m / 100, yv = y / 100, kv = k / 100;
	const r = 255 * (1 - cv) * (1 - kv);
	const g = 255 * (1 - mv) * (1 - kv);
	const b = 255 * (1 - yv) * (1 - kv);
	return { hex: rgbToHex([r, g, b]), outOfGamut: false };
}

// CIELAB→XYZ uses D50 (InDesign/ICC connection space). The matrix below maps
// XYZ(D50)→linear sRGB with the Bradford adaptation to D65 folded in.
const D50 = { Xn: 0.9642, Yn: 1.0, Zn: 0.8249 };
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;
const XYZ_D50_TO_LINEAR_SRGB = [
	[3.1338561, -1.6168667, -0.4906146],
	[-0.9787684, 1.9161415, 0.0334540],
	[0.0719453, -0.2289914, 1.4052427],
];

function gamma(c) {
	return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * CIELAB (D50) → sRGB. L in 0..100, a/b in ~-128..127.
 * @param {[number, number, number]} lab
 * @returns {{ hex: string, outOfGamut: boolean }}
 */
export function labToSrgb([L, a, b]) {
	const fy = (L + 16) / 116;
	const fx = fy + a / 500;
	const fz = fy - b / 200;
	const fx3 = fx ** 3;
	const fz3 = fz ** 3;
	const xr = fx3 > EPS ? fx3 : (116 * fx - 16) / KAPPA;
	const yr = L > KAPPA * EPS ? fy ** 3 : L / KAPPA;
	const zr = fz3 > EPS ? fz3 : (116 * fz - 16) / KAPPA;
	const X = xr * D50.Xn, Y = yr * D50.Yn, Z = zr * D50.Zn;
	const lin = XYZ_D50_TO_LINEAR_SRGB.map(
		(row) => row[0] * X + row[1] * Y + row[2] * Z,
	);
	const outOfGamut = lin.some((v) => v < -1e-6 || v > 1 + 1e-6);
	const rgb = lin.map((v) => Math.round(gamma(Math.max(0, Math.min(1, v))) * 255));
	return { hex: rgbToHex(/** @type {[number,number,number]} */ (rgb)), outOfGamut };
}

/**
 * Convert a swatch's raw components to sRGB, dispatching on space. Falls back to
 * the supplied parse-time hex when components are absent or the space is opaque
 * (Spot/Unknown).
 * @param {import('./ir.js').ColorIR['space']} space
 * @param {number[]|undefined} components
 * @param {string} fallbackHex
 * @returns {{ hex: string, outOfGamut: boolean }}
 */
export function colorFromComponents(space, components, fallbackHex) {
	if (components && components.length) {
		if (space === 'RGB' && components.length >= 3) return { hex: rgbToSrgbHex(/** @type {any} */ (components)), outOfGamut: false };
		if (space === 'CMYK' && components.length >= 4) return cmykToSrgb(/** @type {any} */ (components));
		if (space === 'LAB' && components.length >= 3) return labToSrgb(/** @type {any} */ (components));
	}
	return { hex: fallbackHex, outOfGamut: false };
}
```

Add a `ColorIR` typedef to `ir.js` JSDoc block (`@typedef {z.infer<typeof Color>} ColorIR`).

**Step 4: Run, expect pass**
```bash
node --test tests/indesign/color.test.mjs
```
Expected: PASS. If the mid-grey or out-of-gamut assertions are too tight, adjust the fixtures (not the math) — keep at least one exact white/black and one out-of-gamut=true case.

**Step 5: Commit**
```bash
git add packages/pipeline/src/indesign/color.js packages/pipeline/src/indesign/ir.js packages/pipeline/tests/indesign/color.test.mjs
git commit -m "feat(pipeline): centralized color module with CMYK/LAB to sRGB conversion"
```

---

## Task 4: Route parsers through `color.js` + populate `components`

**Files:**
- Modify: `packages/pipeline/src/indesign/pdf/color.js` (re-export shared primitives)
- Modify: `packages/pipeline/src/indesign/parsers/resources.js` (IDML: use shared module, attach components, fix LAB)
- Modify: `packages/pipeline/src/indesign/pdf/extract.js` (capture raw color in colorSamples)
- Modify: `packages/pipeline/src/indesign/parse-pdf.js` (thread components into synthesized swatches)
- Test: `packages/pipeline/tests/indesign/parser-color-components.test.mjs` (new)

**Step 1: Write the failing test**
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGraphic } from '../../src/indesign/parsers/resources.js';
import { WarningCollector } from '../../src/indesign/warnings.js';

function graphic(xml) { return xml; }

test('IDML LAB swatch converts to a real (non-black) color with components', () => {
	const warnings = new WarningCollector();
	const xml = `<idPkg:Graphic><Color Self="c1" Name="Lab Red" Space="LAB" ColorValue="54 81 70"/></idPkg:Graphic>`;
	const [sw] = parseGraphic(xml, warnings);
	assert.equal(sw.color.space, 'LAB');
	assert.deepEqual(sw.color.components, [54, 81, 70]);
	assert.notEqual(sw.color.hex, '#000000');
});

test('IDML CMYK swatch keeps components in 0..100', () => {
	const warnings = new WarningCollector();
	const xml = `<idPkg:Graphic><Color Self="c2" Name="Ink" Space="CMYK" ColorValue="0 0 0 100"/></idPkg:Graphic>`;
	const [sw] = parseGraphic(xml, warnings);
	assert.deepEqual(sw.color.components, [0, 0, 0, 100]);
	assert.equal(sw.color.hex, '#000000');
});
```
(Confirm the XML attribute form `Self`/`Name`/`Space`/`ColorValue` matches `parseXml`'s `@`-prefix handling — `parseGraphic` reads `@Self` etc. The fast-xml-parser config maps attributes to `@name`; verify against `xml.js` and adjust the fixture if attributes need a namespace.)

**Step 2: Run, expect failure**
```bash
node --test tests/indesign/parser-color-components.test.mjs
```

**Step 3: Implement**

`pdf/color.js` — replace the bodies with re-exports so existing imports/tests keep working:
```js
// Re-exported from the shared color module so the PDF extractor and the mapper
// share one implementation. See ../color.js.
export { rgbToHex, grayToHex, cmykToHex, hexToRgb, colorDistance, nearestSwatch } from '../color.js';
```
> `cmykToHex` keeps its existing 0..1 signature for the PDF operator path — keep that function in `color.js` alongside the new `cmykToSrgb` (0..100). Document both ranges.

`parsers/resources.js` — rewrite `toIrColor` to attach components and convert via the shared module:
```js
import { rgbToSrgbHex, cmykToSrgb, labToSrgb } from '../color.js';
// ...
function toIrColor(spaceRaw, values, warnings, id) {
	const space = normalizeColorSpace(spaceRaw);
	if (space === 'RGB' && values.length === 3) {
		return { hex: rgbToSrgbHex(values), space, components: values };
	}
	if (space === 'CMYK' && values.length === 4) {
		return { hex: cmykToSrgb(values).hex, space, components: values };
	}
	if (space === 'LAB' && values.length === 3) {
		const { hex, outOfGamut } = labToSrgb(values);
		if (outOfGamut) {
			warnings.add('color-out-of-gamut', `Swatch ${id} LAB color is outside the sRGB gamut; clamped`, { file: 'Resources/Graphic.xml', id });
		}
		return { hex, space, components: values };
	}
	warnings.add('color-fallback', `Swatch ${id} has unsupported color space "${spaceRaw}" with ${values.length} values; defaulted to black`, { file: 'Resources/Graphic.xml', id });
	return { hex: '#000000', space: 'Unknown' };
}
```
Delete the now-unused local `rgbToHex`/`cmykToHexApprox` (or keep `normalizeColorSpace`). Keep `normalizeColorSpace`.

`pdf/extract.js` — capture the raw color, not just hex. Track a `fillColor` object next to `fillHex`:
```js
let fillColor = { space: 'RGB', components: [0, 0, 0] };
// setFillRGBColor:
fillHex = rgbToHex([args[0], args[1], args[2]]);
fillColor = { space: 'RGB', components: [args[0], args[1], args[2]] };
// setFillGray:
fillHex = grayToHex(args[0]);
fillColor = { space: 'RGB', components: [args[0], args[0], args[0]] };
// setFillCMYKColor (pdfjs gives 0..1 → store 0..100 to match IR convention):
fillHex = cmykToHex([args[0], args[1], args[2], args[3]]);
fillColor = { space: 'CMYK', components: [args[0] * 100, args[1] * 100, args[2] * 100, args[3] * 100] };
// in the showText sample push:
colorSamples.push({ fontSizePt: currentSize, hex: fillHex, space: fillColor.space, components: fillColor.components, glyphs });
```
Update the JSDoc `colorSamples` shape accordingly.

`parse-pdf.js` — thread components into the synthesized (non-snapped) swatch:
```js
swatches.push({ id, name: sample.hex.toUpperCase(), color: { hex: sample.hex, space: sample.space ?? 'RGB', components: sample.components } });
```

**Step 4: Run the full pipeline test suite, expect pass**
```bash
pnpm test
```
Expected: all existing tests still pass (including `pdf-color.test.mjs`, `pdf-roundtrip.test.mjs`) plus the new parser-color test. If `pdf-roundtrip` asserts swatch color equality, components are additive and should not break it; if it deep-equals whole color objects, update the expected fixture to include components.

**Step 5: Commit**
```bash
git add packages/pipeline/src/indesign/pdf/color.js packages/pipeline/src/indesign/parsers/resources.js packages/pipeline/src/indesign/pdf/extract.js packages/pipeline/src/indesign/parse-pdf.js packages/pipeline/tests/indesign/parser-color-components.test.mjs
git commit -m "feat(pipeline): populate raw color components and fix LAB swatch conversion"
```

---

## Task 5: Color mapping module (`map/colors.js`)

**Files:**
- Create: `packages/pipeline/src/indesign/map/colors.js`
- Test: `packages/pipeline/tests/indesign/map-colors.test.mjs`

**Behavior:** `mapColors(swatches, { basePalette, tolerance, namespace, warnings }) → { palette, swatchToSlug }`.
- Recompute hex via `colorFromComponents(space, components, hex)`.
- Dedupe by hex within `tolerance` (squared RGB distance via `colorDistance`); first/most-named wins.
- Reuse a base slug when a swatch is within `tolerance` of a base color; else namespaced slug `slugify(name)` prefixed with `namespace` when it would collide.
- Emit `color-out-of-gamut` (already from parser for LAB) and `swatch-approximated` (Spot/Unknown) warnings into the report.

**Step 1: Failing test** (representative)
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapColors } from '../../src/indesign/map/colors.js';

const base = [{ slug: 'primary', color: '#0b5cff', name: 'Primary' }];

test('includes all distinct swatches, deduped within tolerance', () => {
	const swatches = [
		{ id: 's1', name: 'Brand Blue', color: { hex: '#0066cc', space: 'RGB', components: [0, 102, 204] } },
		{ id: 's2', name: 'Brand Blue Dup', color: { hex: '#0265cb', space: 'RGB', components: [2, 101, 203] } },
		{ id: 's3', name: 'Ink', color: { hex: '#111111', space: 'CMYK', components: [0, 0, 0, 93] } },
	];
	const { palette, swatchToSlug } = mapColors(swatches, { basePalette: base, tolerance: 24 * 24 * 3 });
	// s1 and s2 collapse to one entry; ink is separate → 2 derived entries.
	assert.equal(palette.length, 2);
	assert.equal(swatchToSlug.s1, swatchToSlug.s2);
});

test('reuses a base slug when close, instead of duplicating', () => {
	const swatches = [{ id: 's1', name: 'Almost Primary', color: { hex: '#0b5dff', space: 'RGB', components: [11, 93, 255] } }];
	const { palette, swatchToSlug } = mapColors(swatches, { basePalette: base, tolerance: 24 * 24 * 3 });
	assert.equal(swatchToSlug.s1, 'primary');
	assert.equal(palette.length, 0); // nothing new to add; it maps onto the base
});
```

**Step 2–4:** Run (fail) → implement `mapColors` + a small `slugify` helper (lowercase, `[^a-z0-9]+`→`-`, trim) → run (pass).

**Step 5: Commit** `feat(pipeline): map IDML swatches to a deduped theme.json color palette`.

---

## Task 6: Typography module (`map/typography.js`)

**Files:**
- Create: `packages/pipeline/src/indesign/map/typography.js`
- Test: `packages/pipeline/tests/indesign/map-typography.test.mjs`

**Behavior:** `mapTypography(styles, { baseFontSizes, swatchToSlug, fontToSlug, tolerancePx, fluidThresholdPx, namespace }) → { fontSizes, elements, styleToSlug }`.
- Filter `kind === 'paragraph'` with a numeric `fontSize`.
- Cluster sizes within `tolerancePx` (default 1px); representative = rounded mean.
- px→rem (`size / 16` with up to 3 decimals); if `>= fluidThresholdPx` and `fluid` enabled, emit a `clamp()` mirroring the base pattern (min = 0.85×, preferred = `Nvw`, max = size).
- Reuse base `fontSizes` slug when the representative px is within `tolerancePx` of the base slug's nominal px (resolve base sizes: parse `rem`→px×16; for `clamp(min,pref,max)` use the `max`).
- Else derived slug from the InDesign style name (slugified, namespaced on collision). Token `name` = InDesign style name.
- `elements`: map common heading/body style names to h1–h6/p/caption when recognizable; otherwise attach by size rank. Each element entry carries `fontSize` (var ref), `lineHeight` (from `leading/fontSize`), `letterSpacing` (from `tracking/1000`em), and text color (from `fillColorRef`→`swatchToSlug`).
- `styleToSlug`: every input paragraph style → its scale slug (proves "each entry referenced by ≥1 style").

**Step 1: Failing test** (representative)
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTypography } from '../../src/indesign/map/typography.js';

const baseFontSizes = [
	{ slug: 'base', size: '1rem' },        // 16px
	{ slug: 'display', size: 'clamp(2.25rem, 5vw, 3.5rem)' }, // 56px max
];

test('clusters near-equal sizes and references every entry by a style', () => {
	const styles = [
		{ id: 'p1', name: 'Body', kind: 'paragraph', fontSize: 16 },
		{ id: 'p2', name: 'Body Alt', kind: 'paragraph', fontSize: 16.4 },
		{ id: 'p3', name: 'Title', kind: 'paragraph', fontSize: 56 },
	];
	const { fontSizes, styleToSlug } = mapTypography(styles, { baseFontSizes, tolerancePx: 1 });
	// 16/16.4 reuse base 'base'; 56 reuses base 'display' → no new entries.
	assert.equal(styleToSlug.p1, 'base');
	assert.equal(styleToSlug.p2, 'base');
	assert.equal(styleToSlug.p3, 'display');
	for (const entry of fontSizes) {
		const referenced = Object.values(styleToSlug).includes(entry.slug);
		assert.ok(referenced, `font size ${entry.slug} must be referenced by a style`);
	}
});

test('creates a derived slug for a size with no base match', () => {
	const styles = [{ id: 'p1', name: 'Lead', kind: 'paragraph', fontSize: 21 }];
	const { fontSizes, styleToSlug } = mapTypography(styles, { baseFontSizes, tolerancePx: 1, namespace: 'id' });
	assert.equal(fontSizes.length, 1);
	assert.equal(styleToSlug.p1, fontSizes[0].slug);
	assert.equal(fontSizes[0].name, 'Lead');
});
```

**Step 2–4:** Run (fail) → implement (factor out a `resolveBasePx(sizeString)` helper that parses `rem`/`px`/`clamp(...)`) → run (pass).

**Step 5: Commit** `feat(pipeline): cluster paragraph styles into a theme.json typography scale`.

---

## Task 7: theme.json assembly, deep-merge, and validation (`map/theme-json.js` + `schema/partial.zod.js`)

**Files:**
- Create: `packages/pipeline/src/indesign/map/theme-json.js`
- Create: `packages/pipeline/src/indesign/map/schema/partial.zod.js`
- Test: `packages/pipeline/tests/indesign/map-theme-json.test.mjs`

**Behavior:**
- `assemblePartial({ palette, fontSizes, fontFamilies, spacingSizes, elements }) → themeJsonPartial` (version 3, `settings`/`styles` only for the keys we emit).
- `mergeThemeJson(base, partial) → merged` — recursive object merge; token arrays under `color.palette`, `typography.fontSizes`, `typography.fontFamilies`, `spacing.spacingSizes` merge **by `slug`** (partial overrides/extends; namespacing prevents clobber).
- `validateThemeJson(themeJson) → { valid, errors }` — ajv against the vendored schema (configure dialect per Task 1) **and** the zod partial schema. Add a top-of-file comment recording the schema source URL + retrieval date.

**Step 1: Failing tests**
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assemblePartial, mergeThemeJson, validateThemeJson } from '../../src/indesign/map/theme-json.js';

const base = JSON.parse(readFileSync(new URL('../../../../themes/flavian-shop/theme.json', import.meta.url)));

test('assembled partial validates against the WordPress schema', () => {
	const partial = assemblePartial({
		palette: [{ slug: 'id-brand-blue', color: '#0066cc', name: 'Brand Blue' }],
		fontSizes: [{ slug: 'id-lead', size: '1.3125rem', name: 'Lead' }],
		fontFamilies: [], spacingSizes: [], elements: {},
	});
	const { valid, errors } = validateThemeJson(partial);
	assert.ok(valid, JSON.stringify(errors));
});

test('merge keeps base tokens and adds namespaced derived tokens', () => {
	const partial = assemblePartial({
		palette: [{ slug: 'id-brand-blue', color: '#0066cc', name: 'Brand Blue' }],
		fontSizes: [], fontFamilies: [], spacingSizes: [], elements: {},
	});
	const merged = mergeThemeJson(base, partial);
	const slugs = merged.settings.color.palette.map((p) => p.slug);
	assert.ok(slugs.includes('primary'));      // base preserved
	assert.ok(slugs.includes('id-brand-blue')); // derived added
	assert.ok(validateThemeJson(merged).valid);
});
```

**Step 2–4:** Run (fail) → implement. ajv setup:
```js
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from './schema/theme-json.schema.json' with { type: 'json' };
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
```
(If the schema is draft-04, swap to `ajv-draft-04`.) Run (pass).

**Step 5: Commit** `feat(pipeline): assemble, deep-merge, and validate theme.json partials`.

---

## Task 8: Spacing module (`map/spacing.js`)

**Files:**
- Create: `packages/pipeline/src/indesign/map/spacing.js`
- Test: `packages/pipeline/tests/indesign/map-spacing.test.mjs`

**Behavior:** `mapSpacing(ir, { gridPx, maxSizes, namespace, warnings }) → { spacingSizes }`.
- Collect candidate px values: page-margin offsets (`page.bounds` vs contained `frame.bounds`), inter-frame gaps (sort frames per spread, adjacent gaps), paragraph `properties.SpaceBefore`/`SpaceAfter`/`spaceBefore`/`spaceAfter` (convert via `lengthToPx` when stringy, else assume already px).
- Quantize to `gridPx` (default 4), drop ≤0, dedupe, sort ascending, cap to `maxSizes` (default 8), rank-name (`slug = ${namespace}-space-${i*10}`, `size = px/16 + 'rem'`).
- Add a `spacing-approximate` warning when values came from PDF geometry.

**Step 1: Failing test**
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSpacing } from '../../src/indesign/map/spacing.js';

test('quantizes observed gaps to the grid and dedupes', () => {
	const ir = {
		dpi: 96,
		spreads: [{
			id: 'sp1', source: 's', pages: [{ id: 'pg', bounds: { x: 0, y: 0, width: 600, height: 800 } }],
			frames: [
				{ kind: 'text', id: 'f1', bounds: { x: 48, y: 50, width: 500, height: 100 } },
				{ kind: 'text', id: 'f2', bounds: { x: 48, y: 170, width: 500, height: 100 } }, // 20px gap
			],
		}],
		styles: [{ id: 'p1', name: 'Body', kind: 'paragraph', properties: { SpaceAfter: '12pt' } }],
		masterSpreads: [], swatches: [], fonts: [], stories: [],
	};
	const { spacingSizes } = mapSpacing(ir, { gridPx: 4 });
	const rems = spacingSizes.map((s) => s.size);
	assert.ok(rems.includes('1.25rem')); // 20px → 1.25rem
	assert.ok(spacingSizes.length <= 8);
});
```

**Step 2–4:** Run (fail) → implement → run (pass).

**Step 5: Commit** `feat(pipeline): derive a quantized spacing scale from IR geometry`.

---

## Task 9: Font mapping (`map/fonts.js` + `config/font-map.json`)

**Files:**
- Create: `packages/pipeline/config/font-map.json`
- Create: `packages/pipeline/src/indesign/map/fonts.js`
- Test: `packages/pipeline/tests/indesign/map-fonts.test.mjs`

**`config/font-map.json`** — seed with common families:
```json
{
	"Helvetica": { "fontFamily": "Helvetica, Arial, sans-serif", "source": "system", "fallback": "sans-serif" },
	"Helvetica Neue": { "fontFamily": "'Helvetica Neue', Helvetica, Arial, sans-serif", "source": "system", "fallback": "sans-serif" },
	"Arial": { "fontFamily": "Arial, Helvetica, sans-serif", "source": "system", "fallback": "sans-serif" },
	"Georgia": { "fontFamily": "Georgia, 'Times New Roman', serif", "source": "system", "fallback": "serif" },
	"Times": { "fontFamily": "'Times New Roman', Times, serif", "source": "system", "fallback": "serif" },
	"Times New Roman": { "fontFamily": "'Times New Roman', Times, serif", "source": "system", "fallback": "serif" },
	"Courier": { "fontFamily": "'Courier New', Courier, monospace", "source": "system", "fallback": "monospace" },
	"Merriweather": { "fontFamily": "Merriweather, Georgia, serif", "source": "google", "googleFontName": "Merriweather", "fallback": "serif" },
	"Roboto": { "fontFamily": "Roboto, system-ui, sans-serif", "source": "google", "googleFontName": "Roboto", "fallback": "sans-serif" },
	"Open Sans": { "fontFamily": "'Open Sans', system-ui, sans-serif", "source": "google", "googleFontName": "Open Sans", "fallback": "sans-serif" },
	"Lato": { "fontFamily": "Lato, system-ui, sans-serif", "source": "google", "googleFontName": "Lato", "fallback": "sans-serif" },
	"Montserrat": { "fontFamily": "Montserrat, system-ui, sans-serif", "source": "google", "googleFontName": "Montserrat", "fallback": "sans-serif" }
}
```

**Behavior:** `mapFonts(fonts, { fontMap, baseFontFamilies, namespace, warnings }) → { fontFamilies, fontToSlug }`.
- For each distinct family: look up in `fontMap`. Found → reuse a base family slug when its stack matches a base entry; else namespaced slug, `name` = family, `fontFamily` = mapped stack (+ `googleFontName`/`source` carried for the generator's webfont step in a `_provenance`-free way — keep theme.json entries schema-clean; record google info in the report instead).
- Not found → `font-fallback` warning + heuristic generic (`/serif/i`→serif, `/mono|courier|consol/i`→monospace, else sans-serif), map onto the matching base slug (`sans`/`serif`) when present.
- `loadFontMap(path)` helper reads + JSON-parses the config, defaulting to the shipped file.

**Step 1: Failing test**
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapFonts } from '../../src/indesign/map/fonts.js';

const baseFamilies = [
	{ slug: 'sans', name: 'Sans', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
	{ slug: 'serif', name: 'Serif', fontFamily: "Georgia, 'Times New Roman', serif" },
];
const fontMap = { Georgia: { fontFamily: "Georgia, 'Times New Roman', serif", source: 'system', fallback: 'serif' } };

test('maps a known family and warns + falls back for an unknown one', () => {
	const warnings = [];
	const fonts = [
		{ id: 'f1', family: 'Georgia', style: 'Regular' },
		{ id: 'f2', family: 'Bell Gothic', style: 'Bold' },
	];
	const { fontToSlug } = mapFonts(fonts, { fontMap, baseFontFamilies: baseFamilies, warnings: { add: (code, msg) => warnings.push({ code, msg }) } });
	assert.equal(fontToSlug.f1, 'serif'); // matches base serif stack
	assert.ok(warnings.some((w) => w.code === 'font-fallback' && /Bell Gothic/.test(w.msg)));
	assert.equal(fontToSlug.f2, 'sans'); // heuristic generic
});
```

**Step 2–4:** Run (fail) → implement → run (pass).

**Step 5: Commit** `feat(pipeline): map InDesign fonts to web families with a fallback table`.

---

## Task 10: DTCG design-tokens emitter (`map/design-tokens.js`)

**Files:**
- Create: `packages/pipeline/src/indesign/map/design-tokens.js`
- Test: `packages/pipeline/tests/indesign/map-design-tokens.test.mjs`

**Behavior:** `toDesignTokens({ palette, fontSizes, fontFamilies, spacingSizes }) → dtcg` with groups `color`/`fontSize`/`fontFamily`/`spacing`, each leaf `{ $value, $type, $description }`. `$type`: color→`color`, fontSize/spacing→`dimension`, fontFamily→`fontFamily`.

**Step 1: Failing test**
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDesignTokens } from '../../src/indesign/map/design-tokens.js';

test('emits DTCG-shaped tokens with type and value', () => {
	const dtcg = toDesignTokens({
		palette: [{ slug: 'id-brand', color: '#0066cc', name: 'Brand' }],
		fontSizes: [{ slug: 'id-lead', size: '1.3125rem', name: 'Lead' }],
		fontFamilies: [], spacingSizes: [],
	});
	assert.equal(dtcg.color['id-brand'].$value, '#0066cc');
	assert.equal(dtcg.color['id-brand'].$type, 'color');
	assert.equal(dtcg.fontSize['id-lead'].$type, 'dimension');
});
```

**Step 2–4:** Run (fail) → implement → run (pass).

**Step 5: Commit** `feat(pipeline): emit Style Dictionary (DTCG) design tokens`.

---

## Task 11: Orchestrator + report (`map/index.js` + `map/report.js`)

**Files:**
- Create: `packages/pipeline/src/indesign/map/report.js`
- Create: `packages/pipeline/src/indesign/map/index.js`
- Modify: `packages/pipeline/src/indesign/index.js` (export `mapTokens`)
- Test: `packages/pipeline/tests/indesign/map-tokens.test.mjs`

**Behavior:** `mapTokens(ir, options) → { partial, designTokens, merged, report }`.
- Order: colors → fonts → typography (needs swatchToSlug + fontToSlug) → spacing → assemble partial → merge with base → design tokens → report.
- `report`: `{ warnings: [...irWarnings, ...mapperWarnings], provenance: { swatchToSlug, styleToSlug, fontToSlug }, fontFallbacks: [...], outOfGamut: [...] }`.
- `options`: `{ base, fontMap, tolerance, gridPx, fluid, namespace }` with sensible defaults (base = bundled flavian-shop theme via `loadBaseTheme()`; namespace derived from `ir.meta.name` slug or `'id'`).

**Step 1: Failing e2e test** — build an IR with the IDML helper *and* the PDF helper, run `mapTokens` on each, assert artifacts and acceptance invariants:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTokens } from '../../src/indesign/map/index.js';
import { parseIdmlBuffer } from '../../src/indesign/parse-idml.js';
import { buildHappyPath } from './helpers/build-idml.js'; // confirm exact export name

test('maps an IDML-derived IR into validated tokens', () => {
	const ir = parseIdmlBuffer(buildHappyPath());
	const { partial, designTokens, merged, report } = mapTokens(ir);
	assert.ok(merged.settings.color.palette.length > 0);
	// Every typography entry is referenced by a paragraph style.
	const referenced = new Set(Object.values(report.provenance.styleToSlug));
	for (const e of partial.settings.typography?.fontSizes ?? []) assert.ok(referenced.has(e.slug));
	assert.ok(designTokens.color);
});
```
(Confirm helper export names by reading `tests/indesign/helpers/build-idml.js` and `build-pdf.js`; add a PDF-IR variant of the test — the PDF helper is async via `parsePdfBuffer`.)

**Step 2–4:** Run (fail) → implement orchestrator + report → run (pass).

**Step 5: Commit** `feat(pipeline): mapTokens orchestrator producing theme.json, tokens, and report`.

---

## Task 12: CLI (`bin/map-tokens.mjs`)

**Files:**
- Create: `packages/pipeline/bin/map-tokens.mjs`
- Modify: `packages/pipeline/package.json` (`bin` entry, optional)
- Test: covered via the library; optionally a smoke test that spawns the CLI.

**Behavior:** Read IR JSON from a path or stdin (`-`); if the path ends `.idml`/`.pdf`, parse it first. Options `--out-dir`, `--base`, `--font-map`, `--grid`, `--tolerance`, `--fluid`, `--quiet`, `-h`. Write the partial to stdout; warnings/report summary to stderr; when `--out-dir` is set, write `theme.partial.json`, `design-tokens.json`, `theme.merged.json`, and `report.json`. Mirror the arg-parsing + exit-code style of `bin/parse-idml.mjs`.

**Step 1–4:** Implement; verify manually:
```bash
node packages/pipeline/bin/parse-idml.mjs <some.idml> | node packages/pipeline/bin/map-tokens.mjs --out-dir ./tmp-tokens
```
Expected: partial JSON on stdout; four files in `./tmp-tokens`; report summary on stderr. (Use a fixture-built IR if no real IDML is handy: `node -e` to emit one, or pipe a saved IR JSON.)

**Step 5: Commit** `feat(pipeline): add map-tokens CLI`.

---

## Task 13: Docs + final verification + PR

**Files:**
- Create: `docs/pipeline/indesign-token-mapper.md`
- Modify: `packages/pipeline/README.md` (link the new stage), `CLAUDE.md` quick-reference if warranted.

**Steps:**
1. Write `docs/pipeline/indesign-token-mapper.md` matching the fidelity-guide style: overview, CLI usage, conversion math (CMYK note + LAB pipeline), config (`font-map.json`), warnings table (`color-out-of-gamut`, `font-fallback`, `spacing-approximate`, `swatch-approximated`), merge semantics, and acceptance-criteria mapping.
2. Run the full suite + confirm clean:
   ```bash
   pnpm --filter @flavian/pipeline test
   ```
   Expected: all tests pass.
3. Verify acceptance criteria one by one against the design doc table.
4. Commit docs: `docs(pipeline): document the InDesign token mapper`.
5. Push the branch and open a PR (per project convention — always push + PR when finishing):
   ```bash
   git push -u origin 64-indesign-pipeline-style-and-design-token-mapper-paragraphcharacter-styles-swatches-themejson
   gh pr create --fill --base main
   ```
   PR body: summary, the four design decisions, acceptance-criteria checklist, test plan, and `Closes #64`. End with the Claude Code attribution line.

---

## Acceptance criteria → task coverage

| Criterion | Task(s) |
|-----------|---------|
| theme.json validates against WP schema | 1, 7 |
| Palette includes all distinct swatches, deduped by hex tolerance | 5 |
| Each typography entry referenced by ≥1 paragraph style | 6, 11 |
| Font fallback warnings emitted + in report | 9, 11 |
| Tests: CMYK→sRGB fixtures, clustering, merge-with-base | 3, 6, 7 |
| Works on either IR (IDML or PDF) | 4, 11 |

## Risks / watch-items
- **Schema dialect:** the vendored WP schema may be draft-04 → use `ajv-draft-04` (Task 1/7).
- **fast-xml-parser attribute keys:** confirm the `@`-prefix + namespace handling when writing the IDML color fixture (Task 4) by checking `parsers/xml.js`.
- **pdf-roundtrip fixture:** adding `components` is additive but check any deep-equality on color objects (Task 4).
- **Base theme path** resolution in tests uses `import.meta.url`; keep the relative depth correct (`packages/pipeline/tests/indesign` → repo `themes/flavian-shop/theme.json`).
