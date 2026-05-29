// Zod schema for the subset of theme.json the mapper emits. Validates the token
// shapes we generate while passing through everything else (so it also accepts a
// full base theme merged with our partial). Complements the ajv check against
// the official schema.

import { z } from 'zod';

const ColorToken = z.object({
	slug: z.string(),
	color: z.string(),
	name: z.string().optional(),
}).passthrough();

const SizeToken = z.object({
	slug: z.string(),
	size: z.union([z.string(), z.number()]),
	name: z.string().optional(),
}).passthrough();

const FamilyToken = z.object({
	slug: z.string(),
	fontFamily: z.string(),
	name: z.string().optional(),
}).passthrough();

export const partialThemeSchema = z.object({
	version: z.literal(3).optional(),
	settings: z.object({
		color: z.object({ palette: z.array(ColorToken).optional() }).passthrough().optional(),
		typography: z.object({
			fontSizes: z.array(SizeToken).optional(),
			fontFamilies: z.array(FamilyToken).optional(),
		}).passthrough().optional(),
		spacing: z.object({ spacingSizes: z.array(SizeToken).optional() }).passthrough().optional(),
	}).passthrough().optional(),
	styles: z.object({}).passthrough().optional(),
}).passthrough();
