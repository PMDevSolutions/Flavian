// Canva starter generator.
//
// Unlike the `figma` starter (which only stages a NEXT-STEPS.md), the Canva path
// produces a *working* FSE theme deterministically from an HTML/CSS export so CI
// and scripted setups can run it with no prompts. It does this by composing the
// same deterministic helper scripts the canva-fse-converter agent relies on:
//
//   1. Copy the blank FSE theme as a valid base scaffold.
//   2. parse-canva-export.sh  → design tokens merged into theme.json.
//   3. convert-html-to-blocks.sh → page content written as a pattern, wired into
//      templates/front-page.html (pattern-first: PHP/images live in the pattern,
//      never in the .html template).
//
// The result is a deterministic baseline. The canva-fse-converter agent / the
// canva-to-fse-autonomous-workflow skill refine it into production output.

import { readdir, readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyBlankBase } from './theme.mjs';

const exec = promisify(execFile);

// The canva-fse helper scripts belong to the wizard's own repo (not the target
// project), so resolve them relative to this module.
const SCRIPT = (name) => fileURLToPath(new URL(`../../canva-fse/${name}`, import.meta.url));
const PARSE_SCRIPT = SCRIPT('parse-canva-export.sh');
const CONVERT_SCRIPT = SCRIPT('convert-html-to-blocks.sh');

const PATTERN_SLUG = 'canva-content';
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.ico']);

// --- pure helpers (unit-tested) -------------------------------------------

/** Keep the first entry per slug, preserving order. */
export function dedupeBySlug(items) {
  const seen = new Set();
  const out = [];
  for (const item of items ?? []) {
    if (!item || seen.has(item.slug)) continue;
    seen.add(item.slug);
    out.push(item);
  }
  return out;
}

/** Relative luminance (0–255) of a #rgb / #rrggbb color; null if unparseable. */
export function luminance(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Choose background (lightest) and text (darkest) slugs from a palette so the
 * theme's default colors reflect the Canva design. Returns null when fewer than
 * two usable, distinct colors exist (caller falls back gracefully).
 */
export function pickContrastColors(palette) {
  const scored = (palette ?? [])
    .map(c => ({ slug: c.slug, lum: luminance(c.color) }))
    .filter(c => c.lum !== null);
  if (scored.length < 2) return null;
  let lightest = scored[0];
  let darkest = scored[0];
  for (const c of scored) {
    if (c.lum > lightest.lum) lightest = c;
    if (c.lum < darkest.lum) darkest = c;
  }
  if (lightest.slug === darkest.slug) return null;
  return { backgroundSlug: lightest.slug, textSlug: darkest.slug };
}

const presetVar = (kind, slug) => `var(--wp--preset--${kind}--${slug})`;

/**
 * Merge Canva-extracted tokens into a base theme.json object. Replaces token
 * arrays where Canva provided values, and rewrites the `styles` references that
 * would otherwise dangle (the base uses slugs like `surface`/`system` that the
 * replacement removes). Returns a new object; does not mutate `base`.
 */
export function mergeCanvaTokens(base, tokens) {
  const out = structuredClone(base);
  out.settings ??= {};
  const colors = dedupeBySlug(tokens.colors);
  const fonts = dedupeBySlug(tokens.fonts);
  const fontSizes = dedupeBySlug(tokens.fontSizes);
  const spacing = dedupeBySlug(tokens.spacing);

  if (colors.length) {
    out.settings.color = { ...(out.settings.color ?? {}), palette: colors };
    out.styles ??= {};
    const contrast = pickContrastColors(colors);
    out.styles.color = contrast
      ? {
          background: presetVar('color', contrast.backgroundSlug),
          text: presetVar('color', contrast.textSlug),
        }
      : { text: presetVar('color', colors[0].slug) };
  }

  if (fonts.length) {
    out.settings.typography = { ...(out.settings.typography ?? {}), fontFamilies: fonts };
    out.styles ??= {};
    out.styles.typography = {
      ...(out.styles.typography ?? {}),
      fontFamily: presetVar('font-family', fonts[0].slug),
    };
  }

  if (fontSizes.length) {
    out.settings.typography = { ...(out.settings.typography ?? {}), fontSizes };
  }

  if (spacing.length) {
    out.settings.spacing = { ...(out.settings.spacing ?? {}), spacingSizes: spacing };
  }

  return out;
}

/**
 * Strip the leading HTML-document chrome (DOCTYPE/head/body…) the converter
 * echoes verbatim, keeping the block markup from the first `<!-- wp:` onward.
 */
export function cleanConvertedBlocks(output) {
  const lines = String(output).split('\n');
  const start = lines.findIndex(l => l.trimStart().startsWith('<!-- wp:'));
  const kept = start >= 0 ? lines.slice(start) : lines;
  return kept.join('\n').replace(/\s+$/, '');
}

/**
 * Rewrite relative `<img src>` values to theme-asset URIs (the reason converted
 * content must live in a PHP pattern, not an .html template). Absolute URLs,
 * root-relative and data: srcs are left untouched. Returns the rewritten markup
 * plus the set of relative asset paths to copy into the theme.
 */
export function rewriteImageSrcs(markup) {
  const assets = new Set();
  const out = String(markup).replace(/(<img\b[^>]*?\bsrc=")([^"]+)(")/gi, (m, pre, src, post) => {
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('/') || src.startsWith('data:') || src.includes('<?php')) {
      return m;
    }
    assets.add(src);
    const safe = src.replace(/'/g, '');
    return `${pre}<?php echo esc_url( get_theme_file_uri( 'assets/${safe}' ) ); ?>${post}`;
  });
  return { markup: out, assets: [...assets] };
}

