import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { substituteTokens } from '../token-substitute.mjs';

const NEXT_STEPS = {
  figma: `# Next Steps — Figma Import

Your project is staged for the Figma → FSE pipeline.

1. Place your Figma URL or export in this repository.
2. Run the \`figma-to-fse-autonomous-workflow\` skill in Claude Code:
   > "Convert this Figma design to WordPress" (with your Figma URL)
3. The generated theme will be written to \`themes/{{THEME_SLUG}}/\`.
`,
  indesign: `# Next Steps — InDesign Import

The InDesign-to-FSE pipeline is not yet implemented.

For now, manually convert your InDesign export to HTML/CSS, then either:
- Place output in \`themes/{{THEME_SLUG}}/\` as a hand-built FSE theme, or
- Adapt the \`canva-to-fse-autonomous-workflow\` (similar HTML/CSS source).
`,
};

async function refuseIfExists(dst) {
  try { await access(dst, constants.F_OK); }
  catch { return; }
  throw new Error(`Target already exists: ${dst} — remove it or pick a different slug`);
}

async function copyBlank(targetDir, slug) {
  const src = join(targetDir, '.claude/templates/theme');
  const dst = join(targetDir, 'themes', slug);
  await refuseIfExists(dst);
  await mkdir(dst, { recursive: true });
  await cp(src, dst, { recursive: true });
}

/**
 * Materialize the blank FSE theme into themes/<slug>/ with tokens substituted.
 * Shared by the `blank` and `canva` starters (canva builds on this base).
 */
export async function copyBlankBase(targetDir, slug, siteTitle) {
  await copyBlank(targetDir, slug);
  await substituteTokens(join(targetDir, 'themes', slug), {
    THEME_NAME: siteTitle,
    THEME_SLUG: slug,
    SITE_TITLE: siteTitle,
  });
}

async function copyFlavianShop(targetDir, slug) {
  const src = join(targetDir, 'themes/flavian-shop');
  try {
    await access(src, constants.R_OK);
  } catch {
    throw new Error('themes/flavian-shop/ not found — template repo is incomplete');
  }
  const dst = join(targetDir, 'themes', slug);
  await refuseIfExists(dst);
  await mkdir(dst, { recursive: true });
  await cp(src, dst, { recursive: true });
}

async function writeNextSteps(targetDir, kind, slug) {
  const docsDir = join(targetDir, 'docs');
  await mkdir(docsDir, { recursive: true });
  const body = NEXT_STEPS[kind].replaceAll('{{THEME_SLUG}}', slug);
  await writeFile(join(docsDir, 'NEXT-STEPS.md'), body);
}

async function rewriteFlavianShopHeaders(targetDir, slug, title) {
  const styleFile = join(targetDir, 'themes', slug, 'style.css');
  let css = await readFile(styleFile, 'utf8');
  css = css.replace(/^Theme Name:.*$/m, `Theme Name: ${title}`);
  css = css.replace(/^Text Domain:.*$/m, `Text Domain: ${slug}`);
  await writeFile(styleFile, css);

  const jsonFile = join(targetDir, 'themes', slug, 'theme.json');
  try {
    const json = JSON.parse(await readFile(jsonFile, 'utf8'));
    json.title = title;
    await writeFile(jsonFile, JSON.stringify(json, null, 2) + '\n');
  } catch {
    // theme.json may not exist in some shop variants; skip silently
  }
}

export async function setupTheme(targetDir, config) {
  const { themeStarter, projectName, siteTitle } = config;
  const slug = projectName;

  switch (themeStarter) {
    case 'blank':
      await copyBlankBase(targetDir, slug, siteTitle);
      break;
    case 'flavian-shop':
      await copyFlavianShop(targetDir, slug);
      await rewriteFlavianShopHeaders(targetDir, slug, siteTitle);
      break;
    case 'canva': {
      // Dynamic import keeps the static module graph acyclic (canva.mjs imports
      // copyBlankBase from here).
      const { setupCanvaTheme } = await import('./canva.mjs');
      await setupCanvaTheme(targetDir, config);
      break;
    }
    case 'figma':
    case 'indesign':
      await writeNextSteps(targetDir, themeStarter, slug);
      break;
    default:
      throw new Error(`Unknown theme starter: ${themeStarter}`);
  }
}
