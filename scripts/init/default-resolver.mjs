import { slugify, titleCase } from './slugify.mjs';

const VALID_THEMES = ['blank', 'flavian-shop', 'figma', 'indesign', 'canva'];
const VALID_MULTISITE_MODES = ['subdirectory', 'subdomain'];

export function resolveDefaults(flags, env) {
  const projectName = flags.name
    ? slugify(flags.name)
    : slugify(env.cwdBasename || 'flavian-site');

  // The --canva shorthand selects the `canva` starter. It must not contradict an
  // explicit --theme (e.g. `--canva --theme=blank`).
  let themeStarter;
  if (flags.canva) {
    if (flags.theme && flags.theme !== 'canva') {
      throw new Error(`--canva conflicts with --theme=${flags.theme} (drop one)`);
    }
    themeStarter = 'canva';
  } else {
    themeStarter = flags.theme ?? 'blank';
  }
  if (!VALID_THEMES.includes(themeStarter)) {
    throw new Error(`Unknown theme starter: ${themeStarter} (expected one of ${VALID_THEMES.join(', ')})`);
  }

  // The Canva starter converts a real export, so an export path is mandatory.
  const canvaExport = flags.canvaExport ?? null;
  if (themeStarter === 'canva' && !canvaExport) {
    throw new Error('Canva starter requires an export path: pass --canva-export=<dir>');
  }
  if (canvaExport && themeStarter !== 'canva') {
    throw new Error('--canva-export requires --canva (or --theme=canva)');
  }

  const woocommerce = themeStarter === 'flavian-shop' ? true : Boolean(flags.woo);

  const multisite = Boolean(flags.multisite);
  const multisiteMode = flags.multisiteMode ?? 'subdirectory';
  if (!VALID_MULTISITE_MODES.includes(multisiteMode)) {
    throw new Error(`Unknown multisite mode: ${multisiteMode} (expected one of ${VALID_MULTISITE_MODES.join(', ')})`);
  }

  return {
    projectName,
    siteTitle: flags.title ?? titleCase(projectName),
    themeStarter,
    canvaExport,
    woocommerce,
    multisite,
    multisiteMode,
    port: Number.isInteger(flags.port) ? flags.port : 8080,
    adminEmail: flags.email ?? env.gitEmail ?? 'admin@example.com',
    initGit: !flags.noGit,
  };
}
