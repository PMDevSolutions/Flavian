// Color helpers for the PDF operator path. These now live in the shared color
// module (../color.js) so the PDF parser, IDML parser, and token mapper share a
// single implementation; this file re-exports the device-shaped subset the PDF
// extractor and parser use. See ../color.js for the documented source-space →
// sRGB conversions (cmykToSrgb/labToSrgb) used by the mapper.

export { rgbToHex, grayToHex, cmykToHex, hexToRgb, colorDistance, nearestSwatch } from '../color.js';