/** Slug → PascalCase package name (`my-shop` → `MyShop`). */
export function packageName(slug) {
  return String(slug)
    .split('-')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join('') || 'Theme';
}

function patternFile(slug, markup) {
  const pkg = packageName(slug);
  return `<?php
/**
 * Title: Canva Content
 * Slug: ${slug}/${PATTERN_SLUG}
 * Categories: featured
 * Description: Homepage content imported from a Canva export by the Flavian init wizard. Refine with the canva-fse-converter agent for production.
 *
 * @package ${pkg}
 */

?>
${markup}
`;
}

function frontPageTemplate(slug) {
  return `<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:pattern {"slug":"${slug}/${PATTERN_SLUG}"} /-->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
`;
}

function nextSteps(slug) {
  return `# Next Steps — Canva Import

The Flavian init wizard generated a working FSE theme from your Canva export:

- Design tokens (colors, typography, spacing) were extracted from your CSS into \`themes/${slug}/theme.json\`.
- Your exported page content was converted to WordPress blocks in
  \`themes/${slug}/patterns/${PATTERN_SLUG}.php\` and wired into \`templates/front-page.html\`.
- Referenced images were copied into \`themes/${slug}/assets/\`.

This is a deterministic baseline. For a production-quality pass (layout,
semantics, responsiveness), point Claude Code at your export directory:

> "Convert this Canva export to a WordPress theme"

…which runs the \`canva-fse-converter\` agent / \`canva-to-fse-autonomous-workflow\` skill.
`;
}

// --- script bridges -------------------------------------------------------

async function runScript(scriptPath, args) {
  try {
    const { stdout } = await exec('bash', [scriptPath, ...args], { maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('The Canva starter needs `bash` on PATH (it runs scripts/canva-fse/*.sh).');
    }
    const detail = (err.stderr || err.message || '').trim();
    throw new Error(`Canva conversion script failed (${scriptPath}): ${detail}`);
  }
}

/** Locate the CSS and HTML entry files in an export directory. */
async function findExportFiles(exportDir) {
  let entries;
  try {
    entries = await readdir(exportDir);
  } catch {
    throw new Error(`Canva export directory not found: ${exportDir}`);
  }
  const pick = (exts, preferred) => {
    const matches = entries.filter(f => exts.includes(extname(f).toLowerCase())).sort();
    return matches.find(f => f.toLowerCase() === preferred) ?? matches[0] ?? null;
  };
  const css = pick(['.css'], 'style.css');
  const html = pick(['.html', '.htm'], 'index.html');
  if (!css) throw new Error(`No .css file found in Canva export: ${exportDir}`);
  if (!html) throw new Error(`No .html file found in Canva export: ${exportDir}`);
  return { cssPath: join(exportDir, css), htmlPath: join(exportDir, html) };
}

async function pathExists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// --- orchestration --------------------------------------------------------

export async function setupCanvaTheme(targetDir, config) {
  const { projectName: slug, siteTitle, canvaExport } = config;
  if (!canvaExport) {
    throw new Error('Canva starter requires an export path: pass --canva-export=<dir>');
  }
  // The user gives --canva-export relative to where they run the wizard (cwd ===
  // targetDir for real runs); tests pass an absolute path.
  const exportDir = isAbsolute(canvaExport) ? canvaExport : resolve(targetDir, canvaExport);

  const { cssPath, htmlPath } = await findExportFiles(exportDir);

  // 1. Valid base scaffold (refuses an existing themes/<slug>/, substitutes tokens).
  await copyBlankBase(targetDir, slug, siteTitle);
  const themeDir = join(targetDir, 'themes', slug);

  // 2. Merge extracted design tokens into theme.json.
  const tokenJson = await runScript(PARSE_SCRIPT, ['--theme-json', cssPath]);
  let tokens;
  try {
    const parsed = JSON.parse(tokenJson);
    const s = parsed.settings ?? {};
    tokens = {
      colors: s.color?.palette ?? [],
      fonts: s.typography?.fontFamilies ?? [],
      fontSizes: s.typography?.fontSizes ?? [],
      spacing: s.spacing?.spacingSizes ?? [],
    };
  } catch (err) {
    throw new Error(`parse-canva-export.sh produced invalid JSON: ${err.message}`);
  }
  const themeJsonPath = join(themeDir, 'theme.json');
  const baseThemeJson = JSON.parse(await readFile(themeJsonPath, 'utf8'));
  const merged = mergeCanvaTokens(baseThemeJson, tokens);
  await writeFile(themeJsonPath, JSON.stringify(merged, null, 2) + '\n');

  // 3. Convert page content → pattern (PHP) wired into front-page.html.
  const rawBlocks = await runScript(CONVERT_SCRIPT, [htmlPath]);
  const blocks = cleanConvertedBlocks(rawBlocks);
  const { markup, assets } = rewriteImageSrcs(blocks);

  await mkdir(join(themeDir, 'patterns'), { recursive: true });
  await writeFile(join(themeDir, 'patterns', `${PATTERN_SLUG}.php`), patternFile(slug, markup));
  await writeFile(join(themeDir, 'templates', 'front-page.html'), frontPageTemplate(slug));

  // 4. Copy referenced images into the theme so they resolve.
  for (const rel of assets) {
    if (rel.includes('..')) continue; // never escape the export dir
    const src = join(exportDir, rel);
    if (extname(rel) && !IMAGE_EXTS.has(extname(rel).toLowerCase())) continue;
    if (!await pathExists(src)) continue;
    const dst = join(themeDir, 'assets', rel);
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
  }

  // 5. Staging note bridging to the agent path.
  await mkdir(join(targetDir, 'docs'), { recursive: true });
  await writeFile(join(targetDir, 'docs', 'NEXT-STEPS.md'), nextSteps(slug));
}
